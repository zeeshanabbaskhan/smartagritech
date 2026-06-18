// ─── Authentication controller (P-49 refresh tokens) ─────────────────────────
const bcrypt      = require('bcryptjs')
const jwt         = require('jsonwebtoken')
const crypto      = require('crypto')
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const transporter  = require('../config/nodemailer')

const ACCESS_EXPIRES  = process.env.JWT_EXPIRES_IN || '15m'
const REFRESH_DAYS    = parseInt(process.env.JWT_REFRESH_DAYS || '30', 10)

const signAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES })

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const issueRefreshToken = async (userId) => {
  const refreshToken = crypto.randomBytes(48).toString('hex')
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000)
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

    const token = signAccessToken(user.id)
    const refreshToken = await issueRefreshToken(user.id)
    res.cookie('token', token, cookieOptions)

    const { passwordHash: _, ...userData } = user
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
    res.clearCookie('token')
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

module.exports = { login, logout, refresh, getMe, forgotPassword, resetPassword, changePassword }
