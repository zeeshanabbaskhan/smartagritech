// ─── Device configuration controller ─────────────────────────────────────────
// Exposes the runtime config that was cloned from a template when the device
// was provisioned: ConfigSlaves → ConfigVariables → ConfigVariableLogs.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate, buildDateRange } = require('../utils/helpers')

// @desc  Return the full nested config tree for a device
//        (all slaves with their active variables)
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getFullConfig = async (req, res, next) => {
  try {
    const data = await prisma.deviceConfigSlave.findMany({
      where:   { deviceId: req.params.deviceId },
      orderBy: { createdAt: 'asc' },
      include: { configVariables: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Paginated list of config slaves for a device
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getConfigSlaves = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { deviceId: req.params.deviceId }

    const [data, total] = await Promise.all([
      prisma.deviceConfigSlave.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { configVariables: true } } },
      }),
      prisma.deviceConfigSlave.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Paginated list of config variables for a specific slave
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getConfigSlaveVariables = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { deviceId: req.params.deviceId, deviceConfigSlaveId: req.params.configSlaveId }

    const [data, total] = await Promise.all([
      prisma.deviceConfigVariable.findMany({ where, skip, take: limit, orderBy: { createdAt: 'asc' } }),
      prisma.deviceConfigVariable.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Manually override a config variable's current value.
//        Writes a DeviceConfigVariableLog entry with source='MANUAL'.
// @access SUPER_ADMIN | ORG_ADMIN
const updateConfigVariable = async (req, res, next) => {
  try {
    const { configVariableId, deviceId } = req.params
    const { currentValue } = req.body

    const existing = await prisma.deviceConfigVariable.findFirst({ where: { id: configVariableId, deviceId } })
    if (!existing) return next(new AppError('Config variable not found', 404))

    const now  = new Date()
    const data = await prisma.$transaction(async (tx) => {
      const updated = await tx.deviceConfigVariable.update({
        where: { id: configVariableId },
        data:  { currentValue: String(currentValue), lastUpdatedAt: now },
      })
      await tx.deviceConfigVariableLog.create({
        data: {
          deviceConfigVariableId: configVariableId,
          deviceId,
          organizationId:  existing.organizationId,
          previousValue:   existing.currentValue,
          newValue:        String(currentValue),
          source:          'MANUAL',
          changedAt:       now,
        },
      })
      return updated
    })

    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Paginated change history for a single config variable
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getConfigVariableLog = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const { from, to }          = req.query

    const where = {
      deviceConfigVariableId: req.params.configVariableId,
      deviceId:               req.params.deviceId,
    }
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.changedAt = dateRange

    const [data, total] = await Promise.all([
      prisma.deviceConfigVariableLog.findMany({ where, skip, take: limit, orderBy: { changedAt: 'desc' } }),
      prisma.deviceConfigVariableLog.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

module.exports = { getFullConfig, getConfigSlaves, getConfigSlaveVariables, updateConfigVariable, getConfigVariableLog }
