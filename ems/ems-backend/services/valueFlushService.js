// Periodic flush of Redis latest values → Postgres currentValue (P-09).
// Slave-scoped hashes flush into that slave’s vars only; legacy only when no scoped keys.

const prisma = require('../config/database')
const redis  = require('../config/redis')
const logger = require('../utils/logger')
const { scanKeys, legacyLatestKey } = require('../utils/redisLatest')

const FLUSH_MS = parseInt(process.env.VALUE_FLUSH_MS || '60000', 10)
let timer = null

const applyUpdates = async (deviceId, updates, now) => {
  if (!updates.length) return
  await Promise.all(
    updates.map((u) =>
      prisma.deviceConfigVariable.update({
        where: { id: u.id, deviceId },
        data: { currentValue: String(u.value), lastUpdatedAt: now, updatedAt: now },
      })
    )
  )
}

/** Unique-name map: only names that appear once on the device (safe for unscoped hashes). */
const uniqueNameIdMap = (vars) => {
  const counts = {}
  for (const v of vars) counts[v.name] = (counts[v.name] || 0) + 1
  const byName = {}
  for (const v of vars) {
    if (counts[v.name] === 1) byName[v.name] = v.id
  }
  return byName
}

const flushHashIntoVars = async (deviceId, hot, vars, { uniqueOnly = false } = {}) => {
  if (!Object.keys(hot || {}).length) return
  const byName = uniqueOnly
    ? uniqueNameIdMap(vars)
    : Object.fromEntries(vars.map((v) => [v.name, v.id]))
  const now = new Date()
  const updates = []
  for (const [name, value] of Object.entries(hot)) {
    const id = byName[name]
    if (id) updates.push({ id, value })
  }
  await applyUpdates(deviceId, updates, now)
}

const flushDevice = async (deviceId) => {
  const c = redis.getClient()
  if (!c) return

  const scopedKeys = await scanKeys(c, `device:${deviceId}:latest:*`)
  if (scopedKeys.length) {
    for (const key of scopedKeys) {
      const suffix = key.includes(':latest:') ? key.split(':latest:')[1] : null
      if (!suffix) continue
      const hot = await c.hGetAll(key)
      if (!Object.keys(hot || {}).length) continue

      if (suffix === 'none') {
        const vars = await prisma.deviceConfigVariable.findMany({
          where:  { deviceId, isActive: true },
          select: { id: true, name: true },
        })
        await flushHashIntoVars(deviceId, hot, vars, { uniqueOnly: true })
        continue
      }

      const vars = await prisma.deviceConfigVariable.findMany({
        where:  { deviceId, isActive: true, deviceConfigSlaveId: suffix },
        select: { id: true, name: true },
      })
      await flushHashIntoVars(deviceId, hot, vars, { uniqueOnly: false })
    }
    return
  }

  // Legacy unscoped hash: only when no slave-scoped keys exist.
  const hot = await c.hGetAll(legacyLatestKey(deviceId))
  if (!Object.keys(hot || {}).length) return

  const vars = await prisma.deviceConfigVariable.findMany({
    where:  { deviceId, isActive: true },
    select: { id: true, name: true },
  })
  await flushHashIntoVars(deviceId, hot, vars, { uniqueOnly: true })
}

const flushDirtyDevices = async () => {
  const c = redis.getClient()
  if (!c) return
  try {
    const deviceIds = await c.sMembers('devices:dirty:latest')
    if (!deviceIds.length) return
    for (const deviceId of deviceIds) {
      await flushDevice(deviceId)
    }
    await c.del('devices:dirty:latest')
    logger.info('valueFlush: flushed devices', { count: deviceIds.length })
  } catch (err) {
    logger.error('valueFlush error', { message: err.message })
  }
}

const markDirty = async (deviceId) => {
  const c = redis.getClient()
  if (!c) return
  try {
    await c.sAdd('devices:dirty:latest', deviceId)
  } catch (_) {}
}

const startValueFlush = () => {
  if (timer || !redis.isEnabled()) return
  timer = setInterval(flushDirtyDevices, FLUSH_MS)
  logger.info('valueFlush scheduler started', { intervalMs: FLUSH_MS })
}

const stopValueFlush = () => {
  if (timer) clearInterval(timer)
  timer = null
}

module.exports = { markDirty, flushDevice, startValueFlush, stopValueFlush }
