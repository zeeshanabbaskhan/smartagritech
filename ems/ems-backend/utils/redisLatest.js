// Shared Redis helpers for per-slave hot latest values.
// Keys: device:{deviceId}:latest:{slaveId|none}

const redis = require('../config/redis')

const latestKey = (deviceId, slaveId) =>
  `device:${deviceId}:latest:${slaveId || 'none'}`

/** Legacy unscoped hash written before slave-scoped keys. */
const legacyLatestKey = (deviceId) => `device:${deviceId}:latest`

const scanKeys = async (c, pattern) => {
  const keys = []
  try {
    for await (const key of c.scanIterator({ MATCH: pattern, COUNT: 64 })) {
      keys.push(key)
    }
  } catch (_) {
    // Older clients: manual SCAN
    let cursor = '0'
    do {
      const res = await c.scan(cursor, { MATCH: pattern, COUNT: 64 })
      cursor = String(res.cursor ?? res[0] ?? '0')
      const batch = res.keys ?? res[1] ?? []
      keys.push(...batch)
    } while (cursor !== '0')
  }
  return keys
}

/**
 * Write computed readings into the slave-scoped hot hash.
 * Also mirrors into the legacy device hash for device-list metrics
 * (not used for slave-filtered /latest reads).
 */
const cacheLatestValues = async (deviceId, slaveId, readings) => {
  const c = redis.getClient()
  if (!c || !readings?.length) return
  try {
    const scoped = latestKey(deviceId, slaveId)
    const legacy = legacyLatestKey(deviceId)
    const pipe = c.multi()
    for (const r of readings) {
      if (r.variableName == null) continue
      const val = String(r.value)
      pipe.hSet(scoped, r.variableName, val)
      pipe.hSet(legacy, r.variableName, val)
    }
    pipe.expire(scoped, 3600)
    pipe.expire(legacy, 3600)
    await pipe.exec()
  } catch (_) {}
}

/** Read hot hash for one slave. Does not merge other slaves or legacy. */
const readLatestForSlave = async (deviceId, slaveId) => {
  const c = redis.getClient()
  if (!c) return {}
  try {
    const hot = await c.hGetAll(latestKey(deviceId, slaveId))
    if (hot && Object.keys(hot).length) return hot
    return {}
  } catch (_) {
    return {}
  }
}

/**
 * Merge all slave-scoped hashes for a device (plus legacy if present).
 * Used when no slaveId filter is requested.
 */
const readLatestMerged = async (deviceId) => {
  const c = redis.getClient()
  if (!c) return {}
  try {
    const merged = {}
    const legacy = await c.hGetAll(legacyLatestKey(deviceId))
    Object.assign(merged, legacy || {})

    const keys = await scanKeys(c, `device:${deviceId}:latest:*`)
    for (const key of keys) {
      if (key === legacyLatestKey(deviceId)) continue
      const hot = await c.hGetAll(key)
      Object.assign(merged, hot || {})
    }
    return merged
  } catch (_) {
    try {
      return (await c.hGetAll(legacyLatestKey(deviceId))) || {}
    } catch {
      return {}
    }
  }
}

const readLatest = async (deviceId, slaveId) => {
  if (slaveId) return readLatestForSlave(deviceId, slaveId)
  return readLatestMerged(deviceId)
}

module.exports = {
  latestKey,
  legacyLatestKey,
  cacheLatestValues,
  readLatestForSlave,
  readLatestMerged,
  readLatest,
  scanKeys,
}
