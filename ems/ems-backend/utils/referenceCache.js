// Reference data cache (templates, gateways per org).
// Writes are indexed so invalidation works even when Redis KEYS is disabled.

const redis = require('../config/redis')

const TTL_SEC = parseInt(process.env.REF_CACHE_TTL_SEC || '30', 10)

const redisKey = (key) => `ref:${key}`
const orgIndexKey = (organizationId) => `ref:index:org:${organizationId}`

const get = async (key) => {
  const c = redis.getClient()
  if (!c) return null
  try {
    const raw = await c.get(redisKey(key))
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

const set = async (key, value) => {
  const c = redis.getClient()
  if (!c || TTL_SEC <= 0) return
  try {
    const full = redisKey(key)
    await c.setEx(full, TTL_SEC, JSON.stringify(value))

    // Index by org so invalidateOrg does not rely on KEYS
    const match = String(key).match(/^org:([^:]+):/)
    if (match) {
      const idx = orgIndexKey(match[1])
      await c.sAdd(idx, full)
      await c.expire(idx, TTL_SEC + 60)
    }
  } catch (_) {}
}

const delKeys = async (c, keys) => {
  if (!keys?.length) return
  // node-redis v4: del accepts variadic keys
  await c.del(keys)
}

/** SCAN fallback when index is missing / KEYS is blocked. */
const scanDelete = async (c, pattern) => {
  try {
    for await (const key of c.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await c.del(key)
    }
  } catch (_) {
    // Last resort — may be denied on locked-down Redis
    try {
      const keys = await c.keys(pattern)
      await delKeys(c, keys)
    } catch (__) {}
  }
}

const invalidateOrg = async (organizationId) => {
  const c = redis.getClient()
  if (!c || !organizationId) return
  try {
    const idx = orgIndexKey(organizationId)
    const indexed = await c.sMembers(idx)
    if (indexed.length) await delKeys(c, indexed)
    await c.del(idx)
    await scanDelete(c, `ref:org:${organizationId}:*`)
  } catch (_) {}
}

const invalidateTemplate = async (templateId) => {
  const c = redis.getClient()
  if (!c || !templateId) return
  try {
    await c.del(redisKey(`template:${templateId}`))
  } catch (_) {}
}

/** Clear every org list cache (super-admin + all orgs). */
const invalidateAll = async () => {
  const c = redis.getClient()
  if (!c) return
  try {
    await scanDelete(c, 'ref:org:*')
    await scanDelete(c, 'ref:index:org:*')
    await scanDelete(c, 'ref:template:*')
  } catch (_) {}
}

module.exports = { get, set, invalidateOrg, invalidateTemplate, invalidateAll }
