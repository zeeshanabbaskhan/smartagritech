// ─── Redis response cache (P-21) ─────────────────────────────────────────────
const redis = require('../config/redis')

const getJson = async (key) => {
  const c = redis.getClient()
  if (!c) return null
  try {
    const raw = await c.get(key)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

const setJson = async (key, value, ttlSec) => {
  const c = redis.getClient()
  if (!c) return
  try {
    await c.setEx(key, ttlSec, JSON.stringify(value))
  } catch (_) {}
}

/** Run fn() and cache the result for ttlSec seconds when Redis is available. */
const cached = async (key, ttlSec, fn) => {
  const hit = await getJson(key)
  if (hit !== null) return hit
  const result = await fn()
  await setJson(key, result, ttlSec)
  return result
}

module.exports = { cached, getJson, setJson }
