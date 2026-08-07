// ─── Slab rate controller ─────────────────────────────────────────────────────
// SlabRate defines tiered electricity tariff bands for a DeviceConfigSlave.
// Used by costCalculator to compute interval history costs.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
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
}

/** Resolve slab + enforce org + USER device ACL via the slave's device. */
const findAccessibleSlab = async (id, user) => {
  const existing = await prisma.slabRate.findFirst({
    where: { id, ...orgScope(user) },
    include: slaveInclude,
  })
  if (!existing) return null
  const deviceId = existing.configSlave?.deviceId
  if (deviceId) await assertDeviceAccess(deviceId, user)
  return existing
}

const parseOptionalFloat = (value) => {
  if (value === undefined || value === null || value === '') return null
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

const validateTier = ({ deviceConfigSlaveId, unitFrom, unitTo, rate, onPeakRate, offPeakRate }) => {
  if (!deviceConfigSlaveId) throw new AppError('Slave is required', 400)
  const from = parseFloat(unitFrom)
  const to = parseFloat(unitTo)
  if (!Number.isFinite(from)) throw new AppError('Unit From is required', 400)
  if (!Number.isFinite(to)) throw new AppError('Unit To is required', 400)
  if (to <= from) throw new AppError('Unit To must be greater than Unit From', 400)

  const hasPeak = onPeakRate != null && onPeakRate !== ''
  const hasOff = offPeakRate != null && offPeakRate !== ''
  if (hasPeak || hasOff) {
    const onPeak = parseOptionalFloat(onPeakRate)
    const offPeak = parseOptionalFloat(offPeakRate)
    if (onPeak == null) throw new AppError('On Peak Rate is required for Time-Based rates', 400)
    if (offPeak == null) throw new AppError('Off Peak Rate is required for Time-Based rates', 400)
    return {
      unitFrom: from,
      unitTo: to,
      rate: onPeak,
      onPeakRate: onPeak,
      offPeakRate: offPeak,
    }
  }

  const baseRate = parseFloat(rate)
  if (!Number.isFinite(baseRate)) throw new AppError('Rate is required', 400)
  return {
    unitFrom: from,
    unitTo: to,
    rate: baseRate,
    onPeakRate: null,
    offPeakRate: null,
  }
}

// @desc  List slab rates; filterable by config slave; USER ACL-scoped
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getSlabRates = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user) }
    if (req.query.deviceConfigSlaveId) where.deviceConfigSlaveId = req.query.deviceConfigSlaveId

    const accessibleIds = await listAccessibleDeviceIds(req.user)
    if (req.query.deviceId) {
      if (accessibleIds && !accessibleIds.includes(req.query.deviceId)) {
        return res.json({ success: true, data: [], total: 0, page, pages: 1 })
      }
      where.configSlave = { deviceId: req.query.deviceId }
    } else if (accessibleIds) {
      where.configSlave = {
        deviceId: { in: accessibleIds.length ? accessibleIds : ['__none__'] },
      }
    }

    const [data, total] = await Promise.all([
      prisma.slabRate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { unitFrom: 'asc' },
        include: slaveInclude,
      }),
      prisma.slabRate.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) || 1 })
  } catch (err) { next(err) }
}

// @desc  Create a slab rate tier
// @access SUPER_ADMIN | ORG_ADMIN | USER
const createSlabRate = async (req, res, next) => {
  try {
    const { organizationId, deviceConfigSlaveId, unitFrom, unitTo, rate, onPeakRate, offPeakRate } = req.body
    const tier = validateTier({ deviceConfigSlaveId, unitFrom, unitTo, rate, onPeakRate, offPeakRate })

    const slave = await prisma.deviceConfigSlave.findUnique({ where: { id: deviceConfigSlaveId } })
    if (!slave) return next(new AppError('Slave not found', 404))

    await assertDeviceAccess(slave.deviceId, req.user)

    const orgId = req.user.role === 'SUPER_ADMIN'
      ? (organizationId || slave.organizationId)
      : req.user.organizationId

    if (req.user.role !== 'SUPER_ADMIN' && slave.organizationId !== orgId) {
      return next(new AppError('Access denied', 403))
    }

    const data = await prisma.slabRate.create({
      data: {
        organizationId: orgId,
        deviceConfigSlaveId,
        ...tier,
        createdBy: req.user.id,
      },
      include: slaveInclude,
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a slab rate tier
// @access SUPER_ADMIN | ORG_ADMIN | USER
const updateSlabRate = async (req, res, next) => {
  try {
    const existing = await findAccessibleSlab(req.params.id, req.user)
    if (!existing) return next(new AppError('Slab rate not found', 404))

    const {
      deviceConfigSlaveId = existing.deviceConfigSlaveId,
      unitFrom,
      unitTo,
      rate,
      onPeakRate,
      offPeakRate,
    } = req.body

    const tier = validateTier({ deviceConfigSlaveId, unitFrom, unitTo, rate, onPeakRate, offPeakRate })

    if (deviceConfigSlaveId !== existing.deviceConfigSlaveId) {
      const slave = await prisma.deviceConfigSlave.findUnique({ where: { id: deviceConfigSlaveId } })
      if (!slave) return next(new AppError('Slave not found', 404))
      await assertDeviceAccess(slave.deviceId, req.user)
      if (req.user.role !== 'SUPER_ADMIN' && slave.organizationId !== req.user.organizationId) {
        return next(new AppError('Access denied', 403))
      }
    }

    const data = await prisma.slabRate.update({
      where: { id: req.params.id },
      data: {
        deviceConfigSlaveId,
        ...tier,
      },
      include: slaveInclude,
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a slab rate tier
// @access SUPER_ADMIN | ORG_ADMIN | USER
const deleteSlabRate = async (req, res, next) => {
  try {
    const existing = await findAccessibleSlab(req.params.id, req.user)
    if (!existing) return next(new AppError('Slab rate not found', 404))

    await prisma.slabRate.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Slab rate deleted' })
  } catch (err) { next(err) }
}

module.exports = { getSlabRates, createSlabRate, updateSlabRate, deleteSlabRate }
