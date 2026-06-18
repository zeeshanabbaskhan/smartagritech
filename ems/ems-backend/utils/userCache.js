// User record cache — Redis when available, in-process fallback (P-18, P-19, P-16 cooldown).

const redis = require('../config/redis')

const TTL_MS  = 5 * 60 * 1000
const TTL_SEC = Math.floor(TTL_MS / 1000)
const mem     = new Map()

const redisKey = (userId) => `user:${userId}`

const get = async (userId) => {
  const c = redis.getClient()
  if (c) {
    try {
      const raw = await c.get(redisKey(userId))
      if (raw) return JSON.parse(raw)
    } catch (_) {}
  }
  const entry = mem.get(userId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    mem.delete(userId)
    return null
  }
  return entry.user
}

const set = async (userId, user) => {
  mem.set(userId, { user, expiresAt: Date.now() + TTL_MS })
  const c = redis.getClient()
  if (c) {
    try {
      await c.setEx(redisKey(userId), TTL_SEC, JSON.stringify(user))
    } catch (_) {}
  }
}

const invalidate = async (userId) => {
  if (userId) mem.delete(userId)
  else mem.clear()
  const c = redis.getClient()
  if (!c) return
  try {
    if (userId) await c.del(redisKey(userId))
    else {
      const keys = await c.keys('user:*')
      if (keys.length) await c.del(keys)
    }
  } catch (_) {}
}

/** Anomaly cooldown — cluster-safe when Redis available (P-16). */
const isAnomalyOnCooldown = async (deviceId, triggerId) => {
  const key = `anomaly:cd:${deviceId}:${triggerId}`
  const c = redis.getClient()
  if (c) {
    try {
      const ok = await c.set(key, '1', { NX: true, EX: 300 })
      return ok == null
    } catch (_) {}
  }
  const memKey = `${deviceId}:${triggerId}`
  const last = mem.get(memKey)
  if (last && Date.now() - last < 300_000) return true
  mem.set(memKey, Date.now())
  return false
}

module.exports = { get, set, invalidate, isAnomalyOnCooldown }
