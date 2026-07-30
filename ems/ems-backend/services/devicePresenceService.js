// Mark devices OFFLINE when they stop sending readings (and on switch OFF).

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
    if (!stale.length) return

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
  } catch (err) {
    logger.error('devicePresence check failed', { message: err.message })
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
  emitDeviceStatus,
  OFFLINE_AFTER_MS,
}
