// ─── Ingest persistence service ───────────────────────────────────────────────
// P-06 bulk SQL, P-09 Redis latest + optional PG skip, P-14 narrow values, P-29 device room emit.
// Formulas: acquisition (=s/100) + equation (Slave$$Var) applied before currentValue writes.

const crypto = require('crypto')
const prisma = require('../config/database')
const redis  = require('../config/redis')
const { markDirty } = require('./valueFlushService')
const { applyIngestFormulas, CONFIG_VAR_INCLUDE } = require('../utils/applyIngestFormulas')
const { cacheLatestValues: writeLatestCache } = require('../utils/redisLatest')

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

const cacheLatestValues = async (deviceId, slaveId, readings) => {
  try {
    await writeLatestCache(deviceId, slaveId, readings)
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

const buildVarUpdates = (configVars, readings, slaveId) => {
  const scoped = slaveId
    ? configVars.filter((v) => v.deviceConfigSlaveId === slaveId)
    : configVars
  const configVarByName = Object.fromEntries(scoped.map((v) => [v.name, v]))
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

const loadConfigVars = (deviceId) =>
  prisma.deviceConfigVariable.findMany({
    where: { deviceId },
    include: CONFIG_VAR_INCLUDE,
  })

const persistIngest = async ({ deviceId, slaveId, readings, organizationId }) => {
  const now = Date.now()
  const ts  = new Date(now)

  const configVars = await loadConfigVars(deviceId)
  // Raw stays in SensorReading.readings; computed drives currentValue / values / redis / socket
  const computed = applyIngestFormulas(configVars, readings, slaveId)
  const varUpdates = buildVarUpdates(configVars, computed, slaveId)

  const sensorReading = await prisma.$transaction(async (tx) => {
    const reading = await tx.sensorReading.create({
      data: { deviceId, deviceConfigSlaveId: slaveId || null, organizationId, readings, timestamp: ts },
    })
    const existing = await tx.device.findUnique({
      where: { id: deviceId },
      select: { switchState: true, gatewayId: true },
    })
    const goOnline = existing?.switchState !== 'OFF'
    await tx.device.update({
      where: { id: deviceId },
      data: {
        lastDataReceivedAt: ts,
        ...(goOnline ? { status: 'ONLINE' } : {}),
      },
    })
    await tx.deviceTimestamp.upsert({
      where:  { deviceId },
      update: { lastActiveAt: ts },
      create: { deviceId, organizationId, lastActiveAt: ts },
    })
    await bulkUpdateVariables(tx, deviceId, varUpdates, ts)
    await insertReadingValues(tx, reading.id, { deviceId, slaveId, readings: computed, organizationId }, ts)
    return { reading, goOnline, gatewayId: existing?.gatewayId || null }
  })

  await cacheLatestValues(deviceId, slaveId, computed)
  if (sensorReading.goOnline) {
    try {
      const { emitDeviceStatus, touchGatewayOnline } = require('./devicePresenceService')
      emitDeviceStatus(organizationId, deviceId, 'ONLINE', {
        reason: 'ingest',
        lastDataReceivedAt: ts,
      })
      if (sensorReading.gatewayId) {
        // Outside the device transaction — gateway touch is best-effort presence
        await touchGatewayOnline(sensorReading.gatewayId, ts)
      }
    } catch (_) {}
  }
  return {
    sensorReading: sensorReading.reading,
    now: ts,
    goOnline: sensorReading.goOnline,
    computedReadings: computed,
  }
}

/** Batch persist for BullMQ worker (P-08, P-10). */
const processIngestBatch = async (payloads) => {
  if (!payloads.length) return
  if (payloads.length === 1) return processIngest(payloads[0])

  const now = new Date()
  const deviceIds = [...new Set(payloads.map((p) => p.deviceId))]
  const allConfigVars = await prisma.deviceConfigVariable.findMany({
    where: { deviceId: { in: deviceIds } },
    include: CONFIG_VAR_INCLUDE,
  })
  const varsByDevice = {}
  for (const v of allConfigVars) {
    if (!varsByDevice[v.deviceId]) varsByDevice[v.deviceId] = []
    varsByDevice[v.deviceId].push(v)
  }

  const computedByPayload = payloads.map((p) => ({
    ...p,
    computed: applyIngestFormulas(varsByDevice[p.deviceId] ?? [], p.readings, p.slaveId),
  }))

  const readingRows = payloads.map((p) => ({
    id:                  crypto.randomUUID(),
    deviceId:            p.deviceId,
    deviceConfigSlaveId: p.slaveId || null,
    organizationId:      p.organizationId,
    readings:            p.readings, // raw
    timestamp:           now,
  }))

  await prisma.sensorReading.createMany({ data: readingRows })

  const valueRows = []
  for (let i = 0; i < readingRows.length; i++) {
    const row = readingRows[i]
    const computed = computedByPayload[i].computed
    for (const r of computed) {
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
    await prisma.$transaction(async (tx) => {
      for (const p of computedByPayload) {
        const updates = buildVarUpdates(varsByDevice[p.deviceId] ?? [], p.computed, p.slaveId)
        await bulkUpdateVariables(tx, p.deviceId, updates, now)
      }
    })
  }

  const switchRows = await prisma.device.findMany({
    where: { id: { in: deviceIds } },
    select: { id: true, switchState: true, gatewayId: true },
  })
  const switchById = Object.fromEntries(switchRows.map((d) => [d.id, d.switchState]))
  const gatewayByDevice = Object.fromEntries(switchRows.map((d) => [d.id, d.gatewayId]))

  await prisma.$transaction([
    ...deviceIds.map((id) =>
      prisma.device.update({
        where: { id },
        data: {
          lastDataReceivedAt: now,
          ...(switchById[id] !== 'OFF' ? { status: 'ONLINE' } : {}),
        },
      })
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

  const touchedGateways = new Set()
  for (const p of computedByPayload) {
    await cacheLatestValues(p.deviceId, p.slaveId, p.computed)
    emitReading(p.organizationId, p.deviceId, p.computed, now)
    if (switchById[p.deviceId] !== 'OFF') {
      try {
        const { emitDeviceStatus, touchGatewayOnline } = require('./devicePresenceService')
        emitDeviceStatus(p.organizationId, p.deviceId, 'ONLINE', {
          reason: 'ingest',
          lastDataReceivedAt: now,
        })
        const gwId = gatewayByDevice[p.deviceId]
        if (gwId && !touchedGateways.has(gwId)) {
          touchedGateways.add(gwId)
          await touchGatewayOnline(gwId, now)
        }
      } catch (_) {}
    }
    enqueueAnomaly({
      deviceId: p.deviceId,
      organizationId: p.organizationId,
      readings: p.computed,
    })
  }
}

const processIngest = async ({ deviceId, slaveId, readings, organizationId }) => {
  const { sensorReading, now, computedReadings } = await persistIngest({
    deviceId, slaveId, readings, organizationId,
  })
  const computed = computedReadings || readings
  const io = emitReading(organizationId, deviceId, computed, now)
  enqueueAnomaly({ deviceId, organizationId, readings: computed, io: !!io })
  return sensorReading
}

module.exports = { persistIngest, processIngest, processIngestBatch, cacheLatestValues }
