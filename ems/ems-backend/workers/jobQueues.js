// ─── BullMQ job queues (P-08, P-39, P-40, P-41, P-57) ─────────────────────

const { Queue, Worker } = require('bullmq')
const redis             = require('../config/redis')
const prisma            = require('../config/database')
const logger            = require('../utils/logger')
const metrics           = require('../utils/metrics')
const { processIngestBatch } = require('../services/ingestService')
const { runAnomalyCheck } = require('../services/anomalyDetector')
const { logHistory } = require('../services/notificationService')
const transporter      = require('../config/nodemailer')

let ingestQueue = null
let ingestWorker = null
let anomalyQueue = null
let anomalyWorker = null
let emailQueue = null
let emailWorker = null
let deleteQueue = null
let deleteWorker = null

const connectionOpts = () => {
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    const parsed = new URL(url)
    return {
      host:     parsed.hostname,
      port:     parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      username: parsed.username !== 'default' ? parsed.username : undefined,
    }
  } catch (_) {
    return { host: '127.0.0.1', port: 6379 }
  }
}

const defaultJobOpts = { removeOnComplete: 1000, removeOnFail: 5000 }

// ─── Ingest batch worker (P-08, P-10) ───────────────────────────────────────
const INGEST_BATCH_MAX = parseInt(process.env.INGEST_BATCH_MAX || '50', 10)
const INGEST_BATCH_MS  = parseInt(process.env.INGEST_BATCH_MS || '100', 10)
let ingestBuffer = []
let ingestFlushTimer = null

const flushIngestBuffer = async () => {
  ingestFlushTimer = null
  if (!ingestBuffer.length) return
  const batch = ingestBuffer.splice(0, INGEST_BATCH_MAX)
  try {
    await processIngestBatch(batch)
    metrics.inc('ingest_total')
  } catch (err) {
    metrics.inc('ingest_errors_total')
    logger.error('ingest batch failed', { message: err.message, size: batch.length })
    throw err
  }
  if (ingestBuffer.length) scheduleIngestFlush()
}

const scheduleIngestFlush = () => {
  if (ingestFlushTimer) return
  ingestFlushTimer = setTimeout(flushIngestBuffer, INGEST_BATCH_MS)
}

const initIngestQueue = () => {
  const connection = connectionOpts()
  if (!connection || !redis.isEnabled()) {
    logger.info('Ingest queue: disabled (Redis required)')
    return false
  }

  ingestQueue = new Queue('ingest', { connection, defaultJobOptions: defaultJobOpts })
  ingestWorker = new Worker(
    'ingest',
    async (job) => {
      ingestBuffer.push(job.data)
      if (ingestBuffer.length >= INGEST_BATCH_MAX) await flushIngestBuffer()
      else scheduleIngestFlush()
    },
    { connection, concurrency: parseInt(process.env.INGEST_WORKER_CONCURRENCY || '4', 10) }
  )
  ingestWorker.on('failed', (job, err) => {
    logger.error('ingest job failed', { jobId: job?.id, message: err.message })
  })
  logger.info('Ingest queue worker started')
  return true
}

const isQueueEnabled = () => ingestQueue != null

const enqueueIngest = async (payload) => {
  if (!ingestQueue) throw new Error('Ingest queue not initialised')
  await ingestQueue.add('reading', payload, { attempts: 3, backoff: { type: 'exponential', delay: 500 } })
  metrics.inc('ingest_queued_total')
}

// ─── Anomaly queue (P-41) ───────────────────────────────────────────────────
const initAnomalyQueue = () => {
  const connection = connectionOpts()
  if (!connection || !redis.isEnabled()) return false

  anomalyQueue = new Queue('anomaly', { connection, defaultJobOptions: defaultJobOpts })
  anomalyWorker = new Worker(
    'anomaly',
    async (job) => {
      metrics.inc('anomaly_checks_total')
      await runAnomalyCheck(job.data)
    },
    { connection, concurrency: 2 }
  )
  logger.info('Anomaly queue worker started')
  return true
}

const enqueueAnomalyCheck = async (payload) => {
  if (anomalyQueue) {
    await anomalyQueue.add('check', payload, { attempts: 2, backoff: { type: 'fixed', delay: 1000 } })
    return
  }
  runAnomalyCheck(payload).catch((err) => logger.error('anomaly inline error', { message: err.message }))
}

// ─── Email queue (P-40, P-55) ───────────────────────────────────────────────
const initEmailQueue = () => {
  const connection = connectionOpts()
  if (!connection || !redis.isEnabled()) return false

  emailQueue = new Queue('email', { connection, defaultJobOptions: defaultJobOpts })
  emailWorker = new Worker(
    'email',
    async (job) => {
      const { to, subject, text, meta } = job.data
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.NODEMAILER_USER,
          to, subject, text,
        })
        metrics.inc('emails_sent_total')
        if (meta) await logHistory({ ...meta, sentTo: to, text, status })
      } catch (err) {
        metrics.inc('emails_failed_total')
        if (meta) await logHistory({ ...meta, sentTo: to, text, status: 'FAILED' })
        throw err
      }
    },
    { connection, concurrency: 1, limiter: { max: 5, duration: 1000 } }
  )
  logger.info('Email queue worker started')
  return true
}

const enqueueEmail = async (payload) => {
  if (emailQueue) {
    await emailQueue.add('send', payload, { attempts: 5, backoff: { type: 'exponential', delay: 2000 } })
    return true
  }
  return false
}

// ─── Device delete queue (P-57) ─────────────────────────────────────────────
const deleteDeviceBatches = async (deviceId) => {
  const BATCH = 5000
  while (true) {
    const rows = await prisma.sensorReading.findMany({
      where:   { deviceId },
      select:  { id: true },
      take:    BATCH,
    })
    if (!rows.length) break
    await prisma.sensorReadingValue.deleteMany({ where: { sensorReadingId: { in: rows.map((r) => r.id) } } })
    await prisma.sensorReading.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  }
}

const purgeDeviceData = async (deviceId) => {
  const configVarIds = (await prisma.deviceConfigVariable.findMany({ where: { deviceId }, select: { id: true } })).map((v) => v.id)
  if (configVarIds.length) {
    await prisma.deviceConfigVariableLog.deleteMany({ where: { deviceConfigVariableId: { in: configVarIds } } })
  }
  await prisma.deviceConfigVariable.deleteMany({ where: { deviceId } })
  await prisma.deviceConfigSlave.deleteMany({ where: { deviceId } })
  await prisma.deviceVariableAlarmHistory.deleteMany({ where: { deviceId } })
  await prisma.deviceVariableLinkageHistory.deleteMany({ where: { deviceId } })
  await prisma.deviceCommand.deleteMany({ where: { deviceId } })

  const taskIds = (await prisma.scheduledTask.findMany({ where: { deviceId }, select: { id: true } })).map((t) => t.id)
  if (taskIds.length) {
    await prisma.scheduleExecutionLog.deleteMany({ where: { scheduleTaskId: { in: taskIds } } })
    await prisma.scheduledTask.deleteMany({ where: { deviceId } })
  }

  await deleteDeviceBatches(deviceId)
  await prisma.aIForecastReading.deleteMany({ where: { deviceId } })
  await prisma.deviceUser.deleteMany({ where: { deviceId } })
  await prisma.alarmConfigurationDevice.deleteMany({ where: { deviceId } })
  await prisma.deviceTimestamp.deleteMany({ where: { deviceId } })
  await prisma.device.delete({ where: { id: deviceId } })
}

const initDeleteQueue = () => {
  const connection = connectionOpts()
  if (!connection || !redis.isEnabled()) return false

  deleteQueue = new Queue('device-delete', { connection, defaultJobOptions: defaultJobOpts })
  deleteWorker = new Worker(
    'device-delete',
    async (job) => {
      await purgeDeviceData(job.data.deviceId)
      logger.info('device deleted async', { deviceId: job.data.deviceId })
    },
    { connection, concurrency: 1 }
  )
  logger.info('Device delete queue worker started')
  return true
}

const isDeleteQueueEnabled = () => deleteQueue != null

const enqueueDeviceDelete = async (deviceId) => {
  if (!deleteQueue) throw new Error('Delete queue not initialised')
  await deleteQueue.add('purge', { deviceId }, { attempts: 2 })
}

const initAllQueues = () => {
  initIngestQueue()
  initAnomalyQueue()
  initEmailQueue()
  initDeleteQueue()
}

const closeAllQueues = async () => {
  const closers = [ingestWorker, ingestQueue, anomalyWorker, anomalyQueue, emailWorker, emailQueue, deleteWorker, deleteQueue]
  for (const item of closers) {
    if (item) await item.close()
  }
  ingestWorker = ingestQueue = anomalyWorker = anomalyQueue = null
  emailWorker = emailQueue = deleteWorker = deleteQueue = null
}

module.exports = {
  initIngestQueue,
  initAllQueues,
  isQueueEnabled,
  enqueueIngest,
  enqueueAnomalyCheck,
  enqueueEmail,
  isDeleteQueueEnabled,
  enqueueDeviceDelete,
  closeAllQueues,
  closeIngestQueue: closeAllQueues,
}
