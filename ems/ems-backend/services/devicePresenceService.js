// Device ONLINE when readings arrive (ingestService, switch ON).
// Device OFFLINE when:
//   - no data received within DEVICE_OFFLINE_AFTER_MS (stale timeout)
//   - MQTT bridge stopped (markOrgDevicesOffline)
//   - switch flipped OFF (deviceController / scheduler)
// UI may still show last readings while status is OFFLINE.

const prisma = require('../config/database')
const logger = require('../utils/logger')

const CHECK_MS = parseInt(process.env.DEVICE_PRESENCE_CHECK_MS || '60000', 10)
const OFFLINE_AFTER_MS = parseInt(process.env.DEVICE_OFFLINE_AFTER_MS || String(5 * 60_000), 10)

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

const startDevicePresence = () => {
  if (timer) return
  // Run once shortly after boot, then on interval
  setTimeout(() => { markStaleDevicesOffline().catch(() => {}) }, 5_000)
  timer = setInterval(() => { markStaleDevicesOffline().catch(() => {}) }, CHECK_MS)
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
  markOrgDevicesOffline,
  emitDeviceStatus,
  OFFLINE_AFTER_MS,
}
