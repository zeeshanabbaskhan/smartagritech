// ─── Centralised error handling ───────────────────────────────────────────────
const { Prisma } = require('@prisma/client')

class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    Error.captureStackTrace(this, this.constructor)
  }
}

/** Map Prisma known errors to HTTP status codes (P-54). */
const mapPrismaError = (err) => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null
  switch (err.code) {
    case 'P2002':
      return new AppError('A record with this value already exists', 409)
    case 'P2025':
      return new AppError('Record not found', 404)
    case 'P2003':
      return new AppError('Invalid reference — related record not found', 400)
    case 'P2014':
      return new AppError('Invalid relation — required relation missing', 400)
    default:
      return new AppError('Database operation failed', 400)
  }
}

const errorHandler = (err, req, res, next) => {
  const mapped   = mapPrismaError(err)
  const resolved = mapped || err
  const statusCode = resolved.statusCode || 500
  const message    = resolved.message    || 'Internal server error'

  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack)
  }

  res.status(statusCode).json({ success: false, message })
}

module.exports = { errorHandler, AppError }
