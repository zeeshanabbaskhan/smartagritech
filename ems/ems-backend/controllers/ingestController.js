// ─── IoT data ingest controller ───────────────────────────────────────────────
const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { validateIngestKey } = require('../utils/ingestAuth')
const { processIngest } = require('../services/ingestService')
const { isQueueEnabled, enqueueIngest } = require('../workers/jobQueues')
const metrics = require('../utils/metrics')

const ingest = async (req, res, next) => {
  try {
    const { deviceId, slaveId, readings } = req.body
    if (!deviceId || !Array.isArray(readings) || !readings.length) {
      return next(new AppError('deviceId and readings[] are required', 400))
    }

    await validateIngestKey(req.headers['x-api-key'], deviceId)

    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) return next(new AppError('Device not found', 404))

    const payload = {
      deviceId,
      slaveId:        slaveId || null,
      readings,
      organizationId: device.organizationId,
    }

    if (isQueueEnabled()) {
      await enqueueIngest(payload)
      return res.json({ success: true, queued: true })
    }

    await processIngest(payload)
    metrics.inc('ingest_total')
    res.json({ success: true })
  } catch (err) {
    metrics.inc('ingest_errors_total')
    next(err)
  }
}

/** Gateway acknowledges a pending device command (P-59). */
const acknowledgeCommand = async (req, res, next) => {
  try {
    const { deviceId, commandId, status, reason } = req.body
    if (!deviceId || !commandId) {
      return next(new AppError('deviceId and commandId are required', 400))
    }
    await validateIngestKey(req.headers['x-api-key'], deviceId)

    const cmd = await prisma.deviceCommand.findFirst({
      where: { id: commandId, deviceId, status: 'PENDING' },
    })
    if (!cmd) return next(new AppError('Command not found or already resolved', 404))

    const newStatus = status === 'FAILED' ? 'FAILED' : 'ACKNOWLEDGED'
    const data = await prisma.deviceCommand.update({
      where: { id: commandId },
      data:  {
        status:         newStatus,
        acknowledgedAt: new Date(),
        failedReason:   reason || null,
      },
    })

    if (newStatus === 'ACKNOWLEDGED') {
      await prisma.device.update({
        where: { id: deviceId },
        data:  { switchState: cmd.action },
      })
    }

    try {
      const { getIO } = require('../socket')
      getIO().to(`device_${deviceId}`).emit('device:command', {
        commandId,
        deviceId,
        action: cmd.action,
        status: newStatus,
      })
    } catch (_) {}

    res.json({ success: true, data })
  } catch (err) { next(err) }
}

module.exports = { ingest, acknowledgeCommand }
