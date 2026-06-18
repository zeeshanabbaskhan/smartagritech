// ─── Slab rate controller ─────────────────────────────────────────────────────
// SlabRate defines tiered electricity tariff bands for a DeviceConfigSlave.
// Used by costCalculator to compute interval history costs.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')

// @desc  List slab rates; filterable by config slave
// @access SUPER_ADMIN | ORG_ADMIN
const getSlabRates = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user) }
    if (req.query.deviceConfigSlaveId) where.deviceConfigSlaveId = req.query.deviceConfigSlaveId

    const [data, total] = await Promise.all([
      prisma.slabRate.findMany({ where, skip, take: limit, orderBy: { unitFrom: 'asc' } }),
      prisma.slabRate.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a slab rate tier
// @access SUPER_ADMIN | ORG_ADMIN
const createSlabRate = async (req, res, next) => {
  try {
    const { organizationId, deviceConfigSlaveId, unitFrom, unitTo, rate, onPeakRate, offPeakRate } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId

    const data = await prisma.slabRate.create({
      data: {
        organizationId:      orgId,
        deviceConfigSlaveId,
        unitFrom:    parseFloat(unitFrom),
        unitTo:      parseFloat(unitTo),
        rate:        parseFloat(rate),
        onPeakRate:  onPeakRate  != null ? parseFloat(onPeakRate)  : null,
        offPeakRate: offPeakRate != null ? parseFloat(offPeakRate) : null,
        createdBy:   req.user.id,
      },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a slab rate tier
// @access SUPER_ADMIN | ORG_ADMIN
const updateSlabRate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.slabRate.findFirst({ where })
    if (!existing) return next(new AppError('Slab rate not found', 404))

    const { unitFrom, unitTo, rate, onPeakRate, offPeakRate } = req.body
    const data = await prisma.slabRate.update({
      where: { id: req.params.id },
      data: {
        unitFrom:    parseFloat(unitFrom),
        unitTo:      parseFloat(unitTo),
        rate:        parseFloat(rate),
        onPeakRate:  onPeakRate  != null ? parseFloat(onPeakRate)  : null,
        offPeakRate: offPeakRate != null ? parseFloat(offPeakRate) : null,
      },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a slab rate tier
// @access SUPER_ADMIN | ORG_ADMIN
const deleteSlabRate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.slabRate.findFirst({ where })
    if (!existing) return next(new AppError('Slab rate not found', 404))

    await prisma.slabRate.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Slab rate deleted' })
  } catch (err) { next(err) }
}

module.exports = { getSlabRates, createSlabRate, updateSlabRate, deleteSlabRate }
