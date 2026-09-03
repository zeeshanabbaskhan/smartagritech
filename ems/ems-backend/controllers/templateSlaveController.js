// ─── Template slave controller ────────────────────────────────────────────────
// A DeviceTemplateSlave is a logical sub-unit of a template (e.g. one Modbus
// slave address).  At most one slave may be flagged isDefault per template.
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

// @desc  List slaves for a template
const getSlaves = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { templateId: req.params.templateId }

    const [data, total] = await Promise.all([
      prisma.deviceTemplateSlave.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { variables: true } } },
      }),
      prisma.deviceTemplateSlave.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a slave; if isDefault is true, clears existing default first
const createSlave = async (req, res, next) => {
  try {
    const { name, description, protocol, isDefault } = req.body
    const { templateId } = req.params

    const template = await prisma.deviceTemplate.findUnique({ where: { id: templateId } })
    if (!template) return next(new AppError('Device template not found', 404))

    const data = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.deviceTemplateSlave.updateMany({ where: { templateId }, data: { isDefault: false } })
      }
      const slave = await tx.deviceTemplateSlave.create({
        data: {
          templateId,
          organizationId: template.organizationId,
          name,
          description,
          protocol: protocol || null,
          isDefault: !!isDefault,
        },
      })
      await tx.deviceTemplate.update({ where: { id: templateId }, data: { totalSlaves: { increment: 1 } } })
      return slave
    })

    await invalidateTemplateCaches(template.organizationId, templateId)
    const sync = await syncTemplateToDevices(templateId)
    res.status(201).json({ success: true, data, sync })
  } catch (err) { next(err) }
}

// @desc  Update a slave; if isDefault is set, clears other defaults first
const updateSlave = async (req, res, next) => {
  try {
    const { slaveId, templateId } = req.params
    const { name, description, protocol, isDefault } = req.body

    const existing = await prisma.deviceTemplateSlave.findFirst({ where: { id: slaveId, templateId } })
    if (!existing) return next(new AppError('Slave not found', 404))

    const data = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.deviceTemplateSlave.updateMany({
          where: { templateId, id: { not: slaveId } },
          data:  { isDefault: false },
        })
      }
      return tx.deviceTemplateSlave.update({
        where: { id: slaveId },
        data: {
          name,
          description,
          ...(protocol !== undefined ? { protocol } : {}),
          isDefault,
        },
      })
    })

    await invalidateTemplateCaches(existing.organizationId, templateId)
    const sync = await syncTemplateToDevices(templateId)
    res.json({ success: true, data, sync })
  } catch (err) { next(err) }
}

// @desc  Delete a slave; cascades its variables and device config slaves cleanly
const deleteSlave = async (req, res, next) => {
  try {
    const { slaveId, templateId } = req.params

    const existing = await prisma.deviceTemplateSlave.findFirst({ where: { id: slaveId, templateId } })
    if (!existing) return next(new AppError('Slave not found', 404))

    const tVars = await prisma.deviceTemplateVariable.findMany({
      where: { templateSlaveId: slaveId },
      select: { id: true },
    })
    const tVarIds = tVars.map((v) => v.id)

    await prisma.$transaction([
      ...(tVarIds.length ? [prisma.deviceConfigVariable.deleteMany({ where: { templateVariableId: { in: tVarIds } } })] : []),
      prisma.deviceConfigSlave.deleteMany({ where: { templateSlaveId: slaveId } }),
      ...(tVarIds.length ? [prisma.templateTrigger.deleteMany({ where: { templateVariableId: { in: tVarIds } } })] : []),
      prisma.deviceTemplateVariable.deleteMany({ where: { templateSlaveId: slaveId } }),
      prisma.deviceTemplateSlave.delete({ where: { id: slaveId } }),
      prisma.deviceTemplate.update({
        where: { id: templateId },
        data: {
          totalSlaves: { decrement: 1 },
          ...(tVarIds.length ? { totalVariables: { decrement: tVarIds.length } } : {}),
        },
      }),
    ])

    await invalidateTemplateCaches(existing.organizationId, templateId)
    const sync = await syncTemplateToDevices(templateId)
    res.json({ success: true, message: 'Slave deleted', sync })
  } catch (err) { next(err) }
}

module.exports = { getSlaves, createSlave, updateSlave, deleteSlave }
