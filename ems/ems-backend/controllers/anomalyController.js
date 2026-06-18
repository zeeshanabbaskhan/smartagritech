// ─── Anomaly controller ───────────────────────────────────────────────────────
// Exposes DeviceVariableAlarmHistory for browsing and acknowledging alarms.
// Anomaly records are created by the anomalyDetector service during ingest.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate, buildDateRange } = require('../utils/helpers')

// @desc  List anomalies; filterable by device, state and date range
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getAnomalies = async (req, res, next) => {
  try {
    const { page, limit, skip }                       = paginate(req.query)
    const { deviceId, alarmState, processState, from, to } = req.query

    const where = { ...orgScope(req.user) }
    if (deviceId)     where.deviceId     = deviceId
    if (alarmState)   where.alarmState   = alarmState
    if (processState) where.processState = processState
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.alarmTime = dateRange

    const [data, total] = await Promise.all([
      prisma.deviceVariableAlarmHistory.findMany({ where, skip, take: limit, orderBy: { alarmTime: 'desc' } }),
      prisma.deviceVariableAlarmHistory.count({ where }),
    ])

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Alarm frequency timeline bucketed into 30-min windows for a device
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getAnomalyTimeline = async (req, res, next) => {
  try {
    const { deviceId, from, to } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

    const where = { deviceId, ...orgScope(req.user) }
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.alarmTime = dateRange

    const records = await prisma.deviceVariableAlarmHistory.findMany({
      where,
      orderBy: { alarmTime: 'asc' },
      select:  { alarmTime: true, triggerType: true },
    })

    const BUCKET = 30 * 60 * 1000
    const buckets = {}
    for (const r of records) {
      const key = Math.floor(new Date(r.alarmTime).getTime() / BUCKET) * BUCKET
      if (!buckets[key]) buckets[key] = { count: 0, types: {} }
      buckets[key].count += 1
      const type = r.triggerType || 'custom'
      buckets[key].types[type] = (buckets[key].types[type] || 0) + 1
    }

    const data = Object.entries(buckets)
      .sort((a, b) => a[0] - b[0])
      .map(([ts, v]) => ({ timestamp: new Date(Number(ts)), count: v.count, types: v.types }))

    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Acknowledge (resolve) a specific alarm record
// @access SUPER_ADMIN | ORG_ADMIN
const acknowledgeAnomaly = async (req, res, next) => {
  try {
    const data = await prisma.deviceVariableAlarmHistory.update({
      where: { id: req.params.id },
      data:  { alarmState: 'RESOLVED', processState: 'PROCESSED' },
    })
    res.json({ success: true, data })
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('Alarm record not found', 404))
    next(err)
  }
}

module.exports = { getAnomalies, getAnomalyTimeline, acknowledgeAnomaly }
