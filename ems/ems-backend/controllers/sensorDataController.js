// ─── Sensor data controller ───────────────────────────────────────────────────
// Reads raw SensorReading rows and aggregates them for the Flutter dashboard.
// All queries scope to a single device; access is checked via authoriseDevice().
const prisma      = require('../config/database')
const redis       = require('../config/redis')
const { AppError } = require('../middleware/errorHandler')
const { TIME_RANGE_MS, BUCKET_MS, paginate } = require('../utils/helpers')
const { bucketVariable, sumVariable } = require('../utils/sensorAggregation')
const { cached } = require('../utils/responseCache')

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Compute the start of a named time window.
 * Throws AppError 400 for unknown keys so the caller can pass it to next().
 */
const startOfRange = (timeRange) => {
  const ms = TIME_RANGE_MS[timeRange]
  if (!ms) throw new AppError(`Invalid timeRange. Use: ${Object.keys(TIME_RANGE_MS).join(' | ')}`, 400)
  return new Date(Date.now() - ms)
}

/** Verify the device exists and belongs to the caller's org (non-SUPER_ADMIN). */
const authoriseDevice = async (deviceId, user) => {
  const device = await prisma.device.findUnique({ where: { id: deviceId } })
  if (!device) throw new AppError('Device not found', 404)
  if (user.role !== 'SUPER_ADMIN' && device.organizationId !== user.organizationId) {
    throw new AppError('Access denied', 403)
  }
  return device
}

/**
 * Group raw SensorReading rows by a fixed bucket width and return avg per bucket.
 *
 * @param {object[]} rawReadings  - Prisma rows with { timestamp, readings[] }
 * @param {string}   variableName - reading key to extract
 * @param {number}   bucketMs     - bucket width in milliseconds
 * @returns {{ timestamp: Date, value: number }[]}
 */
const bucketReadings = (rawReadings, variableName, bucketMs) => {
  const buckets = {}
  for (const row of rawReadings) {
    const ts    = new Date(row.timestamp).getTime()
    const key   = Math.floor(ts / bucketMs) * bucketMs
    const arr   = Array.isArray(row.readings) ? row.readings : []
    const entry = arr.find((r) => r.variableName === variableName)
    if (!entry) continue
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 }
    buckets[key].sum   += Number(entry.value)
    buckets[key].count += 1
  }
  return Object.entries(buckets)
    .sort((a, b) => a[0] - b[0])
    .map(([ts, { sum, count }]) => ({
      timestamp: new Date(Number(ts)),
      value:     parseFloat((sum / count).toFixed(4)),
    }))
}

// ─── Handlers ────────────────────────────────────────────────────────────────

// @desc  Return the latest value for every active variable on a device
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices only)
const getLatest = async (req, res, next) => {
  try {
    const { deviceId, slaveId } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

    await authoriseDevice(deviceId, req.user)

    // P-09: serve hot latest values from Redis when available
    const redisClient = redis.getClient()
    if (redisClient) {
      try {
        const hot = await redisClient.hGetAll(`device:${deviceId}:latest`)
        if (Object.keys(hot).length) {
          const where = { deviceId, isActive: true }
          if (slaveId) where.deviceConfigSlaveId = slaveId
          const vars = await prisma.deviceConfigVariable.findMany({
            where,
            select: { name: true, unit: true, lastUpdatedAt: true },
          })
          const meta = Object.fromEntries(vars.map((v) => [v.name, v]))
          const data = {}
          for (const [name, value] of Object.entries(hot)) {
            data[name] = {
              value,
              unit:          meta[name]?.unit ?? null,
              lastUpdatedAt: meta[name]?.lastUpdatedAt ?? null,
            }
          }
          const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { lastDataReceivedAt: true } })
          return res.json({ success: true, data, timestamp: device?.lastDataReceivedAt ?? null, source: 'redis' })
        }
      } catch (_) { /* fall through to Postgres */ }
    }

    const where = { deviceId, isActive: true }
    if (slaveId) where.deviceConfigSlaveId = slaveId

    const vars = await prisma.deviceConfigVariable.findMany({
      where,
      select: { name: true, currentValue: true, unit: true, lastUpdatedAt: true },
    })

    const data = {}
    for (const v of vars) data[v.name] = { value: v.currentValue, unit: v.unit, lastUpdatedAt: v.lastUpdatedAt }

    const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { lastDataReceivedAt: true } })
    res.json({ success: true, data, timestamp: device?.lastDataReceivedAt ?? null })
  } catch (err) { next(err) }
}

// @desc  Raw historical readings for a single variable (most-recent first, limit rows)
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices)
const getHistory = async (req, res, next) => {
  try {
    const { deviceId, slaveId, variableName, startDate, endDate, limit = 50 } = req.query
    if (!deviceId || !variableName) return next(new AppError('deviceId and variableName are required', 400))

    await authoriseDevice(deviceId, req.user)

    const where = { deviceId }
    if (slaveId) where.deviceConfigSlaveId = slaveId
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = new Date(startDate)
      if (endDate)   where.timestamp.lte = new Date(endDate)
    }

    const rows = await prisma.sensorReading.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take:    Math.min(100, Math.max(1, parseInt(limit, 10) || 50)),
      select:  { timestamp: true, readings: true },
    })

    const data = []
    for (const row of rows) {
      const arr   = Array.isArray(row.readings) ? row.readings : []
      const entry = arr.find((r) => r.variableName === variableName)
      if (entry) data.push({ variableName: entry.variableName, value: entry.value, unit: entry.unit, receivedTime: row.timestamp })
    }

    res.json({ success: true, count: data.length, data })
  } catch (err) { next(err) }
}

// @desc  Time-bucketed aggregate for a single variable over a named time window
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices)
const getAggregate = async (req, res, next) => {
  try {
    const { deviceId, slaveId, variableName, timeRange } = req.query
    if (!deviceId || !variableName || !timeRange) {
      return next(new AppError('deviceId, variableName, and timeRange are required', 400))
    }

    await authoriseDevice(deviceId, req.user)

    const startDate = startOfRange(timeRange)
    const bucketMs  = BUCKET_MS[timeRange]

    const where = { deviceId, timestamp: { gte: startDate } }
    if (slaveId) where.deviceConfigSlaveId = slaveId

    const rows = await prisma.sensorReading.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      select:  { timestamp: true, readings: true },
    })

    res.json({ success: true, timeRange, data: bucketReadings(rows, variableName, bucketMs) })
  } catch (err) { next(err) }
}

// @desc  Full dashboard summary: energy KPIs, chart data, anomaly stats, energy savings comparison
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices)
const buildDashboardSummary = async (deviceId, slaveId, timeRange) => {
  const startDate = startOfRange(timeRange)
  const bucketMs  = BUCKET_MS[timeRange]
  const now       = Date.now()
  const base      = { deviceId, slaveId: slaveId || null, startDate }

  const metricNames = [
    'PowerConsumption', 'ExportPower', 'VoltageImbalance', 'CurrentImbalance',
    'PowerFactor', 'THD_V', 'THD_I', 'Frequency',
  ]

  const [charts, totalPower, totalExport, latestVars] = await Promise.all([
    Promise.all(metricNames.map(async (name) => [
      name,
      await bucketVariable(prisma, { ...base, variableName: name, bucketMs }),
    ])),
    sumVariable(prisma, { ...base, variableName: 'PowerConsumption' }),
    sumVariable(prisma, { ...base, variableName: 'ExportPower' }),
    prisma.deviceConfigVariable.findMany({
      where:  { deviceId, isActive: true, ...(slaveId ? { deviceConfigSlaveId: slaveId } : {}) },
      select: { name: true, currentValue: true },
    }),
  ])

  const chartMap = Object.fromEntries(charts)
  const latest   = Object.fromEntries(latestVars.map((v) => [v.name, v.currentValue]))
  const latestNum = (name) => {
    const v = latest[name]
    return v != null && v !== '' ? parseFloat(v) : null
  }

  const savingsBlock = async (curStart, curEnd, priorStart, priorEnd) => {
    const [current, previous] = await Promise.all([
      sumVariable(prisma, { ...base, variableName: 'PowerConsumption', startDate: curStart, endDate: curEnd }),
      sumVariable(prisma, { ...base, variableName: 'PowerConsumption', startDate: priorStart, endDate: priorEnd }),
    ])
    return {
      current,
      previous,
      percentage: previous === 0 ? (current > 0 ? 100 : 0) : parseFloat((((current - previous) / previous) * 100).toFixed(2)),
    }
  }

  const summary = {
    totalPowerConsumption: { value: totalPower, chartData: chartMap.PowerConsumption ?? [] },
    totalExportPower:      { value: totalExport, chartData: chartMap.ExportPower ?? [] },
    voltageImbalance:      { value: latestNum('VoltageImbalance'), chartData: chartMap.VoltageImbalance ?? [] },
    currentImbalance:      { value: latestNum('CurrentImbalance'), chartData: chartMap.CurrentImbalance ?? [] },
    powerFactor:           { value: latestNum('PowerFactor'),      chartData: chartMap.PowerFactor ?? [] },
    thdV:                  { value: latestNum('THD_V'),            chartData: chartMap.THD_V ?? [] },
    thdI:                  { value: latestNum('THD_I'),            chartData: chartMap.THD_I ?? [] },
    frequency:             { value: latestNum('Frequency'),        chartData: chartMap.Frequency ?? [] },
    anomalies: { count: 0, breakdown: [], chartData: [] },
    energySavingsComparison: {
      daily:   await savingsBlock(new Date(now - 86_400_000),   new Date(now), new Date(now - 172_800_000),   new Date(now - 86_400_000)),
      weekly:  await savingsBlock(new Date(now - 604_800_000),  new Date(now), new Date(now - 1_209_600_000), new Date(now - 604_800_000)),
      monthly: await savingsBlock(new Date(now - 2_592_000_000),new Date(now), new Date(now - 5_184_000_000), new Date(now - 2_592_000_000)),
    },
  }

  const alarmRows = await prisma.deviceVariableAlarmHistory.findMany({
    where:  { deviceId, alarmTime: { gte: startDate } },
    select: { triggerType: true, alarmTime: true },
  })

  const anomalyBreakdown = {}
  const anomalyBuckets   = {}
  for (const a of alarmRows) {
    const type = a.triggerType || 'custom'
    anomalyBreakdown[type] = (anomalyBreakdown[type] || 0) + 1
    const key = Math.floor(new Date(a.alarmTime).getTime() / bucketMs) * bucketMs
    anomalyBuckets[key]    = (anomalyBuckets[key] || 0) + 1
  }
  summary.anomalies.count     = alarmRows.length
  summary.anomalies.breakdown = Object.entries(anomalyBreakdown).map(([type, count]) => ({ type, count }))
  summary.anomalies.chartData = Object.entries(anomalyBuckets)
    .sort((a, b) => a[0] - b[0])
    .map(([ts, count]) => ({ timestamp: new Date(Number(ts)), count }))

  return summary
}

const getDashboardSummary = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h' } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

    await authoriseDevice(deviceId, req.user)

    const cacheKey = `dash:${deviceId}:${slaveId || 'all'}:${timeRange}`
    const summary  = await cached(cacheKey, 45, () => buildDashboardSummary(deviceId, slaveId, timeRange))

    res.json({ success: true, timeRange, data: summary })
  } catch (err) { next(err) }
}

// @desc  Paginated raw reading rows for a device/time window (P-44)
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices)
const getReadingsBrowse = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h', before } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

    await authoriseDevice(deviceId, req.user)

    const startDate = startOfRange(timeRange)
    const { page, limit, skip } = paginate(req.query)

    const where = { deviceId, timestamp: { gte: startDate } }
    if (slaveId) where.deviceConfigSlaveId = slaveId
    if (before)  where.timestamp = { ...where.timestamp, lt: new Date(before) }

    const [rows, total] = await Promise.all([
      prisma.sensorReading.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take:   limit,
        select: { timestamp: true, readings: true },
      }),
      prisma.sensorReading.count({ where }),
    ])

    res.json({
      success: true,
      data:    rows,
      total,
      page,
      pages:   Math.ceil(total / limit),
      hasMore: skip + rows.length < total,
    })
  } catch (err) { next(err) }
}

// @desc  Stream sensor data as CSV (paginated 500-row cursor to avoid OOM)
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices)
const downloadCSV = async (req, res, next) => {
  try {
    const { deviceId, slaveId, variableName, startDate, endDate } = req.query
    if (!deviceId || !variableName) return next(new AppError('deviceId and variableName are required', 400))

    await authoriseDevice(deviceId, req.user)

    const where = { deviceId }
    if (slaveId) where.deviceConfigSlaveId = slaveId
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = new Date(startDate)
      if (endDate)   where.timestamp.lte = new Date(endDate)
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=readings.csv')
    res.write('variableName,value,unit,timestamp\n')

    let skip = 0
    const BATCH = 500
    while (true) {
      const rows = await prisma.sensorReading.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip, take: BATCH,
        select:  { timestamp: true, readings: true },
      })
      if (!rows.length) break
      for (const row of rows) {
        const arr   = Array.isArray(row.readings) ? row.readings : []
        const entry = arr.find((r) => r.variableName === variableName)
        if (entry) res.write(`${entry.variableName},${entry.value},${entry.unit || ''},${new Date(row.timestamp).toISOString()}\n`)
      }
      if (rows.length < BATCH) break
      skip += BATCH
    }

    res.end()
  } catch (err) { next(err) }
}

// @desc  Bulk-delete sensor readings for a device within an optional date range
// @access SUPER_ADMIN | ORG_ADMIN
const deleteReadings = async (req, res, next) => {
  try {
    const { deviceId, slaveId, startDate, endDate } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

    const where = { deviceId }
    if (slaveId) where.deviceConfigSlaveId = slaveId
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = new Date(startDate)
      if (endDate)   where.timestamp.lte = new Date(endDate)
    }

    const result = await prisma.sensorReading.deleteMany({ where })
    res.json({ success: true, deleted: result.count })
  } catch (err) { next(err) }
}

module.exports = { getLatest, getHistory, getAggregate, getDashboardSummary, getReadingsBrowse, downloadCSV, deleteReadings }
