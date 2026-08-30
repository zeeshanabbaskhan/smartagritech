// Shared Redis helpers for per-slave hot latest values.
// Keys: device:{deviceId}:latest:{slaveId|none}

const redis = require('../config/redis')
const prisma = require('../config/database')

/** Prefer these slave names when a device has multiple MQTT blocks (no blind merge). */
const SLAVE_NAME_PRIORITY = [
  'ficoinverter',
  'main',
  'mainbreaker',
  'mainincomingcf',
  'mainincoming',
  'invertermain',
  'smart',
  'suprafurnace',
  'fico furnace',
  'charger',
]

const latestKey = (deviceId, slaveId) =>
  `device:${deviceId}:latest:${slaveId || 'none'}`

/** Legacy unscoped hash written before slave-scoped keys. */
const legacyLatestKey = (deviceId) => `device:${deviceId}:latest`

const scanKeys = async (c, pattern) => {
  const keys = []
  const pushKey = (key) => keys.push(String(key))
  try {
    for await (const key of c.scanIterator({ MATCH: pattern, COUNT: 64 })) {
      pushKey(key)
    }
  } catch (_) {
    // Older clients: manual SCAN
    let cursor = '0'
    do {
      const res = await c.scan(cursor, { MATCH: pattern, COUNT: 64 })
      cursor = String(res.cursor ?? res[0] ?? '0')
      const batch = res.keys ?? res[1] ?? []
      for (const key of batch) pushKey(key)
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

const resolveDefaultSlaveId = async (deviceId) => {
  const def = await prisma.deviceConfigSlave.findFirst({
    where: { deviceId, isActive: true, isDefault: true },
    select: { id: true },
  })
  if (def?.id) return def.id

  const slaves = await prisma.deviceConfigSlave.findMany({
    where: { deviceId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  if (slaves.length === 1) return slaves[0].id

  for (const pname of SLAVE_NAME_PRIORITY) {
    const s = slaves.find((x) => x.name.trim().toLowerCase() === pname)
    if (s) return s.id
  }
  return slaves[0]?.id ?? null
}

/**
 * Read latest values when no slaveId is specified.
 * Uses the default / primary slave — never merges duplicate variable names across slaves.
 */
const readLatestMerged = async (deviceId) => {
  const c = redis.getClient()
  if (!c) return {}
  try {
    const keys = await scanKeys(c, `device:${deviceId}:latest:*`)
    const scopedKeys = keys.filter(
      (k) => {
        const key = String(k)
        return key !== legacyLatestKey(deviceId) && !key.endsWith(':none')
      },
    )

    if (!scopedKeys.length) {
      return (await c.hGetAll(legacyLatestKey(deviceId))) || {}
    }

    if (scopedKeys.length === 1) {
      const suffix = scopedKeys[0].split(':latest:')[1]
      if (suffix) return readLatestForSlave(deviceId, suffix)
    }

    const slaveId = await resolveDefaultSlaveId(deviceId)
    if (slaveId) {
      const hot = await readLatestForSlave(deviceId, slaveId)
      if (Object.keys(hot).length) return hot
    }

    let best = {}
    for (const key of scopedKeys) {
      const hot = await c.hGetAll(key)
      if (Object.keys(hot).length > Object.keys(best).length) best = hot
    }
    return best
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
