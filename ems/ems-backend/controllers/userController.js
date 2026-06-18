// ─── User management controller ───────────────────────────────────────────────
const bcrypt      = require('bcryptjs')
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const userCache = require('../utils/userCache')

// Fields returned for all user queries (never expose passwordHash)
const USER_SELECT = {
  id: true, fullName: true, email: true, role: true,
  organizationId: true, status: true, phone: true,
  createdAt: true, updatedAt: true,
}

// ─── Handlers ────────────────────────────────────────────────────────────────

// @desc  List users; SUPER_ADMIN may filter by any org via ?organizationId=
// @access SUPER_ADMIN | ORG_ADMIN
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip }       = paginate(req.query)
    const { role, status, search, organizationId } = req.query

    const where = { ...orgScope(req.user, organizationId), status: { not: 'DELETED' } }
    if (role)                  where.role   = role
    if (status && status !== 'DELETED') where.status = status
    if (search) where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email:    { contains: search, mode: 'insensitive' } },
    ]

    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: USER_SELECT }),
      prisma.user.count({ where }),
    ])

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Get a single user by id
// @access SUPER_ADMIN | ORG_ADMIN
const getUser = async (req, res, next) => {
  try {
    const where = { id: req.params.id, status: { not: 'DELETED' }, ...orgScope(req.user) }
    const user  = await prisma.user.findFirst({ where, select: USER_SELECT })
    if (!user) return next(new AppError('User not found', 404))
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
}

// @desc  Create a new user.
//        ORG_ADMIN can only create USER-role accounts within their own org.
// @access SUPER_ADMIN | ORG_ADMIN
const createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role, organizationId, phone } = req.body
    if (!password) return next(new AppError('password is required', 400))

    if (req.user.role === 'ORG_ADMIN' && role && role !== 'USER') {
      return next(new AppError('ORG_ADMIN can only create USER role', 403))
    }

    const orgId    = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) return next(new AppError('Email already in use', 400))

    const passwordHash = await bcrypt.hash(password, 12)
    const data = await prisma.user.create({
      data: {
        fullName, email: email.toLowerCase().trim(), passwordHash,
        role: role || 'USER', organizationId: orgId, phone, status: 'ACTIVE',
      },
      select: USER_SELECT,
    })

    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a user's profile fields.
//        ORG_ADMIN cannot escalate role beyond USER within their org.
// @access SUPER_ADMIN | ORG_ADMIN
const updateUser = async (req, res, next) => {
  try {
    const { fullName, phone, role, status, organizationId } = req.body

    // Prevent ORG_ADMIN from escalating roles
    if (req.user.role === 'ORG_ADMIN' && role && role !== 'USER') {
      return next(new AppError('ORG_ADMIN can only assign USER role', 403))
    }

    const where    = { id: req.params.id, status: { not: 'DELETED' }, ...orgScope(req.user) }
    const existing = await prisma.user.findFirst({ where })
    if (!existing) return next(new AppError('User not found', 404))

    const data = await prisma.user.update({
      where:  { id: req.params.id },
      data:   { fullName, phone, role, status, organizationId },
      select: USER_SELECT,
    })
    await userCache.invalidate(req.params.id)
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Change a user's status (ACTIVE | INACTIVE | DELETED)
// @access SUPER_ADMIN | ORG_ADMIN
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['ACTIVE', 'INACTIVE', 'DELETED'].includes(status)) {
      return next(new AppError('status must be ACTIVE, INACTIVE, or DELETED', 400))
    }

    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.user.findFirst({ where })
    if (!existing) return next(new AppError('User not found', 404))

    const data = await prisma.user.update({ where: { id: req.params.id }, data: { status } })
    await userCache.invalidate(req.params.id)
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Admin-force a password reset for a user (no OTP required)
// @access SUPER_ADMIN | ORG_ADMIN
const adminResetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body
    if (!newPassword) return next(new AppError('newPassword is required', 400))

    const where    = { id: req.params.id, status: { not: 'DELETED' }, ...orgScope(req.user) }
    const existing = await prisma.user.findFirst({ where })
    if (!existing) return next(new AppError('User not found', 404))

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } })
    res.json({ success: true, message: 'Password reset successfully' })
  } catch (err) { next(err) }
}

module.exports = { getUsers, getUser, createUser, updateUser, updateUserStatus, adminResetPassword }
