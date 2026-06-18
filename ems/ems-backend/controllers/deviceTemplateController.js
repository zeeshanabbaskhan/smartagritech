// ─── Device template controller (Blueprint Engine) ───────────────────────────
// Templates define the structure of a device: Slaves → Variables.
// When a device is provisioned, the template is cloned into DeviceConfig*.
const { randomUUID } = require('crypto')
const prisma         = require('../config/database')
const { AppError }   = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const refCache = require('../utils/referenceCache')

// @desc  List device templates; includes per-template totalVariables count
// @access SUPER_ADMIN | ORG_ADMIN
const getDeviceTemplates = async (req, res, next) => {
  try {
    const orgKey = req.user.organizationId || req.query.organizationId || 'all'
    const cacheKey = `org:${orgKey}:templates:${req.query.page || 1}`
    const hit = await refCache.get(cacheKey)
    if (hit) return res.json(hit)

    const { page, limit, skip } = paginate(req.query)
    const { search }            = req.query

    const where = { ...orgScope(req.user) }
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const [templates, total] = await Promise.all([
      prisma.deviceTemplate.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { slaves: true, devices: true } } },
      }),
      prisma.deviceTemplate.count({ where }),
    ])

    // N+1 but templates are few and this keeps the query simple
    const data = await Promise.all(templates.map(async (t) => {
      const totalVariables = await prisma.deviceTemplateVariable.count({ where: { templateId: t.id } })
      return { ...t, totalVariables }
    }))

    const payload = { success: true, data, total, page, pages: Math.ceil(total / limit) }
    await refCache.set(cacheKey, payload)
    res.json(payload)
  } catch (err) { next(err) }
}

// @desc  Get a single template with its full slave + variable tree
// @access SUPER_ADMIN | ORG_ADMIN
const getDeviceTemplate = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const data  = await prisma.deviceTemplate.findFirst({
      where,
      include: {
        slaves: {
          orderBy: { createdAt: 'asc' },
          include: { variables: { include: { icon: true }, orderBy: { createdAt: 'asc' } } },
        },
        _count: { select: { devices: true } },
      },
    })
    if (!data) return next(new AppError('Device template not found', 404))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Create a new device template
// @access SUPER_ADMIN | ORG_ADMIN
const createDeviceTemplate = async (req, res, next) => {
  try {
    const { name, organizationId, acquisitionMethod } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId
    const data  = await prisma.deviceTemplate.create({ data: { name, organizationId: orgId, acquisitionMethod } })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update template name / acquisition method
// @access SUPER_ADMIN | ORG_ADMIN
const updateDeviceTemplate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.deviceTemplate.findFirst({ where })
    if (!existing) return next(new AppError('Device template not found', 404))

    const { name, acquisitionMethod } = req.body
    const data = await prisma.deviceTemplate.update({
      where: { id: req.params.id },
      data:  { name, acquisitionMethod },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a template; blocked when devices use it.
//        Cascade (slaves → variables) is handled by DB onDelete:Cascade.
// @access SUPER_ADMIN | ORG_ADMIN
const deleteDeviceTemplate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.deviceTemplate.findFirst({ where })
    if (!existing) return next(new AppError('Device template not found', 404))

    const deviceCount = await prisma.device.count({ where: { templateId: req.params.id } })
    if (deviceCount) return next(new AppError('Cannot delete: template is used by devices.', 400))

    await prisma.deviceTemplate.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Template deleted' })
  } catch (err) { next(err) }
}

// @desc  Deep-clone a template (including all slaves and variables) into the same org.
//        New IDs are generated with randomUUID() so there is no foreign-key collision.
// @access SUPER_ADMIN | ORG_ADMIN
const cloneDeviceTemplate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const original = await prisma.deviceTemplate.findFirst({
      where,
      include: { slaves: { include: { variables: true } } },
    })
    if (!original) return next(new AppError('Device template not found', 404))

    const result = await prisma.$transaction(async (tx) => {
      const newTemplate = await tx.deviceTemplate.create({
        data: {
          name:              `${original.name} (Copy)`,
          organizationId:    original.organizationId,
          acquisitionMethod: original.acquisitionMethod,
        },
      })

      for (const slave of original.slaves) {
        const newSlaveId = randomUUID()
        await tx.deviceTemplateSlave.create({
          data: {
            id:             newSlaveId,
            templateId:     newTemplate.id,
            organizationId: original.organizationId,
            name:           slave.name,
            description:    slave.description,
            isDefault:      slave.isDefault,
          },
        })

        for (const variable of slave.variables) {
          await tx.deviceTemplateVariable.create({
            data: {
              templateSlaveId: newSlaveId,
              templateId:      newTemplate.id,
              organizationId:  original.organizationId,
              name:            variable.name,
              displayName:     variable.displayName,
              unit:            variable.unit,
              registerAddress: variable.registerAddress,
              iconId:          variable.iconId,
              dataType:        variable.dataType,
              isActive:        variable.isActive,
            },
          })
        }
      }

      await tx.deviceTemplate.update({
        where: { id: newTemplate.id },
        data:  {
          totalSlaves:    original.slaves.length,
          totalVariables: original.slaves.reduce((s, sl) => s + sl.variables.length, 0),
        },
      })

      return tx.deviceTemplate.findUnique({
        where:   { id: newTemplate.id },
        include: { slaves: { include: { variables: true } } },
      })
    })

    res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
}

module.exports = {
  getDeviceTemplates, getDeviceTemplate,
  createDeviceTemplate, updateDeviceTemplate, deleteDeviceTemplate,
  cloneDeviceTemplate,
}
