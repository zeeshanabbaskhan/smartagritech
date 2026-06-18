// Periodic flush of Redis latest values → Postgres currentValue (P-09).

const prisma = require('../config/database')
const redis  = require('../config/redis')
const logger = require('../utils/logger')

const FLUSH_MS = parseInt(process.env.VALUE_FLUSH_MS || '60000', 10)
let timer = null

const flushDevice = async (deviceId) => {
  const c = redis.getClient()
  if (!c) return
  const hot = await c.hGetAll(`device:${deviceId}:latest`)
  if (!Object.keys(hot).length) return

  const vars = await prisma.deviceConfigVariable.findMany({
    where:  { deviceId, isActive: true },
    select: { id: true, name: true },
  })
  const byName = Object.fromEntries(vars.map((v) => [v.name, v.id]))
  const now = new Date()
  const updates = []
  for (const [name, value] of Object.entries(hot)) {
    const id = byName[name]
    if (id) updates.push({ id, value })
  }
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
