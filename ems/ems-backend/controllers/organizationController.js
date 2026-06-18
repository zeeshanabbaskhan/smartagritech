// ─── Organization controller (SUPER_ADMIN) ────────────────────────────────────
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

// @desc  List all organisations; supports search by name and status filter
// @access SUPER_ADMIN
const getOrganizations = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const { search, status }    = req.query

    const where = {}
    if (status) where.status = status
    if (search) where.name   = { contains: search, mode: 'insensitive' }

    const [data, total] = await Promise.all([
      prisma.organization.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { theme: { select: { id: true, name: true } } },
      }),
      prisma.organization.count({ where }),
    ])

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Get a single organisation by id
// @access SUPER_ADMIN
const getOrganization = async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where:   { id: req.params.id },
      include: { theme: { select: { id: true, name: true } } },
    })
    if (!org) return next(new AppError('Organization not found', 404))
    res.json({ success: true, data: org })
  } catch (err) { next(err) }
}

// @desc  Create a new organisation
// @access SUPER_ADMIN
const createOrganization = async (req, res, next) => {
  try {
    const { name, description, status, themeId, logoUrl } = req.body
    const data = await prisma.organization.create({ data: { name, description, status, themeId, logoUrl } })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update an organisation's details
// @access SUPER_ADMIN
const updateOrganization = async (req, res, next) => {
  try {
    const { name, description, status, themeId, logoUrl } = req.body
    const data = await prisma.organization.update({
      where: { id: req.params.id },
      data:  { name, description, status, themeId, logoUrl },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Soft-delete an organisation (sets status INACTIVE).
//        Blocked when the org still has active devices, users, or gateways.
// @access SUPER_ADMIN
const deleteOrganization = async (req, res, next) => {
  try {
    const [deviceCount, userCount, gatewayCount] = await Promise.all([
      prisma.device.count({ where: { organizationId: req.params.id } }),
      prisma.user.count({ where: { organizationId: req.params.id, status: { not: 'DELETED' } } }),
      prisma.gateway.count({ where: { organizationId: req.params.id } }),
    ])

    if (deviceCount || userCount || gatewayCount) {
      return next(new AppError('Cannot delete: organisation has active devices, users, or gateways.', 400))
    }

    const data = await prisma.organization.update({
      where: { id: req.params.id },
      data:  { status: 'INACTIVE' },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

module.exports = { getOrganizations, getOrganization, createOrganization, updateOrganization, deleteOrganization }
