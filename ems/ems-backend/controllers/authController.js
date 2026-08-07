// ─── Authentication controller (P-49 refresh tokens) ─────────────────────────
const bcrypt      = require('bcryptjs')
const jwt         = require('jsonwebtoken')
const crypto      = require('crypto')
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const transporter  = require('../config/nodemailer')

const ACCESS_EXPIRES  = process.env.JWT_EXPIRES_IN || '8h'
const REFRESH_DAYS    = parseInt(process.env.JWT_REFRESH_DAYS || '30', 10)

const signAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES })

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const issueRefreshToken = async (userId, { days } = {}) => {
  const refreshToken = crypto.randomBytes(48).toString('hex')
  const ttlDays = days != null ? days : REFRESH_DAYS
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt },
  })
  return refreshToken
}

const cookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   REFRESH_DAYS * 24 * 60 * 60 * 1000,
}

const clearCookieOptions = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
}

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return next(new AppError('Email and password are required', 400))

    const user = await prisma.user.findUnique({
      where:  { email: email.toLowerCase().trim() },
      select: {
        id: true, fullName: true, email: true, passwordHash: true,
        role: true, organizationId: true, status: true,
      },
    })

    if (!user || user.status === 'DELETED') return next(new AppError('Invalid credentials', 401))
    if (user.status === 'INACTIVE')         return next(new AppError('Account inactive', 403))

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return next(new AppError('Invalid credentials', 401))

    const userCache = require('../utils/userCache')
    await userCache.invalidate(user.id)

    const token = signAccessToken(user.id)
    const refreshToken = await issueRefreshToken(user.id)
    res.cookie('token', token, cookieOptions)

    const { passwordHash: _, ...userData } = user
    await userCache.set(user.id, userData)
    res.json({ success: true, data: userData, token, refreshToken })
  } catch (err) { next(err) }
}

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return next(new AppError('refreshToken is required', 400))

    const record = await prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(refreshToken), expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, fullName: true, email: true, role: true, organizationId: true, status: true } } },
    })
    if (!record || record.user.status === 'DELETED' || record.user.status === 'INACTIVE') {
      return next(new AppError('Invalid refresh token', 401))
    }

    await prisma.refreshToken.delete({ where: { id: record.id } })
    const token = signAccessToken(record.user.id)
    const newRefresh = await issueRefreshToken(record.user.id)
    res.cookie('token', token, cookieOptions)
    res.json({ success: true, token, refreshToken: newRefresh, data: record.user })
  } catch (err) { next(err) }
}

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } }).catch(() => {})
    }
    res.clearCookie('token', clearCookieOptions)
    res.json({ success: true, message: 'Logged out' })
  } catch (err) { next(err) }
}

const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: {
        id: true, fullName: true, email: true, role: true, organizationId: true, status: true,
        organization: {
          select: { id: true, name: true, description: true, status: true, logoUrl: true, themeId: true },
        },
      },
    })
    if (!user) return next(new AppError('User not found', 404))
    const userCache = require('../utils/userCache')
    await userCache.set(user.id, {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      status: user.status,
    })
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
}

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return next(new AppError('Email is required', 400))

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user) return res.json({ success: true, message: 'If that email exists, a reset code was sent.' })

    const code      = crypto.randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.passwordResetCode.create({ data: { userId: user.id, code, expiresAt } })

    try {
      await transporter.sendMail({
        from:    process.env.EMAIL_FROM || process.env.NODEMAILER_USER,
        to:      user.email,
        subject: 'EMS Password Reset Code',
        text:    `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
      })
    } catch (_) {}

    res.json({ success: true, message: 'If that email exists, a reset code was sent.' })
  } catch (err) { next(err) }
}

const resetPassword = async (req, res, next) => {
  try {
    const { userId, code, newPassword } = req.body
    if (!userId || !code || !newPassword) {
      return next(new AppError('userId, code, and newPassword are required', 400))
    }

    const record = await prisma.passwordResetCode.findFirst({
      where: { userId, code, used: false, expiresAt: { gt: new Date() } },
    })
    if (!record) return next(new AppError('Invalid or expired reset code', 400))

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.passwordResetCode.update({ where: { id: record.id }, data: { used: true } }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
    ])

    res.json({ success: true, message: 'Password reset successfully' })
  } catch (err) { next(err) }
}

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return next(new AppError('currentPassword and newPassword are required', 400))
    }
    if (newPassword.length < 8) {
      return next(new AppError('New password must be at least 8 characters', 400))
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true, status: true },
    })
    if (!user || user.status === 'DELETED') return next(new AppError('User not found', 404))

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return next(new AppError('Current password is incorrect', 400))

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ])

    res.json({ success: true, message: 'Password changed successfully' })
  } catch (err) { next(err) }
}

const USER_PUBLIC_SELECT = {
  id: true, fullName: true, email: true, role: true, organizationId: true, status: true,
  organization: { select: { id: true, name: true, status: true, logoUrl: true, themeId: true } },
}

/** Issue tokens for a target user (same shape as login). Used by impersonation. */
const issueSessionForUser = async (user, res) => {
  const userCache = require('../utils/userCache')
  await userCache.invalidate(user.id)
  const token = signAccessToken(user.id)
  // Short-lived refresh for impersonation sessions
  const refreshToken = await issueRefreshToken(user.id, { days: 1 })
  res.cookie('token', token, cookieOptions)
  const userData = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    status: user.status,
    organization: user.organization ?? undefined,
  }
  await userCache.set(user.id, {
    id: userData.id,
    fullName: userData.fullName,
    email: userData.email,
    role: userData.role,
    organizationId: userData.organizationId,
    status: userData.status,
  })
  return { userData, token, refreshToken }
}

// @desc  Super Admin logs in as a specific user / org admin
// @access SUPER_ADMIN
const impersonateUser = async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: USER_PUBLIC_SELECT,
    })
    if (!target || target.status === 'DELETED') {
      return next(new AppError('User not found', 404))
    }
    if (target.status === 'INACTIVE') {
      return next(new AppError('Cannot login as an inactive account', 403))
    }
    if (target.role === 'SUPER_ADMIN') {
      return next(new AppError('Cannot login as another Super Admin', 403))
    }
    if (target.id === req.user.id) {
      return next(new AppError('Already logged in as this user', 400))
    }

    const { userData, token, refreshToken } = await issueSessionForUser(target, res)
    res.json({
      success: true,
      data: userData,
      token,
      refreshToken,
      impersonatedBy: req.user.id,
    })
  } catch (err) { next(err) }
}

// @desc  Super Admin logs in as the Org Admin for an organization
// @access SUPER_ADMIN
const impersonateOrganization = async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.organizationId },
      select: { id: true, name: true, status: true },
    })
    if (!org) return next(new AppError('Organization not found', 404))
    if (org.status === 'INACTIVE') {
      return next(new AppError('Organization is not active', 403))
    }

    const target = await prisma.user.findFirst({
      where: {
        organizationId: org.id,
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'asc' },
      select: USER_PUBLIC_SELECT,
    })
    if (!target) {
      return next(new AppError('No active Org Admin found for this organization', 404))
    }

    const { userData, token, refreshToken } = await issueSessionForUser(target, res)
    res.json({
      success: true,
      data: userData,
      token,
      refreshToken,
      impersonatedBy: req.user.id,
    })
  } catch (err) { next(err) }
}

module.exports = {
  login, logout, refresh, getMe, forgotPassword, resetPassword, changePassword,
  impersonateUser, impersonateOrganization,
}
