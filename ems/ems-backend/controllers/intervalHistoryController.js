// ─── Interval history controller ──────────────────────────────────────────────
// IntervalHistory stores pre-computed energy cost calculations for a date range.
// Costs are computed on-the-fly against SlabRate tiers by costCalculator service.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const { computeIntervalCost } = require('../services/costCalculator')
const { assertDeviceAccess, listAccessibleDeviceIds } = require('../utils/deviceAccess')

const slaveInclude = {
  configSlave: {
    select: {
      id: true,
      name: true,
      deviceId: true,
      device: { select: { id: true, name: true } },
    },
  },
  device: { select: { id: true, name: true } },
}

/** Resolve interval row + enforce org + USER device ACL. */
const findAccessibleInterval = async (id, user) => {
  const existing = await prisma.intervalHistory.findFirst({
    where: { id, ...orgScope(user) },
    include: slaveInclude,
  })
  if (!existing) return null
  const deviceId = existing.deviceId || existing.configSlave?.deviceId
  if (deviceId) await assertDeviceAccess(deviceId, user)
  return existing
}

// @desc  List interval history; filterable by device / slave / dates; USER ACL-scoped
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getIntervalHistory = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user) }
    if (req.query.deviceConfigSlaveId) where.deviceConfigSlaveId = req.query.deviceConfigSlaveId
    if (req.query.variableName) where.variableName = req.query.variableName

    if (req.query.startDate || req.query.endDate) {
      if (req.query.startDate) {
        where.endDate = { ...(where.endDate || {}), gte: new Date(req.query.startDate) }
      }
      if (req.query.endDate) {
        where.startDate = { ...(where.startDate || {}), lte: new Date(req.query.endDate) }
      }
    }

    const accessibleIds = await listAccessibleDeviceIds(req.user)
    if (req.query.deviceId) {
      if (accessibleIds && !accessibleIds.includes(req.query.deviceId)) {
        return res.json({ success: true, data: [], total: 0, page, pages: 1 })
      }
      // Match either denormalized deviceId or the slave's device
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { deviceId: req.query.deviceId },
            { configSlave: { deviceId: req.query.deviceId } },
          ],
        },
      ]
    } else if (accessibleIds) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { deviceId: { in: accessibleIds.length ? accessibleIds : ['__none__'] } },
            { configSlave: { deviceId: { in: accessibleIds.length ? accessibleIds : ['__none__'] } } },
          ],
        },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.intervalHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: slaveInclude,
      }),
      prisma.intervalHistory.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) || 1 })
  } catch (err) { next(err) }
}

// @desc  Compute and store an energy cost record for a given date range
// @access SUPER_ADMIN | ORG_ADMIN | USER
const createIntervalHistory = async (req, res, next) => {
  try {
    const { deviceConfigSlaveId, variableName, unitVariableName, startDate, endDate } = req.body
    if (!deviceConfigSlaveId) return next(new AppError('Slave is required', 400))
    if (!variableName) return next(new AppError('Variable name is required', 400))
    if (!startDate || !endDate) return next(new AppError('Start and end dates are required', 400))

    const slave = await prisma.deviceConfigSlave.findUnique({ where: { id: deviceConfigSlaveId } })
    if (!slave) return next(new AppError('Config slave not found', 404))

    await assertDeviceAccess(slave.deviceId, req.user)

    if (req.user.role !== 'SUPER_ADMIN' && slave.organizationId !== req.user.organizationId) {
      return next(new AppError('Access denied', 403))
    }

    // Unit variable drives kWh/tariff math when provided; variableName is the stored label.
    const computeVar = unitVariableName || variableName
    const { totalUnit, tariff } = await computeIntervalCost(deviceConfigSlaveId, computeVar, startDate, endDate)

    const data = await prisma.intervalHistory.create({
      data: {
        organizationId:    req.user.role === 'SUPER_ADMIN' ? slave.organizationId : req.user.organizationId,
        deviceId:          slave.deviceId,
        deviceConfigSlaveId,
        variableName,
        slaveName:         slave.name,
        totalUnit,
        tariff,
        startDate:         new Date(startDate),
        endDate:           new Date(endDate),
        computedAt:        new Date(),
      },
      include: slaveInclude,
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a single interval history record
// @access SUPER_ADMIN | ORG_ADMIN | USER
const deleteIntervalHistory = async (req, res, next) => {
  try {
    const existing = await findAccessibleInterval(req.params.id, req.user)
    if (!existing) return next(new AppError('Interval history record not found', 404))

    await prisma.intervalHistory.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Record deleted' })
  } catch (err) { next(err) }
}

module.exports = { getIntervalHistory, createIntervalHistory, deleteIntervalHistory }
