// ─── Organization controller (SUPER_ADMIN) ────────────────────────────────────
const bcrypt     = require('bcryptjs')
const prisma     = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

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

const getOrganization = async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where:   { id: req.params.id },
      include: {
        theme: { select: { id: true, name: true } },
        // All active members (USER + ORG_ADMIN) for super-admin edit/detail
        users: {
          where: { status: { not: 'DELETED' } },
          select: {
            id: true, fullName: true, email: true, role: true,
            status: true, phone: true, createdAt: true,
          },
          orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
        },
      },
    })
    if (!org) return next(new AppError('Organization not found', 404))
    res.json({ success: true, data: org })
  } catch (err) { next(err) }
}

/**
 * Create organisation + optional ORG_ADMIN login.
 * When adminEmail + adminPassword are provided, creates the admin and returns
 * credentials once for sharing.
 */
const createOrganization = async (req, res, next) => {
  try {
    const {
      name, description, status, themeId, logoUrl,
      adminFullName, adminEmail, adminPassword, adminPhone,
    } = req.body

    if (!name?.trim()) return next(new AppError('name is required', 400))

    const wantsAdmin = Boolean(adminEmail || adminPassword || adminFullName)
    if (wantsAdmin) {
      if (!adminEmail?.trim()) return next(new AppError('adminEmail is required to create an org admin', 400))
      if (!adminPassword) return next(new AppError('adminPassword is required to create an org admin', 400))
      if (adminPassword.length < 8) return next(new AppError('adminPassword must be at least 8 characters', 400))

      const existing = await prisma.user.findUnique({
        where: { email: adminEmail.toLowerCase().trim() },
      })
      if (existing) return next(new AppError('Admin email already in use', 400))
    }

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: name.trim(),
          description,
          status: status || 'ACTIVE',
          themeId: themeId || undefined,
          logoUrl: logoUrl || undefined,
        },
      })

      let admin = null
      if (wantsAdmin) {
        const passwordHash = await bcrypt.hash(adminPassword, 12)
        admin = await tx.user.create({
          data: {
            fullName: adminFullName?.trim() || `${org.name} Admin`,
            email: adminEmail.toLowerCase().trim(),
            passwordHash,
            role: 'ORG_ADMIN',
            organizationId: org.id,
            phone: adminPhone || undefined,
            status: 'ACTIVE',
          },
          select: {
            id: true, fullName: true, email: true, role: true,
            organizationId: true, status: true, phone: true,
            createdAt: true,
          },
        })
      }

      return { org, admin }
    })

    const payload = {
      success: true,
      data: result.org,
      admin: result.admin,
    }
    if (result.admin) {
      payload.credentials = {
        email: result.admin.email,
        password: adminPassword,
        role: result.admin.role,
        organizationName: result.org.name,
      }
    }

    res.status(201).json(payload)
  } catch (err) { next(err) }
}

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
