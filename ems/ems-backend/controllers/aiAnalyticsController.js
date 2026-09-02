// ─── AI analytics controller ──────────────────────────────────────────────────
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, TIME_RANGE_MS, BUCKET_MS } = require('../utils/helpers')
const { bucketVariable, sumVariable, periodEnergyKwh } = require('../utils/sensorAggregation')
const { cached } = require('../utils/responseCache')
const { assertDeviceAccess } = require('../utils/deviceAccess')

const { getVariableAliases } = require('../utils/sensorAggregation')

const mapCurrentVars = (allVars, targetNames) => {
  const result = {}
  for (const t of targetNames) {
    const aliases = getVariableAliases(t)
    const match = allVars.find((v) => aliases.includes(v.name.trim().toLowerCase().replace(/[\s_-]+/g, '')))
    result[t] = match?.currentValue ?? null
  }
  return result
}

const buildVoltageAnalysis = async (deviceId, slaveId, timeRange) => {
  const startDate = new Date(Date.now() - (TIME_RANGE_MS[timeRange] || TIME_RANGE_MS['24h']))
  const bucketMs  = BUCKET_MS[timeRange] || BUCKET_MS['24h']
  const base      = { deviceId, slaveId: slaveId || null, startDate, bucketMs }

  const names = ['VoltageA', 'VoltageB', 'VoltageC', 'VoltageImbalance', 'THD_V']

  const [chartEntries, alarms, allVars] = await Promise.all([
    Promise.all(names.map(async (name) => [name, await bucketVariable(prisma, { ...base, variableName: name })])),
    prisma.deviceVariableAlarmHistory.findMany({
      where:  { deviceId, alarmTime: { gte: startDate } },
      select: { triggerType: true, variableName: true, alarmTime: true },
    }),
    prisma.deviceConfigVariable.findMany({
      where:  { deviceId, isActive: true },
      select: { name: true, currentValue: true },
    }),
  ])

  const charts  = Object.fromEntries(chartEntries)
  const current = mapCurrentVars(allVars, names)

  return {
    current,
    chartData: {
      voltageA:         charts.VoltageA ?? [],
      voltageB:         charts.VoltageB ?? [],
      voltageC:         charts.VoltageC ?? [],
      voltageImbalance: charts.VoltageImbalance ?? [],
      thdV:             charts.THD_V ?? [],
    },
    alarms: alarms.filter((a) => a.variableName?.toLowerCase().includes('voltage')),
  }
}

const getVoltageAnalysis = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h' } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))
    await assertDeviceAccess(deviceId, req.user)

    const cacheKey = `ai:voltage:${deviceId}:${slaveId || 'all'}:${timeRange}`
    const data = await cached(cacheKey, 45, () => buildVoltageAnalysis(deviceId, slaveId, timeRange))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const buildCurrentAnalysis = async (deviceId, slaveId, timeRange) => {
  const startDate = new Date(Date.now() - (TIME_RANGE_MS[timeRange] || TIME_RANGE_MS['24h']))
  const bucketMs  = BUCKET_MS[timeRange] || BUCKET_MS['24h']
  const base      = { deviceId, slaveId: slaveId || null, startDate, bucketMs }
  const names     = ['CurrentA', 'CurrentB', 'CurrentC', 'CurrentImbalance', 'THD_I']

  const [chartEntries, allVars] = await Promise.all([
    Promise.all(names.map(async (name) => [name, await bucketVariable(prisma, { ...base, variableName: name })])),
    prisma.deviceConfigVariable.findMany({
      where:  { deviceId, isActive: true },
      select: { name: true, currentValue: true },
    }),
  ])

  const charts  = Object.fromEntries(chartEntries)
  const current = mapCurrentVars(allVars, names)

  return {
    current,
    chartData: {
      currentA:         charts.CurrentA ?? [],
      currentB:         charts.CurrentB ?? [],
      currentC:         charts.CurrentC ?? [],
      currentImbalance: charts.CurrentImbalance ?? [],
      thdI:             charts.THD_I ?? [],
    },
  }
}

const getCurrentAnalysis = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h' } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))
    await assertDeviceAccess(deviceId, req.user)

    const cacheKey = `ai:current:${deviceId}:${slaveId || 'all'}:${timeRange}`
    const data = await cached(cacheKey, 45, () => buildCurrentAnalysis(deviceId, slaveId, timeRange))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const buildPowerFactorAnalysis = async (deviceId, slaveId, timeRange) => {
  const startDate = new Date(Date.now() - (TIME_RANGE_MS[timeRange] || TIME_RANGE_MS['24h']))
  const bucketMs  = BUCKET_MS[timeRange] || BUCKET_MS['24h']
  const base      = { deviceId, slaveId: slaveId || null, startDate, bucketMs }

  const [chartData, allVars, alarms, forecast] = await Promise.all([
    bucketVariable(prisma, { ...base, variableName: 'PowerFactor' }),
    prisma.deviceConfigVariable.findMany({ where: { deviceId, isActive: true }, select: { name: true, currentValue: true } }),
    prisma.deviceVariableAlarmHistory.findMany({
      where:   { deviceId, alarmTime: { gte: startDate } },
      orderBy: { alarmTime: 'desc' },
      take:    10,
    }),
    prisma.aIForecastReading.findFirst({ where: { deviceId, variableName: 'PowerFactor' }, orderBy: { generatedAt: 'desc' } }),
  ])

  const current = mapCurrentVars(allVars, ['PowerFactor']).PowerFactor

  return {
    current,
    chartData,
    alarms: alarms.filter((a) => a.variableName?.toLowerCase().includes('power factor') || a.variableName === 'PowerFactor'),
    predictedChart: forecast ? (Array.isArray(forecast.predictions) ? forecast.predictions : []) : [],
  }
}

const getPowerFactorAnalysis = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h' } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))
    await assertDeviceAccess(deviceId, req.user)

    const cacheKey = `ai:pf:${deviceId}:${slaveId || 'all'}:${timeRange}`
    const data = await cached(cacheKey, 45, () => buildPowerFactorAnalysis(deviceId, slaveId, timeRange))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const buildEnergyAnalysis = async (deviceId, slaveId, timeRange) => {
  const startDate = new Date(Date.now() - (TIME_RANGE_MS[timeRange] || TIME_RANGE_MS['24h']))
  const bucketMs  = BUCKET_MS[timeRange] || BUCKET_MS['24h']
  const base      = { deviceId, slaveId: slaveId || null, startDate, bucketMs }
  const now       = Date.now()
  const slave     = slaveId || null

  const savingsBlock = async (curStart, curEnd, priorStart, priorEnd) => {
    const [current, previous] = await Promise.all([
      periodEnergyKwh(prisma, { deviceId, slaveId: slave, startDate: curStart, endDate: curEnd }),
      periodEnergyKwh(prisma, { deviceId, slaveId: slave, startDate: priorStart, endDate: priorEnd }),
    ])
    const cur = Number(current) || 0
    const prev = Number(previous) || 0
    return {
      current: cur,
      previous: prev,
      percentage: prev === 0 ? (cur > 0 ? 100 : 0) : parseFloat((((cur - prev) / prev) * 100).toFixed(2)),
      percentChange: prev === 0 ? (cur > 0 ? 100 : 0) : parseFloat((((cur - prev) / prev) * 100).toFixed(2)),
    }
  }

  const [chartData, totalConsumption, energyDelta, currentVars, forecast, dailyComparison, weeklyComparison, monthlyComparison] = await Promise.all([
    bucketVariable(prisma, { ...base, variableName: 'PowerConsumption' }),
    sumVariable(prisma, { ...base, variableName: 'PowerConsumption' }),
    periodEnergyKwh(prisma, { deviceId, slaveId: slave, startDate }),
    prisma.deviceConfigVariable.findMany({
      where:  { deviceId, name: { in: ['PowerConsumption', 'ActivePower', 'Energy'] } },
      select: { name: true, currentValue: true },
    }),
    prisma.aIForecastReading.findFirst({ where: { deviceId, variableName: 'PowerConsumption' }, orderBy: { generatedAt: 'desc' } }),
    savingsBlock(new Date(now - 86_400_000),   new Date(now), new Date(now - 172_800_000),   new Date(now - 86_400_000)),
    savingsBlock(new Date(now - 604_800_000),  new Date(now), new Date(now - 1_209_600_000), new Date(now - 604_800_000)),
    savingsBlock(new Date(now - 2_592_000_000),new Date(now), new Date(now - 5_184_000_000), new Date(now - 2_592_000_000)),
  ])

  return {
    current:          Object.fromEntries(currentVars.map((v) => [v.name, v.currentValue])),
    totalConsumption: energyDelta > 0 ? energyDelta : totalConsumption,
    chartData,
    predictedChart:   forecast ? (Array.isArray(forecast.predictions) ? forecast.predictions : []) : [],
    dailyComparison,
    weeklyComparison,
    monthlyComparison,
  }
}

const getEnergyAnalysis = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h' } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))
    await assertDeviceAccess(deviceId, req.user)

    const cacheKey = `ai:energy:${deviceId}:${slaveId || 'all'}:${timeRange}`
    const data = await cached(cacheKey, 45, () => buildEnergyAnalysis(deviceId, slaveId, timeRange))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Retrieve the latest AI forecast for a device variable (optional date filter)
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getPredictions = async (req, res, next) => {
  try {
    const { deviceId, variableName, horizon, from, to } = req.query
    if (!deviceId || !variableName) return next(new AppError('deviceId and variableName are required', 400))
    await assertDeviceAccess(deviceId, req.user)

    const where = { deviceId, variableName, ...orgScope(req.user) }
    if (horizon) where.horizon = horizon

    const forecast = await prisma.aIForecastReading.findFirst({ where, orderBy: { generatedAt: 'desc' } })
    if (!forecast) return res.json({ success: true, data: null })

    let predictions = Array.isArray(forecast.predictions) ? forecast.predictions : []
    if (from || to) {
      predictions = predictions.filter((p) => {
        const ts = new Date(p.timestamp).getTime()
        if (from && ts < new Date(from).getTime()) return false
        if (to   && ts > new Date(to).getTime())   return false
        return true
      })
    }

    res.json({ success: true, data: { ...forecast, predictions } })
  } catch (err) { next(err) }
}

module.exports = { getPredictions, getVoltageAnalysis, getCurrentAnalysis, getPowerFactorAnalysis, getEnergyAnalysis }
