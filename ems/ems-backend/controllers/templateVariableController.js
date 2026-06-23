// ─── Template variable controller ─────────────────────────────────────────────
// Variables define the individual Modbus registers (or data points) within a
// slave.  Deleting is blocked when provisioned devices have matching config vars.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')
const refCache = require('../utils/referenceCache')

// Variables change the template's totalVariables count shown in the cached
// templates list — clear both viewer-org buckets + the single-template cache.
const invalidateTemplateCaches = async (organizationId, templateId) => {
  await refCache.invalidateOrg('all')
  if (organizationId) await refCache.invalidateOrg(organizationId)
  if (templateId) await refCache.invalidateTemplate(templateId)
}

// @desc  List variables for a template slave
// @access SUPER_ADMIN | ORG_ADMIN
const getVariables = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { templateSlaveId: req.params.slaveId }

    const [data, total] = await Promise.all([
      prisma.deviceTemplateVariable.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'asc' },
        include: { icon: { select: { id: true, name: true, imageUrl: true } } },
      }),
      prisma.deviceTemplateVariable.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a variable and increment the template's totalVariables counter
// @access SUPER_ADMIN | ORG_ADMIN
const createVariable = async (req, res, next) => {
  try {
    const { templateId, slaveId } = req.params
    const { name, displayName, unit, registerAddress, iconId, dataType } = req.body

    const slave = await prisma.deviceTemplateSlave.findFirst({ where: { id: slaveId, templateId } })
    if (!slave) return next(new AppError('Slave not found', 404))

    const data = await prisma.$transaction(async (tx) => {
      const variable = await tx.deviceTemplateVariable.create({
        data: {
          templateSlaveId: slaveId,
          templateId,
          organizationId:  slave.organizationId,
          name, displayName, unit, registerAddress, iconId, dataType,
        },
      })
      await tx.deviceTemplate.update({ where: { id: templateId }, data: { totalVariables: { increment: 1 } } })
      return variable
    })

    await invalidateTemplateCaches(slave.organizationId, templateId)
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update variable metadata
// @access SUPER_ADMIN | ORG_ADMIN
const updateVariable = async (req, res, next) => {
  try {
    const { variableId, slaveId } = req.params

    const existing = await prisma.deviceTemplateVariable.findFirst({ where: { id: variableId, templateSlaveId: slaveId } })
    if (!existing) return next(new AppError('Variable not found', 404))

    const { name, displayName, unit, registerAddress, iconId, dataType, isActive } = req.body
    const data = await prisma.deviceTemplateVariable.update({
      where: { id: variableId },
      data:  { name, displayName, unit, registerAddress, iconId, dataType, isActive },
    })
    await invalidateTemplateCaches(existing.organizationId, req.params.templateId)
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a variable; blocked when provisioned config variables reference it
// @access SUPER_ADMIN | ORG_ADMIN
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
    res.json({ success: true, message: 'Variable deleted' })
  } catch (err) { next(err) }
}

module.exports = { getVariables, createVariable, updateVariable, deleteVariable }
