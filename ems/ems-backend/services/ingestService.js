// ─── Ingest persistence service ───────────────────────────────────────────────
// P-06 bulk SQL, P-09 Redis latest + optional PG skip, P-14 narrow values, P-29 device room emit.
// Formulas: acquisition (=s/100) + equation (Slave$$Var) applied before currentValue writes.

const crypto = require('crypto')
const prisma = require('../config/database')
const redis  = require('../config/redis')
const { markDirty } = require('./valueFlushService')
const { applyIngestFormulas, CONFIG_VAR_INCLUDE } = require('../utils/applyIngestFormulas')
const { cacheLatestValues: writeLatestCache } = require('../utils/redisLatest')
const logger = require('../utils/logger')

const enqueueAnomaly = (payload) => {
  try {
    require('../workers/jobQueues').enqueueAnomalyCheck(payload)
  } catch (err) {
    require('./anomalyDetector').runAnomalyCheck(payload).catch(() => {})
  }
}

const EMIT_DEBOUNCE_MS = 300
const lastEmitByDevice = new Map()
const skipPgCurrentValue = () =>
  redis.isEnabled() && process.env.SKIP_PG_CURRENT_VALUE !== 'false'

// Default 10 minutes (600,000 ms) persistence interval to prevent 291 GB disk bloat
const DEFAULT_PERSIST_INTERVAL_MS = 600000
const parsePersistInterval = () => {
  const envVal = process.env.INGEST_PERSIST_INTERVAL_MS
  if (envVal === undefined || envVal === null || envVal === '') return DEFAULT_PERSIST_INTERVAL_MS
  const parsed = parseInt(envVal, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PERSIST_INTERVAL_MS
}
const INGEST_PERSIST_INTERVAL_MS = parsePersistInterval()
const SLOT_TTL_SEC = Math.ceil(INGEST_PERSIST_INTERVAL_MS / 1000)

// Fixed clock-aligned slots (:00, :10, :20 ... for the 10-min default) — one history row per slot.
// In-memory map is the per-process lock; Redis key makes the claim survive restarts / multiple instances.
const claimedSlots = new Map()
const slotKeyOf = (deviceId, slaveId) => `${deviceId}:${slaveId || 'none'}`
const slotStartOf = (nowMs) => Math.floor(nowMs / INGEST_PERSIST_INTERVAL_MS) * INGEST_PERSIST_INTERVAL_MS
const redisSlotKey = (deviceId, slaveId, slotMs) => `ingest:slot:${deviceId}:${slaveId || 'none'}:${slotMs}`

/** Returns the claimed slot start (ms) if this packet should be persisted, otherwise null. */
const claimPersistSlot = async (deviceId, slaveId, nowMs) => {
  const key = slotKeyOf(deviceId, slaveId)
  const slotMs = slotStartOf(nowMs)
  if (claimedSlots.get(key) === slotMs) return null
  // Set synchronously before any await so concurrent packets in this process cannot both claim.
  claimedSlots.set(key, slotMs)

  const c = redis.getClient()
  if (c) {
    try {
      const ok = await c.set(redisSlotKey(deviceId, slaveId, slotMs), String(nowMs), { NX: true, EX: SLOT_TTL_SEC })
      return ok ? slotMs : null
    } catch (_) {
      // Redis hiccup — fall back to DB check below
    }
  }

  try {
    const existing = await prisma.sensorReading.findFirst({
      where: { deviceId, deviceConfigSlaveId: slaveId || null, timestamp: { gte: new Date(slotMs) } },
      select: { id: true },
    })
    return existing ? null : slotMs
  } catch (_) {
    return slotMs
  }
}

/** Release a claimed slot after a failed write so the next packet in the same slot can retry. */
const releasePersistSlot = async (deviceId, slaveId, slotMs) => {
  const key = slotKeyOf(deviceId, slaveId)
  if (claimedSlots.get(key) === slotMs) claimedSlots.delete(key)
  const c = redis.getClient()
  if (!c) return
  try {
    await c.del(redisSlotKey(deviceId, slaveId, slotMs))
  } catch (_) {}
}

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

// Deprecated: No longer insert 20 unrolled rows into sensor_reading_values to eliminate 291 GB disk bloat
const insertReadingValues = async () => {}

const loadConfigVars = (deviceId) =>
  prisma.deviceConfigVariable.findMany({
    where: { deviceId },
    include: CONFIG_VAR_INCLUDE,
  })

const persistIngest = async ({ deviceId, slaveId, readings, organizationId }) => {
  const now = Date.now()
  const ts  = new Date(now)

  const configVars = await loadConfigVars(deviceId)
  // Computed values drive currentValue / readings / redis / socket
  const computed = applyIngestFormulas(configVars, readings, slaveId)
  const varUpdates = buildVarUpdates(configVars, computed, slaveId)

  // Live hot cache first — every packet, independent of the persistence gate or DB health.
  await cacheLatestValues(deviceId, slaveId, computed)

  const slotMs = await claimPersistSlot(deviceId, slaveId, now)
  let reading = null
  let isOnline = true
  let gatewayId = null
  let persisted = false

  if (slotMs !== null) {
    try {
      const sensorReading = await prisma.$transaction(async (tx) => {
        const r = await tx.sensorReading.create({
          data: { deviceId, deviceConfigSlaveId: slaveId || null, organizationId, readings: computed, timestamp: ts },
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
        return { reading: r, goOnline, gatewayId: existing?.gatewayId || null }
      })
      reading = sensorReading.reading
      isOnline = sensorReading.goOnline
      gatewayId = sensorReading.gatewayId
      persisted = true
    } catch (err) {
      // Free the slot so the next packet in this window retries; fall through to the live path below.
      await releasePersistSlot(deviceId, slaveId, slotMs)
      logger.error('ingest slot persist failed', { deviceId, slaveId, slotMs, message: err.message })
    }
  }

  if (!persisted) {
    // Between slots (or after a failed slot write): skip history insert, but update presence and currentValues
    const existing = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { switchState: true, gatewayId: true },
    })
    isOnline = existing?.switchState !== 'OFF'
    gatewayId = existing?.gatewayId || null
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        lastDataReceivedAt: ts,
        ...(isOnline ? { status: 'ONLINE' } : {}),
      },
    })
    await prisma.deviceTimestamp.upsert({
      where:  { deviceId },
      update: { lastActiveAt: ts },
      create: { deviceId, organizationId, lastActiveAt: ts },
    })
    await bulkUpdateVariables(prisma, deviceId, varUpdates, ts)
  }

  if (isOnline) {
    try {
      const { emitDeviceStatus, touchGatewayOnline } = require('./devicePresenceService')
      emitDeviceStatus(organizationId, deviceId, 'ONLINE', {
        reason: 'ingest',
        lastDataReceivedAt: ts,
      })
      if (gatewayId) {
        await touchGatewayOnline(gatewayId, ts)
      }
    } catch (_) {}
  }
  return {
    sensorReading: reading,
    now: ts,
    goOnline: isOnline,
    computedReadings: computed,
  }
}

/** Batch persist for BullMQ worker (P-08, P-10). */
const processIngestBatch = async (payloads) => {
  if (!payloads.length) return
  if (payloads.length === 1) return processIngest(payloads[0])

  const now = new Date()
  const nowMs = now.getTime()
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

  // Live path first — hot cache + socket on every packet, before any DB work.
  for (const p of computedByPayload) {
    await cacheLatestValues(p.deviceId, p.slaveId, p.computed)
    emitReading(p.organizationId, p.deviceId, p.computed, now)
  }

  // Claims start synchronously in order, so duplicates of the same device/slave within a batch lose.
  const slots = await Promise.all(
    computedByPayload.map((p) => claimPersistSlot(p.deviceId, p.slaveId, nowMs))
  )
  const payloadsToPersist = computedByPayload
    .map((p, i) => ({ p, slotMs: slots[i] }))
    .filter((x) => x.slotMs !== null)

  if (payloadsToPersist.length) {
    const readingRows = payloadsToPersist.map(({ p }) => ({
      id:                  crypto.randomUUID(),
      deviceId:            p.deviceId,
      deviceConfigSlaveId: p.slaveId || null,
      organizationId:      p.organizationId,
      readings:            p.computed,
      timestamp:           now,
    }))

    try {
      await prisma.sensorReading.createMany({ data: readingRows })
    } catch (err) {
      await Promise.all(payloadsToPersist.map(({ p, slotMs }) => releasePersistSlot(p.deviceId, p.slaveId, slotMs)))
      logger.error('ingest batch slot persist failed', { size: readingRows.length, message: err.message })
    }
  }

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
