// ─── Template variable controller ─────────────────────────────────────────────
// Variables define the individual Modbus registers (or data points) within a
// slave.  Deleting is blocked when provisioned devices have matching config vars.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')
const refCache = require('../utils/referenceCache')
const { syncTemplateToDevices } = require('../utils/syncTemplateToDevices')

const invalidateTemplateCaches = async (organizationId, templateId) => {
  await refCache.invalidateOrg('all')
  if (organizationId) await refCache.invalidateOrg(organizationId)
  if (templateId) await refCache.invalidateTemplate(templateId)
}

const VALID_DATA_TYPES = ['FLOAT', 'INTEGER', 'BOOLEAN', 'STRING']
const DATA_TYPE_ALIASES = {
  FLOAT: 'FLOAT', FLOAT32: 'FLOAT', FLOAT64: 'FLOAT', DOUBLE: 'FLOAT', REAL: 'FLOAT',
  INT: 'INTEGER', INTEGER: 'INTEGER', INT16: 'INTEGER', UINT16: 'INTEGER',
  INT32: 'INTEGER', UINT32: 'INTEGER', LONG: 'INTEGER',
  BOOL: 'BOOLEAN', BOOLEAN: 'BOOLEAN', BIT: 'BOOLEAN',
  STR: 'STRING', STRING: 'STRING', TEXT: 'STRING', ASCII: 'STRING',
}

// Portal dataFormat labels → Prisma DataType enum
const DATA_FORMAT_TO_TYPE = {
  Bit: 'BOOLEAN',
  'Unsigned Word': 'INTEGER',
  'Signed Word': 'INTEGER',
  'Unsigned Long': 'INTEGER',
  'Signed Long': 'INTEGER',
  'Unsigned Long Long': 'INTEGER',
  'Signed Long Long': 'INTEGER',
  Float: 'FLOAT',
  Double: 'FLOAT',
  ASCII: 'STRING',
}

const normalizeDataType = (raw) => {
  if (raw == null || raw === '') return 'FLOAT'
  const key = String(raw).trim().toUpperCase()
  return DATA_TYPE_ALIASES[key] || (VALID_DATA_TYPES.includes(key) ? key : 'FLOAT')
}

const resolveDataType = ({ dataType, dataFormat }) => {
  if (dataFormat != null && dataFormat !== '' && DATA_FORMAT_TO_TYPE[dataFormat]) {
    return DATA_FORMAT_TO_TYPE[dataFormat]
  }
  if (dataType !== undefined) return normalizeDataType(dataType)
  return undefined
}

const normalizeVariableType = (raw) => {
  if (raw == null || raw === '') return undefined
  const s = String(raw).trim().toUpperCase()
  if (s === 'DIRECT' || s === 'DIRECTLY COLLECTED VARIABLES') return 'DIRECT'
  if (s === 'EQUATION' || s === 'EQUATION VARIABLES') return 'EQUATION'
  return s === 'DIRECT' || s === 'EQUATION' ? s : 'DIRECT'
}

const PORTAL_FIELDS = [
  'name', 'displayName', 'unit', 'registerAddress', 'iconId', 'isActive',
  'sortNumber', 'identifier', 'machineId', 'machineControl', 'iconLabel',
  'lineChartColor', 'lineChartLimit', 'lowLimitLineChart',
  'peakTimeStart', 'peakTimeEnd', 'peakOffTimeStart', 'peakOffTimeEnd',
  'peakTimeColor', 'peakOffTimeColor', 'registerFuncCode', 'dataFormat',
  'numberFormat', 'decimalPlacesPadding', 'storageVariable', 'storageTiming',
  'readWrite', 'acquisitionFormula', 'controlFormula', 'mainPageSelection',
  'sortOrder', 'defaultUnitSelection', 'equationSlaveIds',
]

const pickVariableData = (body, { forCreate = false } = {}) => {
  const data = {}
  for (const key of PORTAL_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key]
  }
  // FE may send sort as string alias for sortOrder
  if (body.sort !== undefined && body.sortOrder === undefined) {
    const n = body.sort === '' || body.sort == null ? null : Number(body.sort)
    data.sortOrder = Number.isFinite(n) ? n : null
  }
  if (body.number !== undefined && body.sortNumber === undefined) {
    const n = body.number === '' || body.number == null ? null : Number(body.number)
    data.sortNumber = Number.isFinite(n) ? n : null
  }
  if (body.icon !== undefined && body.iconLabel === undefined) {
    data.iconLabel = body.icon || null
  }
  if (body.slaves !== undefined && body.equationSlaveIds === undefined) {
    data.equationSlaveIds = Array.isArray(body.slaves) ? body.slaves : body.slaves
  }

  const vt = normalizeVariableType(body.variableType)
  if (vt !== undefined) data.variableType = vt
  else if (forCreate) data.variableType = 'DIRECT'

  const dt = resolveDataType(body)
  if (dt !== undefined) data.dataType = dt
  else if (forCreate) data.dataType = 'FLOAT'

  return data
}

// @desc  List variables for a template slave
const getVariables = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { templateSlaveId: req.params.slaveId }

    const [data, total] = await Promise.all([
      prisma.deviceTemplateVariable.findMany({
        where, skip, take: limit,
        orderBy: [{ sortOrder: 'asc' }, { sortNumber: 'asc' }, { createdAt: 'asc' }],
        include: { icon: { select: { id: true, name: true, imageUrl: true } } },
      }),
      prisma.deviceTemplateVariable.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a variable and increment the template's totalVariables counter
const createVariable = async (req, res, next) => {
  try {
    const { templateId, slaveId } = req.params
    const fields = pickVariableData(req.body, { forCreate: true })
    if (!fields.name) return next(new AppError('Variable name is required', 400))

    const slave = await prisma.deviceTemplateSlave.findFirst({ where: { id: slaveId, templateId } })
    if (!slave) return next(new AppError('Slave not found', 404))

    // Auto-assign sortNumber if omitted
    if (fields.sortNumber == null) {
      const agg = await prisma.deviceTemplateVariable.aggregate({
        where: { templateSlaveId: slaveId },
        _max: { sortNumber: true },
      })
      fields.sortNumber = (agg._max.sortNumber || 0) + 1
    }
    if (fields.sortOrder == null) fields.sortOrder = fields.sortNumber

    if (fields.defaultUnitSelection) {
      await prisma.deviceTemplateVariable.updateMany({
        where: { templateSlaveId: slaveId },
        data: { defaultUnitSelection: false },
      })
    }

    const data = await prisma.$transaction(async (tx) => {
      const variable = await tx.deviceTemplateVariable.create({
        data: {
          templateSlaveId: slaveId,
          templateId,
          organizationId:  slave.organizationId,
          ...fields,
        },
      })
      await tx.deviceTemplate.update({ where: { id: templateId }, data: { totalVariables: { increment: 1 } } })
      return variable
    })

    await invalidateTemplateCaches(slave.organizationId, templateId)
    const sync = await syncTemplateToDevices(templateId)
    res.status(201).json({ success: true, data, sync })
  } catch (err) { next(err) }
}

// @desc  Update variable metadata
const updateVariable = async (req, res, next) => {
  try {
    const { variableId, slaveId, templateId } = req.params

    const existing = await prisma.deviceTemplateVariable.findFirst({ where: { id: variableId, templateSlaveId: slaveId } })
    if (!existing) return next(new AppError('Variable not found', 404))

    const fields = pickVariableData(req.body)
    if (fields.defaultUnitSelection === true) {
      await prisma.deviceTemplateVariable.updateMany({
        where: { templateSlaveId: slaveId, id: { not: variableId } },
        data: { defaultUnitSelection: false },
      })
    }

    const data = await prisma.deviceTemplateVariable.update({
      where: { id: variableId },
      data:  fields,
    })
    await invalidateTemplateCaches(existing.organizationId, templateId)
    const sync = await syncTemplateToDevices(templateId)
    res.json({ success: true, data, sync })
  } catch (err) { next(err) }
}

// @desc  Delete a variable; blocked when provisioned config variables reference it
const deleteVariable = async (req, res, next) => {
  try {
    const { variableId, slaveId, templateId } = req.params

    const existing = await prisma.deviceTemplateVariable.findFirst({ where: { id: variableId, templateSlaveId: slaveId } })
    if (!existing) return next(new AppError('Variable not found', 404))

    const inUse = await prisma.deviceConfigVariable.count({ where: { templateVariableId: variableId } })
    if (inUse) return next(new AppError('Cannot delete: variable has provisioned config variables.', 400))

    await prisma.$transaction([
      prisma.deviceTemplateVariable.delete({ where: { id: variableId } }),
      prisma.deviceTemplate.update({ where: { id: templateId }, data: { totalVariables: { decrement: 1 } } }),
    ])

    await invalidateTemplateCaches(existing.organizationId, templateId)
    const sync = await syncTemplateToDevices(templateId)
    res.json({ success: true, message: 'Variable deleted', sync })
  } catch (err) { next(err) }
}

// @desc  Bulk update sortOrder for variables on a slave
const sortVariables = async (req, res, next) => {
  try {
    const { templateId, slaveId } = req.params
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) return next(new AppError('items[] required', 400))

    const slave = await prisma.deviceTemplateSlave.findFirst({ where: { id: slaveId, templateId } })
    if (!slave) return next(new AppError('Slave not found', 404))

    await prisma.$transaction(
      items.map((item, idx) =>
        prisma.deviceTemplateVariable.updateMany({
          where: { id: item.id, templateSlaveId: slaveId },
          data: {
            sortOrder: item.sortOrder != null ? Number(item.sortOrder) : idx + 1,
            sortNumber: item.sortNumber != null ? Number(item.sortNumber) : (item.sortOrder != null ? Number(item.sortOrder) : idx + 1),
          },
        })
      )
    )

    await invalidateTemplateCaches(slave.organizationId, templateId)
    const sync = await syncTemplateToDevices(templateId)
    res.json({ success: true, message: 'Sort order saved', sync })
  } catch (err) { next(err) }
}

// @desc  Set the default-unit variable for a slave (clears others)
const setDefaultUnit = async (req, res, next) => {
  try {
    const { templateId, slaveId, variableId } = req.params

    const existing = await prisma.deviceTemplateVariable.findFirst({ where: { id: variableId, templateSlaveId: slaveId } })
    if (!existing) return next(new AppError('Variable not found', 404))

    await prisma.$transaction([
      prisma.deviceTemplateVariable.updateMany({
        where: { templateSlaveId: slaveId },
        data: { defaultUnitSelection: false },
      }),
      prisma.deviceTemplateVariable.update({
        where: { id: variableId },
        data: { defaultUnitSelection: true },
      }),
    ])

    await invalidateTemplateCaches(existing.organizationId, templateId)
    const sync = await syncTemplateToDevices(templateId)
    const data = await prisma.deviceTemplateVariable.findUnique({ where: { id: variableId } })
    res.json({ success: true, data, sync })
  } catch (err) { next(err) }
}

module.exports = {
  getVariables, createVariable, updateVariable, deleteVariable,
  sortVariables, setDefaultUnit,
}
