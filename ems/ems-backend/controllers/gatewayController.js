// ─── Gateway controller ───────────────────────────────────────────────────────
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const refCache = require('../utils/referenceCache')

// The gateways list is cached per org bucket (see getGateways). Any create /
// update / delete must clear that org's cache so the next fetch is fresh —
// otherwise a deleted gateway keeps reappearing until the TTL expires.
const invalidateGatewayCaches = async (organizationId) => {
  if (organizationId) await refCache.invalidateOrg(organizationId)
}

// @desc  List gateways; response headers carry online/offline counts
// @access SUPER_ADMIN | ORG_ADMIN
const getGateways = async (req, res, next) => {
  try {
    const orgId = req.user.role === 'SUPER_ADMIN' ? req.query.organizationId : req.user.organizationId
    const cacheKey = orgId ? `org:${orgId}:gateways:${req.query.page || 1}` : null
    if (cacheKey) {
      const hit = await refCache.get(cacheKey)
      if (hit) return res.json(hit)
    }

    const { page, limit, skip }            = paginate(req.query)
    const { search, status, organizationId } = req.query

    const where = { ...orgScope(req.user, organizationId) }
    if (status) where.status = status
    if (search) where.OR = [
      { name:         { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
    ]

    const scope = orgScope(req.user, organizationId)
    const [data, total, totalOnline, totalOffline] = await Promise.all([
      prisma.gateway.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { organization: { select: { id: true, name: true } } },
      }),
      prisma.gateway.count({ where }),
      prisma.gateway.count({ where: { ...scope, status: 'ONLINE' } }),
      prisma.gateway.count({ where: { ...scope, status: 'OFFLINE' } }),
    ])

    res.set('X-Total-Online',  String(totalOnline))
    res.set('X-Total-Offline', String(totalOffline))
    const payload = { success: true, data, total, page, pages: Math.ceil(total / limit) }
    if (cacheKey) await refCache.set(cacheKey, payload)
    res.json(payload)
  } catch (err) { next(err) }
}

// @desc  Get a single gateway by id
// @access SUPER_ADMIN | ORG_ADMIN
const getGateway = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const data  = await prisma.gateway.findFirst({
      where,
      include: { organization: { select: { id: true, name: true } } },
    })
    if (!data) return next(new AppError('Gateway not found', 404))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Create a gateway
// @access SUPER_ADMIN | ORG_ADMIN
const createGateway = async (req, res, next) => {
  try {
    const { name, serialNumber, model, status, organizationId } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId
    const data  = await prisma.gateway.create({ data: { name, serialNumber, model, status, organizationId: orgId } })
    await invalidateGatewayCaches(orgId)
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a gateway's details
// @access SUPER_ADMIN | ORG_ADMIN
const updateGateway = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.gateway.findFirst({ where })
    if (!existing) return next(new AppError('Gateway not found', 404))

    const { name, serialNumber, model, status } = req.body
    const data = await prisma.gateway.update({ where: { id: req.params.id }, data: { name, serialNumber, model, status } })
    await invalidateGatewayCaches(existing.organizationId)
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a gateway; blocked when devices are still attached
// @access SUPER_ADMIN | ORG_ADMIN
const deleteGateway = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.gateway.findFirst({ where })
    if (!existing) return next(new AppError('Gateway not found', 404))

    const count = await prisma.device.count({ where: { gatewayId: req.params.id } })
    if (count) return next(new AppError('Cannot delete: gateway has devices attached.', 400))

    await prisma.gateway.delete({ where: { id: req.params.id } })
    await invalidateGatewayCaches(existing.organizationId)
    res.json({ success: true, message: 'Gateway deleted' })
  } catch (err) { next(err) }
}

// @desc  Link a device to this gateway
// @access SUPER_ADMIN | ORG_ADMIN
const linkDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.body
    const data = await prisma.device.update({ where: { id: deviceId }, data: { gatewayId: req.params.id } })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

module.exports = { getGateways, getGateway, createGateway, updateGateway, deleteGateway, linkDevice }
