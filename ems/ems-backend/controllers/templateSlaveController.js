// ─── Template slave controller ────────────────────────────────────────────────
// A DeviceTemplateSlave is a logical sub-unit of a template (e.g. one Modbus
// slave address).  At most one slave may be flagged isDefault per template.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')
const refCache = require('../utils/referenceCache')

// Slaves change the template's totalSlaves/totalVariables counts, which the
// cached templates list reflects — clear both viewer-org buckets + the template.
const invalidateTemplateCaches = async (organizationId, templateId) => {
  await refCache.invalidateOrg('all')
  if (organizationId) await refCache.invalidateOrg(organizationId)
  if (templateId) await refCache.invalidateTemplate(templateId)
}

// @desc  List slaves for a template
// @access SUPER_ADMIN | ORG_ADMIN
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
// @access SUPER_ADMIN | ORG_ADMIN
const createSlave = async (req, res, next) => {
  try {
    const { name, description, isDefault } = req.body
    const { templateId } = req.params

    const template = await prisma.deviceTemplate.findUnique({ where: { id: templateId } })
    if (!template) return next(new AppError('Device template not found', 404))

    const data = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.deviceTemplateSlave.updateMany({ where: { templateId }, data: { isDefault: false } })
      }
      const slave = await tx.deviceTemplateSlave.create({
        data: { templateId, organizationId: template.organizationId, name, description, isDefault: !!isDefault },
      })
      await tx.deviceTemplate.update({ where: { id: templateId }, data: { totalSlaves: { increment: 1 } } })
      return slave
    })

    await invalidateTemplateCaches(template.organizationId, templateId)
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a slave; if isDefault is set, clears other defaults first
// @access SUPER_ADMIN | ORG_ADMIN
const updateSlave = async (req, res, next) => {
  try {
    const { slaveId, templateId } = req.params
    const { name, description, isDefault } = req.body

    const existing = await prisma.deviceTemplateSlave.findFirst({ where: { id: slaveId, templateId } })
    if (!existing) return next(new AppError('Slave not found', 404))

    const data = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.deviceTemplateSlave.updateMany({
          where: { templateId, id: { not: slaveId } },
          data:  { isDefault: false },
        })
      }
      return tx.deviceTemplateSlave.update({ where: { id: slaveId }, data: { name, description, isDefault } })
    })

    await invalidateTemplateCaches(existing.organizationId, templateId)
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a slave; blocked when provisioned devices use it
// @access SUPER_ADMIN | ORG_ADMIN
const deleteSlave = async (req, res, next) => {
  try {
    const { slaveId, templateId } = req.params

    const existing = await prisma.deviceTemplateSlave.findFirst({ where: { id: slaveId, templateId } })
    if (!existing) return next(new AppError('Slave not found', 404))

    const inUse = await prisma.deviceConfigSlave.count({ where: { templateSlaveId: slaveId } })
    if (inUse) return next(new AppError('Cannot delete: slave is in use by provisioned devices.', 400))

    await prisma.$transaction([
      prisma.deviceTemplateSlave.delete({ where: { id: slaveId } }),
      prisma.deviceTemplate.update({ where: { id: templateId }, data: { totalSlaves: { decrement: 1 } } }),
    ])

    await invalidateTemplateCaches(existing.organizationId, templateId)
    res.json({ success: true, message: 'Slave deleted' })
  } catch (err) { next(err) }
}

module.exports = { getSlaves, createSlave, updateSlave, deleteSlave }
