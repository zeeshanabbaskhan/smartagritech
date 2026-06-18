// ─── Ingest persistence service ───────────────────────────────────────────────
// P-06 bulk SQL, P-09 Redis latest + optional PG skip, P-14 narrow values, P-29 device room emit.

const crypto = require('crypto')
const prisma = require('../config/database')
const redis  = require('../config/redis')
const { markDirty } = require('./valueFlushService')

const enqueueAnomaly = (payload) => {
  try {
    require('../workers/jobQueues').enqueueAnomalyCheck(payload)
  } catch (err) {
    require('./anomalyDetector').runAnomalyCheck(payload).catch(() => {})
  }
}

const EMIT_DEBOUNCE_MS = 1000
const lastEmitByDevice = new Map()
const skipPgCurrentValue = () =>
  redis.isEnabled() && process.env.SKIP_PG_CURRENT_VALUE !== 'false'

const cacheLatestValues = async (deviceId, readings) => {
  const c = redis.getClient()
  if (!c) return
  try {
    const key = `device:${deviceId}:latest`
    const pipe = c.multi()
    for (const r of readings) {
      if (r.variableName != null) pipe.hSet(key, r.variableName, String(r.value))
    }
    pipe.expire(key, 3600)
    await pipe.exec()
    await markDirty(deviceId)
  } catch (_) {}
}

const emitReading = (organizationId, deviceId, readings, now) => {
  let io = null
  try {
    const { getIO } = require('../socket')
    io = getIO()
    const last = lastEmitByDevice.get(deviceId) || 0
    if (Date.now() - last >= EMIT_DEBOUNCE_MS) {
      // P-29: device room only for readings; org room reserved for alarms
      io.to(`device_${deviceId}`).emit('reading:new', { deviceId, readings, timestamp: now })
      lastEmitByDevice.set(deviceId, Date.now())
    }
  } catch (_) {}
  return io
}

const bulkUpdateVariables = async (tx, deviceId, updates, now) => {
  if (!updates.length || skipPgCurrentValue()) return
  await Promise.all(
    updates.map((u) =>
      tx.deviceConfigVariable.update({
        where: { id: u.id, deviceId },
        data: { currentValue: String(u.value), lastUpdatedAt: now, updatedAt: now },
      })
    )
  )
}

const buildVarUpdates = (configVars, readings) => {
  const configVarByName = Object.fromEntries(configVars.map((v) => [v.name, v]))
  const varUpdates = []
  for (const r of readings) {
    const cv = configVarByName[r.variableName]
    if (!cv) continue
    varUpdates.push({ id: cv.id, value: r.value })
  }
  return varUpdates
}

const insertReadingValues = async (tx, sensorReadingId, payload, now) => {
  const rows = []
  for (const r of payload.readings) {
    if (r.variableName == null) continue
    const num = parseFloat(r.value)
    if (Number.isNaN(num)) continue
    rows.push({
      id:                  crypto.randomUUID(),
      sensorReadingId,
      deviceId:            payload.deviceId,
      deviceConfigSlaveId: payload.slaveId || null,
      organizationId:      payload.organizationId,
      variableName:        r.variableName,
      value:               num,
      timestamp:           now,
    })
  }
  if (rows.length) await tx.sensorReadingValue.createMany({ data: rows })
}

const persistIngest = async ({ deviceId, slaveId, readings, organizationId }) => {
  const now = Date.now()
  const ts  = new Date(now)

  const configVars = await prisma.deviceConfigVariable.findMany({ where: { deviceId } })
  const varUpdates = buildVarUpdates(configVars, readings)

  const sensorReading = await prisma.$transaction(async (tx) => {
    const reading = await tx.sensorReading.create({
      data: { deviceId, deviceConfigSlaveId: slaveId || null, organizationId, readings, timestamp: ts },
    })
    await tx.device.update({ where: { id: deviceId }, data: { lastDataReceivedAt: ts } })
    await tx.deviceTimestamp.upsert({
      where:  { deviceId },
      update: { lastActiveAt: ts },
      create: { deviceId, organizationId, lastActiveAt: ts },
    })
    await bulkUpdateVariables(tx, deviceId, varUpdates, ts)
    await insertReadingValues(tx, reading.id, { deviceId, slaveId, readings, organizationId }, ts)
    return reading
  })

  await cacheLatestValues(deviceId, readings)
  return { sensorReading, now: ts }
}

/** Batch persist for BullMQ worker (P-08, P-10). */
const processIngestBatch = async (payloads) => {
  if (!payloads.length) return
  if (payloads.length === 1) return processIngest(payloads[0])

  const now = new Date()
  const readingRows = payloads.map((p) => ({
    id:                  crypto.randomUUID(),
    deviceId:            p.deviceId,
    deviceConfigSlaveId: p.slaveId || null,
    organizationId:      p.organizationId,
    readings:            p.readings,
    timestamp:           now,
  }))

  await prisma.sensorReading.createMany({ data: readingRows })

  const valueRows = []
  for (const row of readingRows) {
    const payload = payloads.find((p) => p.deviceId === row.deviceId && p.organizationId === row.organizationId)
    if (!payload) continue
    for (const r of payload.readings) {
      const num = parseFloat(r.value)
      if (r.variableName == null || Number.isNaN(num)) continue
      valueRows.push({
        id:                  crypto.randomUUID(),
        sensorReadingId:     row.id,
        deviceId:            row.deviceId,
        deviceConfigSlaveId: row.deviceConfigSlaveId,
        organizationId:      row.organizationId,
        variableName:        r.variableName,
        value:               num,
        timestamp:           now,
      })
    }
  }
  if (valueRows.length) await prisma.sensorReadingValue.createMany({ data: valueRows })

  if (!skipPgCurrentValue()) {
    const deviceIds = [...new Set(payloads.map((p) => p.deviceId))]
    const allConfigVars = await prisma.deviceConfigVariable.findMany({
      where: { deviceId: { in: deviceIds } },
    })
    const varsByDevice = {}
    for (const v of allConfigVars) {
      if (!varsByDevice[v.deviceId]) varsByDevice[v.deviceId] = []
      varsByDevice[v.deviceId].push(v)
    }
    await prisma.$transaction(async (tx) => {
      for (const p of payloads) {
        const updates = buildVarUpdates(varsByDevice[p.deviceId] ?? [], p.readings)
        await bulkUpdateVariables(tx, p.deviceId, updates, now)
      }
    })
  }

  const deviceIds = [...new Set(payloads.map((p) => p.deviceId))]
  await prisma.$transaction([
    ...deviceIds.map((id) =>
      prisma.device.update({ where: { id }, data: { lastDataReceivedAt: now } })
    ),
    ...deviceIds.map((id) => {
      const orgId = payloads.find((p) => p.deviceId === id).organizationId
      return prisma.deviceTimestamp.upsert({
        where:  { deviceId: id },
        update: { lastActiveAt: now },
        create: { deviceId: id, organizationId: orgId, lastActiveAt: now },
      })
    }),
  ])

  for (const p of payloads) {
    await cacheLatestValues(p.deviceId, p.readings)
    emitReading(p.organizationId, p.deviceId, p.readings, now)
    enqueueAnomaly({
      deviceId: p.deviceId,
      organizationId: p.organizationId,
      readings: p.readings,
    })
  }
}

const processIngest = async ({ deviceId, slaveId, readings, organizationId }) => {
  const { sensorReading, now } = await persistIngest({ deviceId, slaveId, readings, organizationId })
  const io = emitReading(organizationId, deviceId, readings, now)
  enqueueAnomaly({ deviceId, organizationId, readings, io: !!io })
  return sensorReading
}

module.exports = { persistIngest, processIngest, processIngestBatch, cacheLatestValues }
