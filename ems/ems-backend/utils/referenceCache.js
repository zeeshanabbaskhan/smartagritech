// Reference data cache L3 (P-20, P-22) — templates, gateways per org.

const redis = require('../config/redis')

const TTL_SEC = parseInt(process.env.REF_CACHE_TTL_SEC || '300', 10)

const get = async (key) => {
  const c = redis.getClient()
  if (!c) return null
  try {
    const raw = await c.get(`ref:${key}`)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

const set = async (key, value) => {
  const c = redis.getClient()
  if (!c) return
  try {
    await c.setEx(`ref:${key}`, TTL_SEC, JSON.stringify(value))
  } catch (_) {}
}

const invalidateOrg = async (organizationId) => {
  const c = redis.getClient()
  if (!c || !organizationId) return
  try {
    const keys = await c.keys(`ref:org:${organizationId}:*`)
    if (keys.length) await c.del(keys)
  } catch (_) {}
}

const invalidateTemplate = async (templateId) => {
  const c = redis.getClient()
  if (!c || !templateId) return
  try {
    await c.del(`ref:template:${templateId}`)
  } catch (_) {}
}

module.exports = { get, set, invalidateOrg, invalidateTemplate }
