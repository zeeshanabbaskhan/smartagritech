// Ingest API key validation — global fallback + per-device keys (P-47).

const crypto = require('crypto')
const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex')

const safeEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

const validateIngestKey = async (apiKey, deviceId) => {
  if (!apiKey) throw new AppError('Invalid API key', 401)

  const globalKey = process.env.INGEST_API_KEY
  if (globalKey && safeEqual(apiKey, globalKey)) return true

  if (!deviceId) throw new AppError('Invalid API key', 401)

  const device = await prisma.device.findUnique({
    where:  { id: deviceId },
    select: { ingestApiKeyHash: true },
  })
  if (!device?.ingestApiKeyHash) throw new AppError('Invalid API key', 401)

  const hash = hashKey(apiKey)
  if (!safeEqual(hash, device.ingestApiKeyHash)) throw new AppError('Invalid API key', 401)
  return true
}

const generateDeviceIngestKey = () => crypto.randomBytes(24).toString('hex')

module.exports = { hashKey, validateIngestKey, generateDeviceIngestKey }
