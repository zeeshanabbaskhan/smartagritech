// Device online/offline follows MQTT bridge availability — not stale reading timeouts.
// When the org bridge is stopped/offline → devices OFFLINE (UI still shows last readings).
// When readings arrive with switch ON → ONLINE (ingestService).

const prisma = require('../config/database')
const logger = require('../utils/logger')

const emitDeviceStatus = (organizationId, deviceId, status, extra = {}) => {
  try {
    const { getIO } = require('../socket')
    const io = getIO()
    const payload = { deviceId, status, ...extra }
    if (organizationId) io.to(`org_${organizationId}`).emit('device:status', payload)
    io.to(`device_${deviceId}`).emit('device:status', payload)
  } catch (_) {}
}

/** Mark all org devices OFFLINE when their MQTT bridge is down. */
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

/** No periodic stale-offline — kept so server.js start hook stays valid. */
const startDevicePresence = () => {
  logger.info('devicePresence: stale timeout disabled — offline only when MQTT bridge is down or switch is OFF')
}

const stopDevicePresence = () => {}

module.exports = {
  startDevicePresence,
  stopDevicePresence,
  markOrgDevicesOffline,
  emitDeviceStatus,
}
