// ─── Rate limiters (P-23, P-24, P-25, P-26) ────────────────────────────────
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const redis     = require('../config/redis')

const buildStore = (prefix) => {
  const client = redis.getClient()
  if (!client) return undefined
  try {
    const { RedisStore } = require('rate-limit-redis')
    return new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
      prefix:      `rl:${prefix}:`,
    })
  } catch (_) {
    return undefined
  }
}

const makeLimiter = (prefix, windowMs, max, message, opts = {}) => {
  const store = buildStore(prefix)
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    ...(store ? { store } : {}),
    ...opts,
  })
}

/** General API — 400 requests per 15 minutes per IP */
const apiLimiter = makeLimiter('api', 15 * 60 * 1000, 400, 'Too many requests, please try again later.')

/** IoT ingest — per device when body present, else per IP (P-24) */
const deviceIngestLimiter = makeLimiter(
  'ingest-device',
  60 * 1000,
  parseInt(process.env.INGEST_DEVICE_MAX_PER_MIN || '120', 10),
  'Ingest rate limit exceeded for this device.',
  {
    keyGenerator: (req) => {
      const deviceId = req.body?.deviceId
      if (deviceId) return `device:${deviceId}`
      return ipKeyGenerator(req.ip)
    },
  }
)

/** Legacy IP-based ingest limiter */
const ingestLimiter = makeLimiter('ingest', 60 * 1000, 1000, 'Ingest rate limit exceeded.')

/** Login — 5 attempts per 15 minutes per IP */
const loginLimiter = makeLimiter('login', 15 * 60 * 1000, 5, 'Too many login attempts. Try again later.')

/** Forgot password — 3 attempts per hour per IP */
const forgotPasswordLimiter = makeLimiter('forgot', 60 * 60 * 1000, 3, 'Too many password reset requests. Try again later.')

module.exports = { apiLimiter, ingestLimiter, deviceIngestLimiter, loginLimiter, forgotPasswordLimiter }
