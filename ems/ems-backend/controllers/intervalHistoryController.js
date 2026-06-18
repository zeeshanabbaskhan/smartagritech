// ─── Interval history controller ──────────────────────────────────────────────
// IntervalHistory stores pre-computed energy cost calculations for a date range.
// Costs are computed on-the-fly against SlabRate tiers by costCalculator service.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const { computeIntervalCost } = require('../services/costCalculator')

// @desc  List interval history records; filterable by config slave
// @access SUPER_ADMIN | ORG_ADMIN
const getIntervalHistory = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user) }
    if (req.query.deviceConfigSlaveId) where.deviceConfigSlaveId = req.query.deviceConfigSlaveId

    const [data, total] = await Promise.all([
      prisma.intervalHistory.findMany({ where, skip, take: limit, orderBy: { startDate: 'desc' } }),
      prisma.intervalHistory.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Compute and store an energy cost record for a given date range
// @access SUPER_ADMIN | ORG_ADMIN
const createIntervalHistory = async (req, res, next) => {
  try {
    const { deviceConfigSlaveId, variableName, startDate, endDate } = req.body

    const slave = await prisma.deviceConfigSlave.findUnique({ where: { id: deviceConfigSlaveId } })
    if (!slave) return next(new AppError('Config slave not found', 404))

    const { totalUnit, tariff } = await computeIntervalCost(deviceConfigSlaveId, variableName, startDate, endDate)

    const data = await prisma.intervalHistory.create({
      data: {
        organizationId:    req.user.role === 'SUPER_ADMIN' ? slave.organizationId : req.user.organizationId,
        deviceConfigSlaveId,
        variableName,
        slaveName:         slave.name,
        totalUnit,
        tariff,
        startDate:         new Date(startDate),
        endDate:           new Date(endDate),
        computedAt:        new Date(),
      },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a single interval history record
// @access SUPER_ADMIN | ORG_ADMIN
const deleteIntervalHistory = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.intervalHistory.findFirst({ where })
    if (!existing) return next(new AppError('Interval history record not found', 404))

    await prisma.intervalHistory.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Record deleted' })
  } catch (err) { next(err) }
}

module.exports = { getIntervalHistory, createIntervalHistory, deleteIntervalHistory }
