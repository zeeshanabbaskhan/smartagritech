// Device ONLINE when readings arrive (ingestService, switch ON).
// Device OFFLINE when:
//   - no data received within DEVICE_OFFLINE_AFTER_MS (stale timeout)
//   - MQTT bridge stopped (markOrgDevicesOffline)
//   - switch flipped OFF (deviceController / scheduler)
// Gateway ONLINE when any linked device ingests; OFFLINE when lastSeenAt is stale
// (manual statuses UPGRADING / IN_CONFIGURATION / GATEWAY_ALARM / DISABLED are left alone).
// UI may still show last readings while status is OFFLINE.

const prisma = require('../config/database')
const logger = require('../utils/logger')

const CHECK_MS = parseInt(process.env.DEVICE_PRESENCE_CHECK_MS || '60000', 10)
const OFFLINE_AFTER_MS = parseInt(process.env.DEVICE_OFFLINE_AFTER_MS || String(5 * 60_000), 10)

/** Statuses managed automatically by presence (ingest + stale timeout). */
const AUTO_GATEWAY_STATUSES = ['ONLINE', 'OFFLINE']

let timer = null

const emitDeviceStatus = (organizationId, deviceId, status, extra = {}) => {
  try {
    const { getIO } = require('../socket')
    const io = getIO()
    const payload = { deviceId, status, ...extra }
    if (organizationId) io.to(`org_${organizationId}`).emit('device:status', payload)
    io.to(`device_${deviceId}`).emit('device:status', payload)
  } catch (_) {}
}

const emitGatewayStatus = (organizationId, gatewayId, status, extra = {}) => {
  try {
    const { getIO } = require('../socket')
    const io = getIO()
    const payload = { gatewayId, status, ...extra }
    if (organizationId) io.to(`org_${organizationId}`).emit('gateway:status', payload)
    io.to(`gateway_${gatewayId}`).emit('gateway:status', payload)
  } catch (_) {}
}

/**
 * Mark gateway ONLINE + refresh lastSeenAt when a linked device receives data.
 * Skips gateways in manual statuses (Upgrading, Disabled, etc.).
 */
const touchGatewayOnline = async (gatewayId, at = new Date()) => {
  if (!gatewayId) return null
  try {
    const gw = await prisma.gateway.findUnique({
      where: { id: gatewayId },
      select: { id: true, status: true, organizationId: true },
    })
    if (!gw) return null
    if (gw.status && !AUTO_GATEWAY_STATUSES.includes(gw.status)) return null

    const data = await prisma.gateway.update({
      where: { id: gatewayId },
      data: { lastSeenAt: at, status: 'ONLINE' },
      select: { id: true, organizationId: true, status: true, lastSeenAt: true },
    })
    emitGatewayStatus(data.organizationId, data.id, 'ONLINE', {
      reason: 'ingest',
      lastSeenAt: data.lastSeenAt,
    })
    return data
  } catch (err) {
    logger.error('devicePresence touchGatewayOnline failed', { gatewayId, message: err.message })
    return null
  }
}

/** Flip ONLINE → OFFLINE for devices with no recent lastDataReceivedAt. */
const markStaleDevicesOffline = async () => {
  const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS)
  try {
    const stale = await prisma.device.findMany({
      where: {
        status: 'ONLINE',
        OR: [
          { lastDataReceivedAt: null },
          { lastDataReceivedAt: { lt: cutoff } },
        ],
      },
      select: { id: true, organizationId: true, name: true, lastDataReceivedAt: true },
    })
    if (!stale.length) return 0

    await prisma.device.updateMany({
      where: { id: { in: stale.map((d) => d.id) } },
      data: { status: 'OFFLINE' },
    })

    for (const d of stale) {
      emitDeviceStatus(d.organizationId, d.id, 'OFFLINE', {
        reason: 'stale_data',
        lastDataReceivedAt: d.lastDataReceivedAt,
      })
    }
    logger.info('devicePresence: marked stale devices OFFLINE', {
      count: stale.length,
      offlineAfterMs: OFFLINE_AFTER_MS,
    })
    return stale.length
  } catch (err) {
    logger.error('devicePresence check failed', { message: err.message })
    return 0
  }
}

/** Flip ONLINE → OFFLINE for gateways with no recent lastSeenAt. */
const markStaleGatewaysOffline = async () => {
  const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS)
  try {
    const stale = await prisma.gateway.findMany({
      where: {
        status: 'ONLINE',
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: cutoff } },
        ],
      },
      select: { id: true, organizationId: true, name: true, lastSeenAt: true },
    })
    if (!stale.length) return 0

    await prisma.gateway.updateMany({
      where: { id: { in: stale.map((g) => g.id) } },
      data: { status: 'OFFLINE' },
    })

    for (const g of stale) {
      emitGatewayStatus(g.organizationId, g.id, 'OFFLINE', {
        reason: 'stale_data',
        lastSeenAt: g.lastSeenAt,
      })
    }
    logger.info('devicePresence: marked stale gateways OFFLINE', {
      count: stale.length,
      offlineAfterMs: OFFLINE_AFTER_MS,
    })
    return stale.length
  } catch (err) {
    logger.error('devicePresence gateway check failed', { message: err.message })
    return 0
  }
}

const markStalePresence = async () => {
  await markStaleDevicesOffline()
  await markStaleGatewaysOffline()
}

/** Mark all org devices OFFLINE when their MQTT bridge is stopped. */
const markOrgDevicesOffline = async (organizationId, reason = 'bridge_stopped') => {
  if (!organizationId) return 0
  try {
    const online = await prisma.device.findMany({
      where: { organizationId, status: 'ONLINE' },
      select: { id: true },
    })
    if (!online.length) return 0

    await prisma.device.updateMany({
      where: { organizationId, status: 'ONLINE' },
      data: { status: 'OFFLINE' },
    })

    for (const d of online) {
      emitDeviceStatus(organizationId, d.id, 'OFFLINE', { reason })
    }
    logger.info('devicePresence: org devices OFFLINE (bridge down)', {
      organizationId,
      count: online.length,
      reason,
    })
    return online.length
  } catch (err) {
    logger.error('devicePresence markOrgDevicesOffline failed', { message: err.message })
    return 0
  }
}

/** Mark all org auto-managed gateways OFFLINE when MQTT bridge is stopped. */
const markOrgGatewaysOffline = async (organizationId, reason = 'bridge_stopped') => {
  if (!organizationId) return 0
  try {
    const online = await prisma.gateway.findMany({
      where: { organizationId, status: 'ONLINE' },
      select: { id: true },
    })
    if (!online.length) return 0

    await prisma.gateway.updateMany({
      where: { organizationId, status: 'ONLINE' },
      data: { status: 'OFFLINE' },
    })

    for (const g of online) {
      emitGatewayStatus(organizationId, g.id, 'OFFLINE', { reason })
    }
    logger.info('devicePresence: org gateways OFFLINE (bridge down)', {
      organizationId,
      count: online.length,
      reason,
    })
    return online.length
  } catch (err) {
    logger.error('devicePresence markOrgGatewaysOffline failed', { message: err.message })
    return 0
  }
}

const startDevicePresence = () => {
  if (timer) return
  setTimeout(() => { markStalePresence().catch(() => {}) }, 5_000)
  timer = setInterval(() => { markStalePresence().catch(() => {}) }, CHECK_MS)
  logger.info('devicePresence scheduler started', {
    checkMs: CHECK_MS,
    offlineAfterMs: OFFLINE_AFTER_MS,
  })
}

const stopDevicePresence = () => {
  if (timer) clearInterval(timer)
  timer = null
}

module.exports = {
  startDevicePresence,
  stopDevicePresence,
  markStaleDevicesOffline,
  markStaleGatewaysOffline,
  markStalePresence,
  markOrgDevicesOffline,
  markOrgGatewaysOffline,
  touchGatewayOnline,
  emitDeviceStatus,
  emitGatewayStatus,
  OFFLINE_AFTER_MS,
}
