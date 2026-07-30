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
    select: {
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
    },
  })

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

const resolveDevice = (maps, payload) => {
  const serial = payload.serial_number != null ? String(payload.serial_number).trim() : ''
  const deviceName = payload.device != null ? String(payload.device).trim().toLowerCase() : ''

  if (serial && maps.bySerial.has(serial)) {
    const list = maps.bySerial.get(serial)
    if (deviceName) {
      const named = list.find((d) => d.name.trim().toLowerCase() === deviceName)
      if (named) return named
    }
    return list[0]
  }

  if (deviceName && maps.byName.has(deviceName)) {
    return maps.byName.get(deviceName)
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
    device.configSlaves.find((s) => s.name.trim().toLowerCase() === 'main')

  if (!slave) return null

  const byReg = new Map()
  for (const v of slave.configVariables) {
    const reg = v.templateVariable?.registerAddress
    if (!reg) continue
    byReg.set(normalizeReg(reg), { variableName: v.name, unit: v.unit || '' })
  }

  const readings = []
  for (const [reg, raw] of Object.entries(registers)) {
    const mapped = byReg.get(normalizeReg(reg))
    if (!mapped) continue
    const num = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isNaN(num)) continue
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

  const maps = await loadDeviceMaps(organizationId)
  const device = resolveDevice(maps, payload)
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
  if (entry) {
    try {
      entry.client.end(true)
    } catch (_) {}
    live.delete(bridgeId)
  }
  if (updateDb) {
    await setStatus(bridgeId, 'STOPPED', { enabled: false, lastError: null })
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
