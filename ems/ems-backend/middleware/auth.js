// ─── Authentication + authorization middleware ─────────────────────────────────
const jwt    = require('jsonwebtoken')
const prisma  = require('../config/database')
const { AppError } = require('./errorHandler')
const userCache = require('../utils/userCache')

const extractToken = (req) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return req.cookies?.token
}

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req)
    if (!token) return next(new AppError('Not authenticated', 401))

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const userSelect = { id: true, fullName: true, email: true, role: true, organizationId: true, status: true }
    let user = await userCache.get(decoded.id)
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: decoded.id }, select: userSelect })
      if (user) await userCache.set(decoded.id, user)
    }
    if (!user || user.status === 'DELETED') return next(new AppError('User no longer exists', 401))
    if (user.status === 'INACTIVE')         return next(new AppError('Account inactive', 403))

    req.user = user
    next()
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401))
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403))
  }
  next()
}

module.exports = { protect, authorize, extractToken }
