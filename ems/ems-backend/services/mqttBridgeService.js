/**
 * In-process MQTT bridge manager.
 * Subscribes to org MQTT topics, maps CF payloads → EMS ingest, publishes ON/OFF commands.
 */
const mqtt = require('mqtt')
const prisma = require('../config/database')
const logger = require('../utils/logger')
const { processIngest } = require('./ingestService')
const { isQueueEnabled, enqueueIngest } = require('../workers/jobQueues')

/** @type {Map<string, { client: import('mqtt').MqttClient, bridgeId: string }>} */
const live = new Map()

const META_KEYS = new Set([
  'device',
  'serial_number',
  'mac_address',
  'sys_time',
  'timestamp',
  'time',
])

const DEVICE_SELECT = {
  id: true,
  name: true,
  organizationId: true,
  gateway: { select: { id: true, serialNumber: true, name: true } },
  configSlaves: {
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      configVariables: {
        where: { isActive: true },
        select: {
          name: true,
          unit: true,
          templateVariable: { select: { registerAddress: true } },
        },
      },
    },
  },
}

const setStatus = async (bridgeId, status, extra = {}) => {
  try {
    const data = { status, updatedAt: new Date() }
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) data[k] = v
    }
    await prisma.mqttBridge.update({
      where: { id: bridgeId },
      data,
    })
  } catch (err) {
    logger.error('mqtt bridge status update failed', { bridgeId, message: err.message })
  }
}

const normalizeReg = (key) => String(key).trim().replace(/^0x/i, '').toUpperCase()

/**
 * Build register → { variableName, unit, slaveId, deviceId, organizationId } map for an org.
 */
const loadDeviceMaps = async (organizationId) => {
  const devices = await prisma.device.findMany({
    where: { organizationId },
    select: DEVICE_SELECT,
  })

  return buildDeviceMaps(devices)
}

const buildDeviceMaps = (devices) => {
  /** @type {Map<string, typeof devices>} */
  const bySerial = new Map()
  /** @type {Map<string, typeof devices[0]>} */
  const byName = new Map()

  for (const d of devices) {
    byName.set(d.name.trim().toLowerCase(), d)
    const serial = d.gateway?.serialNumber?.trim()
    if (serial) {
      const list = bySerial.get(serial) || []
      list.push(d)
      bySerial.set(serial, list)
    }
  }

  return { devices, bySerial, byName }
}

const recentMsgHashes = new Map()
const DEDUP_TTL_MS = 2000

const cleanOldHashes = () => {
  const now = Date.now()
  for (const [hash, ts] of recentMsgHashes.entries()) {
    if (now - ts > DEDUP_TTL_MS) recentMsgHashes.delete(hash)
  }
}

/** Fallback when org-scoped map misses (e.g. device registered under another org). */
const resolveDeviceGlobal = async (payload) => {
  const serial = payload.serial_number != null ? String(payload.serial_number).trim() : ''
  const deviceName = payload.device != null ? String(payload.device).trim() : ''
  if (!serial && !deviceName) return null

  const or = []
  if (serial) {
    or.push({ gateway: { serialNumber: serial } })
    or.push({ gateway: { serialNumber: { contains: serial, mode: 'insensitive' } } })
  }
  if (deviceName) {
    or.push({ name: { equals: deviceName, mode: 'insensitive' } })
    // If device is named e.g. AMBITIONAPPAREL, match Ambition
    const prefix = deviceName.replace(/apparel|plant|factory|hall|unit/i, '').trim()
    if (prefix.length >= 3) {
      or.push({ name: { contains: prefix, mode: 'insensitive' } })
      or.push({ organization: { name: { contains: prefix, mode: 'insensitive' } } })
    }
  }

  const devices = await prisma.device.findMany({
    where: { OR: or },
    select: DEVICE_SELECT,
  })
  if (!devices.length) return null
  return resolveDevice(buildDeviceMaps(devices), payload)
}

const resolveDevice = (maps, payload) => {
  const serial = payload.serial_number != null ? String(payload.serial_number).trim() : ''
  const deviceName = payload.device != null ? String(payload.device).trim().toLowerCase() : ''

  if (serial && maps.bySerial.has(serial)) {
    const list = maps.bySerial.get(serial)
    if (deviceName) {
      const named = list.find((d) => d.name.trim().toLowerCase() === deviceName)
      if (named) return named
      const prefixed = list.find((d) => deviceName.startsWith(d.name.trim().toLowerCase()) || d.name.trim().toLowerCase().startsWith(deviceName))
      if (prefixed) return prefixed
    }
    return list[0]
  }

  if (deviceName && maps.byName.has(deviceName)) {
    return maps.byName.get(deviceName)
  }

  // Prefix / partial fallback across known devices
  if (deviceName) {
    for (const [name, d] of maps.byName.entries()) {
      if (deviceName.startsWith(name) || name.startsWith(deviceName)) {
        return d
      }
    }
  }

  return null
}

const slaveBlocks = (payload) => {
  const blocks = []
  for (const [key, value] of Object.entries(payload || {})) {
    if (META_KEYS.has(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      blocks.push({ slaveName: key, registers: value })
    }
  }
  return blocks
}

const mapReadings = (device, slaveName, registers) => {
  const slave =
    device.configSlaves.find((s) => s.name.trim().toLowerCase() === slaveName.trim().toLowerCase()) ||
    (device.configSlaves.length === 1 ? device.configSlaves[0] : null) ||
    device.configSlaves.find((s) => s.name.trim().toLowerCase() === 'main') ||
    device.configSlaves.find((s) => s.name.trim().toLowerCase() === 'incoming') ||
    device.configSlaves[0]

  if (!slave) return null

  const byReg = new Map()
  const byName = new Map()
  for (const v of slave.configVariables) {
    const reg = v.templateVariable?.registerAddress
    if (reg) byReg.set(normalizeReg(reg), { variableName: v.name.trim(), unit: v.unit || '' })
    byName.set(v.name.trim().toLowerCase().replace(/[\s_-]+/g, ''), { variableName: v.name.trim(), unit: v.unit || '' })
  }

  const readings = []
  for (const [regKey, raw] of Object.entries(registers)) {
    let mapped = byReg.get(normalizeReg(regKey))
    if (!mapped) {
      mapped = byName.get(String(regKey).trim().toLowerCase().replace(/[\s_-]+/g, ''))
    }
    if (!mapped) continue

    let num = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(num)) continue

    // Discard extreme corrupted float overflows (e.g. 2.94e+37)
    if (Math.abs(num) > 1e8) continue

    const varLower = mapped.variableName.toLowerCase().replace(/[\s_-]+/g, '')

    // Auto-scale raw voltage integer (e.g. 2356024 -> 235.6024 V)
    if (varLower.includes('voltage') && num > 100000) {
      num = parseFloat((num / 10000).toFixed(4))
    }

    // Auto-scale raw frequency integer (e.g. 4997 -> 49.97 Hz)
    if (varLower.includes('frequency') && num > 1000) {
      num = parseFloat((num / 100).toFixed(2))
    }

    // Auto-scale raw power factor integer (e.g. 556 -> 0.556, 1000 -> 1.0)
    if ((varLower.includes('powerfactor') || varLower === 'pf') && num > 10) {
      num = parseFloat((num / 1000).toFixed(3))
    }

    // Auto-scale raw current integer (e.g. 467520 -> 46.752 A)
    if (varLower.startsWith('current') && num > 10000) {
      num = parseFloat((num / 10000).toFixed(4))
    }

    // Auto-scale raw power integer (e.g. 160560 -> 160.56 kW)
    if ((varLower.includes('power') || varLower.includes('apparent') || varLower.includes('reactive')) && !varLower.includes('powerfactor') && num > 10000) {
      num = parseFloat((num / 1000).toFixed(4))
    }

    // Auto-scale raw energy / units integer (e.g. 2233760 -> 2233.76 kWh)
    if ((varLower.includes('energy') || varLower.includes('units') || varLower.includes('kwh')) && num > 100000) {
      num = parseFloat((num / 1000).toFixed(4))
    }

    readings.push({
      variableName: mapped.variableName,
      value: num,
      unit: mapped.unit,
    })
  }

  return { slaveId: slave.id, readings }
}

const ingestMapped = async (device, slaveId, readings) => {
  if (!readings.length) return
  const payload = {
    deviceId: device.id,
    slaveId,
    readings,
    organizationId: device.organizationId,
  }
  if (isQueueEnabled()) {
    await enqueueIngest(payload)
  } else {
    await processIngest(payload)
  }
}

const handleMessage = async (bridgeId, organizationId, topic, buf) => {
  let payload
  try {
    payload = JSON.parse(buf.toString('utf8'))
  } catch {
    logger.warn('mqtt bridge non-JSON payload', { bridgeId, topic })
    return
  }

  // Deduplicate when multiple bridges subscribe to the same topic
  cleanOldHashes()
  const dedupKey = `${topic}:${payload.serial_number || ''}:${payload.device || ''}:${payload.timestamp || payload.time || ''}:${buf.length}`
  if (recentMsgHashes.has(dedupKey)) {
    return
  }

  const maps = await loadDeviceMaps(organizationId)
  let device = resolveDevice(maps, payload)
  if (!device) device = await resolveDeviceGlobal(payload)
  if (!device) {
    logger.warn('mqtt bridge: no matching device', {
      bridgeId,
      serial: payload.serial_number,
      device: payload.device,
    })
    await setStatus(bridgeId, 'CONNECTED', {
      lastMessageAt: new Date(),
      messagesReceived: { increment: 1 },
      lastError: `No matching device for serial=${payload.serial_number || '—'} device=${payload.device || '—'}`,
    })
    return
  }

  recentMsgHashes.set(dedupKey, Date.now())

  const blocks = slaveBlocks(payload)
  let ingested = 0
  for (const block of blocks) {
    const mapped = mapReadings(device, block.slaveName, block.registers)
    if (!mapped?.readings?.length) continue
    await ingestMapped(device, mapped.slaveId, mapped.readings)
    ingested += mapped.readings.length
  }

  // Flat soil-style payload: { M, B, TX } without slave objects
  if (!blocks.length) {
    const mainSlave = device.configSlaves[0]
    if (mainSlave) {
      const flatRegs = {}
      for (const [k, v] of Object.entries(payload)) {
        if (META_KEYS.has(k)) continue
        if (typeof v === 'number' || (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)))) {
          flatRegs[k] = v
        }
      }
      // Also map common soil shortcuts to register aliases if template uses names directly
      const readings = []
      const nameMap = {
        M: 'SoilMoisture',
        B: 'BatteryLevel',
        TX: 'TxCounter',
      }
      for (const [k, varName] of Object.entries(nameMap)) {
        if (payload[k] == null) continue
        const num = Number(payload[k])
        if (Number.isNaN(num)) continue
        const exists = mainSlave.configVariables.some((cv) => cv.name === varName)
        if (exists) readings.push({ variableName: varName, value: num, unit: '' })
      }
      const fromReg = mapReadings(device, mainSlave.name, flatRegs)
      const merged = [...readings, ...(fromReg?.readings || [])]
      if (merged.length) {
        await ingestMapped(device, mainSlave.id, merged)
        ingested += merged.length
      }
    }
  }

  await setStatus(bridgeId, 'CONNECTED', {
    lastMessageAt: new Date(),
    messagesReceived: { increment: 1 },
    lastError: ingested
      ? null
      : `Matched ${device.name} but 0 registers mapped — check slave names / registerAddress`,
  })

  logger.info('mqtt bridge ingested', {
    bridgeId,
    deviceId: device.id,
    readings: ingested,
  })
}

const stopBridge = async (bridgeId, { updateDb = true } = {}) => {
  const entry = live.get(bridgeId)
  let organizationId = null
  try {
    const row = await prisma.mqttBridge.findUnique({
      where: { id: bridgeId },
      select: { organizationId: true },
    })
    organizationId = row?.organizationId || null
  } catch (_) {}

  if (entry) {
    try {
      entry.client.end(true)
    } catch (_) {}
    live.delete(bridgeId)
  }
  if (updateDb) {
    await setStatus(bridgeId, 'STOPPED', { enabled: false, lastError: null })
    if (organizationId) {
      const { markOrgDevicesOffline, markOrgGatewaysOffline } = require('./devicePresenceService')
      await markOrgDevicesOffline(organizationId, 'bridge_stopped')
      await markOrgGatewaysOffline(organizationId, 'bridge_stopped')
    }
  }
}

const startBridge = async (bridgeId) => {
  const bridge = await prisma.mqttBridge.findUnique({ where: { id: bridgeId } })
  if (!bridge) throw new Error('Bridge not found')

  await stopBridge(bridgeId, { updateDb: false })
  await setStatus(bridgeId, 'STARTING', { enabled: true, lastError: null })

  const url = `mqtt://${bridge.brokerHost}:${bridge.brokerPort}`
  const client = mqtt.connect(url, {
    username: bridge.username || undefined,
    password: bridge.password || undefined,
    reconnectPeriod: 5000,
    connectTimeout: 15_000,
    clientId: `ems-bridge-${bridgeId.slice(0, 8)}-${Date.now()}`,
  })

  live.set(bridgeId, { client, bridgeId })

  client.on('connect', async () => {
    client.subscribe(bridge.subscribeTopic, { qos: 0 }, async (err) => {
      if (err) {
        await setStatus(bridgeId, 'ERROR', { lastError: err.message })
        return
      }
      await setStatus(bridgeId, 'CONNECTED', { lastError: null })
      logger.info('mqtt bridge connected', {
        bridgeId,
        host: bridge.brokerHost,
        topic: bridge.subscribeTopic,
      })
      // Devices go ONLINE only when fresh ingest arrives — do not restore from lastDataReceivedAt.
    })
  })

  // mqtt.js reconnects automatically — keep DB status accurate and re-subscribe
  client.on('reconnect', () => {
    setStatus(bridgeId, 'STARTING', { lastError: 'Reconnecting to broker…' })
  })

  client.on('message', (topic, message) => {
    handleMessage(bridgeId, bridge.organizationId, topic, message).catch((err) => {
      logger.error('mqtt bridge message handler failed', { bridgeId, message: err.message })
      setStatus(bridgeId, 'CONNECTED', { lastError: err.message })
    })
  })

  client.on('error', (err) => {
    logger.error('mqtt bridge client error', { bridgeId, message: err.message })
    setStatus(bridgeId, 'ERROR', { lastError: err.message })
  })

  client.on('offline', () => {
    setStatus(bridgeId, 'ERROR', { lastError: 'Broker connection offline' })
  })

  client.on('close', () => {
    // Only mark STOPPED if we intentionally removed this client (stopBridge)
    if (!live.has(bridgeId)) {
      setStatus(bridgeId, 'STOPPED')
    }
  })

  return bridge
}

const startEnabledBridges = async () => {
  const bridges = await prisma.mqttBridge.findMany({ where: { enabled: true } })
  for (const b of bridges) {
    try {
      await startBridge(b.id)
    } catch (err) {
      logger.error('failed to auto-start mqtt bridge', { id: b.id, message: err.message })
      await setStatus(b.id, 'ERROR', { lastError: err.message })
    }
  }
}

/**
 * Publish device ON/OFF to MQTT when a bridge for the org is connected.
 */
const publishDeviceCommand = async ({ organizationId, device, action, commandId }) => {
  const bridge = await prisma.mqttBridge.findFirst({
    where: { organizationId, enabled: true, status: 'CONNECTED' },
    orderBy: { updatedAt: 'desc' },
  })
  if (!bridge) return { published: false, reason: 'no_active_bridge' }

  const entry = live.get(bridge.id)
  if (!entry?.client?.connected) return { published: false, reason: 'bridge_offline' }

  const topic = bridge.commandTopic || `${bridge.subscribeTopic.replace(/\/$/, '')}/command`
  const body = {
    commandId,
    action,
    device: device.name,
    deviceId: device.id,
    serial_number: device.gateway?.serialNumber || null,
    timestamp: new Date().toISOString(),
  }

  await new Promise((resolve, reject) => {
    entry.client.publish(topic, JSON.stringify(body), { qos: 0 }, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })

  return { published: true, topic }
}

const getRuntimeStatus = (bridgeId) => {
  const entry = live.get(bridgeId)
  return {
    connected: Boolean(entry?.client?.connected),
  }
}

module.exports = {
  startBridge,
  stopBridge,
  startEnabledBridges,
  publishDeviceCommand,
  getRuntimeStatus,
  loadDeviceMaps,
}
