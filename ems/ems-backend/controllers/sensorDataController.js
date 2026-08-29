// ─── Sensor data controller ───────────────────────────────────────────────────
// Reads raw SensorReading rows and aggregates them for the Flutter dashboard.
// All queries scope to a single device; access is checked via authoriseDevice().
const prisma      = require('../config/database')
const redis       = require('../config/redis')
const { AppError } = require('../middleware/errorHandler')
const { TIME_RANGE_MS, BUCKET_MS, paginate, parseDateBound } = require('../utils/helpers')
const { bucketVariable, sumVariable, periodEnergyKwh } = require('../utils/sensorAggregation')
const { cached } = require('../utils/responseCache')
const { assertDeviceAccess } = require('../utils/deviceAccess')
const { readLatest } = require('../utils/redisLatest')
const {
  PREFERRED_METRIC_COLUMNS,
  IDENTITY_COLUMNS,
  formatReceivedTime,
  deviceDataFilename,
  csvLine,
  pivotReadingsArray,
} = require('../utils/deviceDataExport')

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
const authoriseDevice = (deviceId, user) => assertDeviceAccess(deviceId, user)

const isSwitchOff = (device) => String(device?.switchState || '').toUpperCase() === 'OFF'

const emptyDashboardSummary = () => ({
  totalPowerConsumption: { value: 0, chartData: [] },
  totalExportPower:      { value: 0, chartData: [] },
  voltageImbalance:      { value: null, chartData: [] },
  currentImbalance:      { value: null, chartData: [] },
  powerFactor:           { value: null, chartData: [] },
  thdV:                  { value: null, chartData: [] },
  thdI:                  { value: null, chartData: [] },
  frequency:             { value: null, chartData: [] },
  anomalies: { count: 0, breakdown: [], chartData: [] },
  energySavingsComparison: {
    daily:   { current: 0, previous: 0, percentage: 0 },
    weekly:  { current: 0, previous: 0, percentage: 0 },
    monthly: { current: 0, previous: 0, percentage: 0 },
  },
  switchOff: true,
})

/** Case-insensitive, space-stripped variable name match. */
const variableNameMatches = (candidate, variableName) => {
  const want = String(variableName).replace(/\s+/g, '').toLowerCase()
  const name = String(candidate || '').replace(/\s+/g, '').toLowerCase()
  return name === want || String(candidate) === variableName
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
    const entry = arr.find((r) => variableNameMatches(r.variableName, variableName))
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

    const device = await authoriseDevice(deviceId, req.user)
    if (isSwitchOff(device)) {
      return res.json({
        success: true,
        data: {},
        timestamp: null,
        switchOff: true,
        message: 'Device switch is OFF — live data hidden',
      })
    }

    // P-09: serve hot latest values from Redis when available.
    // When slaveId is set, readLatest uses ONLY the scoped key — no legacy/other-slave merge.
    if (redis.getClient()) {
      try {
        const hot = await readLatest(deviceId, slaveId || null)
        if (Object.keys(hot).length) {
          const where = { deviceId, isActive: true }
          if (slaveId) where.deviceConfigSlaveId = slaveId
          const vars = await prisma.deviceConfigVariable.findMany({
            where,
            select: { name: true, unit: true, lastUpdatedAt: true },
          })
          const meta = Object.fromEntries(vars.map((v) => [v.name, v]))
          const freshAt = device.lastDataReceivedAt ?? null
          const data = {}
          // Intersect Redis hot keys with config vars for this slave (or primary slave when no slaveId).
          for (const [name, metaRow] of Object.entries(meta)) {
            if (!(name in hot)) continue
            data[name] = {
              value:         hot[name],
              unit:          metaRow?.unit ?? null,
              lastUpdatedAt: freshAt ?? metaRow?.lastUpdatedAt ?? null,
            }
          }
          if (Object.keys(data).length) {
            return res.json({ success: true, data, timestamp: device.lastDataReceivedAt ?? null, source: 'redis' })
          }
          // Slave filter / intersect yielded nothing — fall through to Postgres.
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

    res.json({ success: true, data, timestamp: device.lastDataReceivedAt ?? null })
  } catch (err) { next(err) }
}

// @desc  Raw historical readings for a single variable (most-recent first, limit rows)
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices)
const getHistory = async (req, res, next) => {
  try {
    const { deviceId, slaveId, variableName, startDate, endDate, limit = 50, skip = 0 } = req.query
    if (!deviceId || !variableName) return next(new AppError('deviceId and variableName are required', 400))

    const device = await authoriseDevice(deviceId, req.user)
    if (isSwitchOff(device)) {
      return res.json({ success: true, count: 0, fetched: 0, data: [], switchOff: true })
    }

    const where = { deviceId }
    if (slaveId) where.deviceConfigSlaveId = slaveId
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = parseDateBound(startDate, 'start')
      if (endDate)   where.timestamp.lte = parseDateBound(endDate, 'end')
    }

    // Date-bounded queries may page through a long interval; unbounded "latest" stays small.
    const requested = Math.max(1, parseInt(limit, 10) || 50)
    const maxTake   = (startDate || endDate) ? 5000 : 100
    const take      = Math.min(maxTake, requested)
    const skipN     = Math.max(0, parseInt(skip, 10) || 0)

    const rows = await prisma.sensorReading.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip:    skipN,
      take,
      select:  { timestamp: true, readings: true },
    })

    const data = []
    for (const row of rows) {
      const arr   = Array.isArray(row.readings) ? row.readings : []
      const entry = arr.find((r) => variableNameMatches(r.variableName, variableName))
      if (entry) data.push({ variableName: entry.variableName, value: entry.value, unit: entry.unit, receivedTime: row.timestamp })
    }

    res.json({ success: true, count: data.length, fetched: rows.length, data })
  } catch (err) { next(err) }
}

/** Pick a chart-friendly bucket width for an arbitrary [start, end] span. */
const bucketMsForSpan = (spanMs) => {
  if (spanMs <= 2 * 3_600_000) return 60_000            // ≤2h → 1 min
  if (spanMs <= 86_400_000) return 15 * 60_000          // ≤1d → 15 min
  if (spanMs <= 7 * 86_400_000) return 3_600_000        // ≤7d → 1 hour
  if (spanMs <= 30 * 86_400_000) return 6 * 3_600_000   // ≤30d → 6 hour
  return 86_400_000                                      // else → 1 day
}

// @desc  Time-bucketed aggregate for a single variable over a named or custom window
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices)
const getAggregate = async (req, res, next) => {
  try {
    const { deviceId, slaveId, variableName, timeRange, startDate, endDate } = req.query
    if (!deviceId || !variableName) {
      return next(new AppError('deviceId and variableName are required', 400))
    }
    if (!timeRange && !startDate && !endDate) {
      return next(new AppError('timeRange or startDate/endDate is required', 400))
    }

    const device = await authoriseDevice(deviceId, req.user)
    if (isSwitchOff(device)) {
      return res.json({ success: true, timeRange: timeRange || null, data: [], switchOff: true })
    }

    let rangeStart
    let rangeEnd = null
    let bucketMs

    if (startDate || endDate) {
      rangeStart = startDate ? parseDateBound(startDate, 'start') : new Date(0)
      rangeEnd = endDate ? parseDateBound(endDate, 'end') : new Date()
      const span = Math.max(0, rangeEnd.getTime() - rangeStart.getTime())
      bucketMs = bucketMsForSpan(span || 86_400_000)
    } else {
      rangeStart = startOfRange(timeRange)
      bucketMs = BUCKET_MS[timeRange]
    }

    // Prefer SQL bucketing (Timescale hourly / raw) so long ranges stay bounded for any device.
    const data = await bucketVariable(prisma, {
      deviceId,
      slaveId: slaveId || null,
      variableName,
      startDate: rangeStart,
      endDate: rangeEnd,
      bucketMs,
    })

    res.json({
      success: true,
      timeRange: timeRange || null,
      startDate: rangeStart,
      endDate: rangeEnd,
      data,
    })
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
    'ActivePower', 'PowerConsumption', 'ExportPower', 'VoltageImbalance', 'CurrentImbalance',
    'PowerFactor', 'THD_V', 'THD_I', 'Frequency', 'Energy',
  ]

  const [charts, totalPower, totalActive, totalExport, latestVars] = await Promise.all([
    Promise.all(metricNames.map(async (name) => [
      name,
      await bucketVariable(prisma, { ...base, variableName: name, bucketMs }),
    ])),
    sumVariable(prisma, { ...base, variableName: 'PowerConsumption' }),
    sumVariable(prisma, { ...base, variableName: 'ActivePower' }),
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

  // Prefer PowerConsumption history; fall back to ActivePower (W → kW) for MQTT devices
  const powerChartRaw = (chartMap.PowerConsumption?.length ? chartMap.PowerConsumption : null)
    || (chartMap.ActivePower || []).map((p) => ({
      ...p,
      value: Number.isFinite(Number(p.value)) ? Number(p.value) / 1000 : p.value,
    }))
  const powerValue = totalPower > 0
    ? totalPower
    : (totalActive > 0 ? totalActive / 1000 : (latestNum('ActivePower') != null ? latestNum('ActivePower') / 1000 : 0))

  const savingsBlock = async (curStart, curEnd, priorStart, priorEnd) => {
    const [current, previous] = await Promise.all([
      periodEnergyKwh(prisma, { deviceId, slaveId: slaveId || null, startDate: curStart, endDate: curEnd }),
      periodEnergyKwh(prisma, { deviceId, slaveId: slaveId || null, startDate: priorStart, endDate: priorEnd }),
    ])
    const cur = Number(current) || 0
    const prev = Number(previous) || 0
    return {
      current: cur,
      previous: prev,
      percentage: prev === 0 ? (cur > 0 ? 100 : 0) : parseFloat((((cur - prev) / prev) * 100).toFixed(2)),
    }
  }

  const summary = {
    totalPowerConsumption: { value: powerValue, chartData: powerChartRaw },
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

    const device = await authoriseDevice(deviceId, req.user)
    if (isSwitchOff(device)) {
      return res.json({ success: true, timeRange, data: emptyDashboardSummary(), switchOff: true })
    }

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

    const device = await authoriseDevice(deviceId, req.user)
    if (isSwitchOff(device)) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        page: 1,
        pages: 0,
        hasMore: false,
        switchOff: true,
      })
    }

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

// @desc  Stream sensor data as wide DeviceData CSV (one row per timestamp)
// @access SUPER_ADMIN | ORG_ADMIN | USER (own devices)
const downloadCSV = async (req, res, next) => {
  try {
    const { deviceId, slaveId, startDate, endDate, timeRange } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

    const device = await authoriseDevice(deviceId, req.user)
    const filename = deviceDataFilename()
    const emptyHeader = csvLine([...IDENTITY_COLUMNS, ...PREFERRED_METRIC_COLUMNS])

    if (isSwitchOff(device)) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      return res.end(emptyHeader + '\n')
    }

    const where = { deviceId }
    if (slaveId) where.deviceConfigSlaveId = slaveId
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = parseDateBound(startDate, 'start')
      if (endDate)   where.timestamp.lte = parseDateBound(endDate, 'end')
    } else if (timeRange && TIME_RANGE_MS[timeRange]) {
      where.timestamp = { gte: new Date(Date.now() - TIME_RANGE_MS[timeRange]) }
    }

    // Collect batches so we can omit preferred columns that never appear (CF subset style).
    const MAX_ROWS = 50_000
    const collected = []
    const usedPreferred = new Set()
    const extraKeys = new Set()
    let skip = 0
    const BATCH = 500

    while (collected.length < MAX_ROWS) {
      const take = Math.min(BATCH, MAX_ROWS - collected.length)
      const rows = await prisma.sensorReading.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        select: {
          timestamp: true,
          readings: true,
          configSlave: { select: { name: true } },
        },
      })
      if (!rows.length) break
      for (const row of rows) {
        const { metrics, extras } = pivotReadingsArray(row.readings)
        for (const [k, v] of Object.entries(metrics)) {
          if (v !== undefined && v !== '') usedPreferred.add(k)
        }
        for (const [k, v] of Object.entries(extras)) {
          if (v !== undefined && v !== '') extraKeys.add(k)
        }
        collected.push({
          deviceName: device.name || '',
          slaveName: row.configSlave?.name || '',
          receivedTime: formatReceivedTime(row.timestamp),
          metrics,
          extras,
        })
      }
      if (rows.length < take) break
      skip += rows.length
    }

    const metricCols = PREFERRED_METRIC_COLUMNS.filter((c) => usedPreferred.has(c))
    const extraCols = [...extraKeys].sort()
    const header = [...IDENTITY_COLUMNS, ...metricCols, ...extraCols]

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.write(csvLine(header) + '\n')
    for (const r of collected) {
      res.write(csvLine([
        r.deviceName,
        r.slaveName,
        r.receivedTime,
        ...metricCols.map((c) => r.metrics[c] ?? ''),
        ...extraCols.map((c) => r.extras[c] ?? ''),
      ]) + '\n')
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
      if (startDate) where.timestamp.gte = parseDateBound(startDate, 'start')
      if (endDate)   where.timestamp.lte = parseDateBound(endDate, 'end')
    }

    const result = await prisma.sensorReading.deleteMany({ where })
    res.json({ success: true, deleted: result.count })
  } catch (err) { next(err) }
}

module.exports = { getLatest, getHistory, getAggregate, getDashboardSummary, getReadingsBrowse, downloadCSV, deleteReadings }
