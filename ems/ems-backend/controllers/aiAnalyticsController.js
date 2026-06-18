// ─── AI analytics controller ──────────────────────────────────────────────────
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, TIME_RANGE_MS, BUCKET_MS } = require('../utils/helpers')
const { bucketVariable, sumVariable } = require('../utils/sensorAggregation')
const { cached } = require('../utils/responseCache')

const buildVoltageAnalysis = async (deviceId, slaveId, timeRange) => {
  const startDate = new Date(Date.now() - (TIME_RANGE_MS[timeRange] || TIME_RANGE_MS['24h']))
  const bucketMs  = BUCKET_MS[timeRange] || BUCKET_MS['24h']
  const base      = { deviceId, slaveId: slaveId || null, startDate, bucketMs }

  const names = ['VoltageA', 'VoltageB', 'VoltageC', 'VoltageImbalance', 'THD_V']

  const [chartEntries, alarms, currentVars] = await Promise.all([
    Promise.all(names.map(async (name) => [name, await bucketVariable(prisma, { ...base, variableName: name })])),
    prisma.deviceVariableAlarmHistory.findMany({
      where:  { deviceId, alarmTime: { gte: startDate } },
      select: { triggerType: true, variableName: true, alarmTime: true },
    }),
    prisma.deviceConfigVariable.findMany({
      where:  { deviceId, name: { in: names } },
      select: { name: true, currentValue: true },
    }),
  ])

  const charts  = Object.fromEntries(chartEntries)
  const current = Object.fromEntries(currentVars.map((v) => [v.name, v.currentValue]))

  return {
    current,
    chartData: {
      voltageA:         charts.VoltageA ?? [],
      voltageB:         charts.VoltageB ?? [],
      voltageC:         charts.VoltageC ?? [],
      voltageImbalance: charts.VoltageImbalance ?? [],
      thdV:             charts.THD_V ?? [],
    },
    alarms: alarms.filter((a) => a.variableName?.startsWith('Voltage')),
  }
}

const getVoltageAnalysis = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h' } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

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

  const [chartEntries, currentVars] = await Promise.all([
    Promise.all(names.map(async (name) => [name, await bucketVariable(prisma, { ...base, variableName: name })])),
    prisma.deviceConfigVariable.findMany({
      where:  { deviceId, name: { in: names } },
      select: { name: true, currentValue: true },
    }),
  ])

  const charts  = Object.fromEntries(chartEntries)
  const current = Object.fromEntries(currentVars.map((v) => [v.name, v.currentValue]))

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

    const cacheKey = `ai:current:${deviceId}:${slaveId || 'all'}:${timeRange}`
    const data = await cached(cacheKey, 45, () => buildCurrentAnalysis(deviceId, slaveId, timeRange))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const buildPowerFactorAnalysis = async (deviceId, slaveId, timeRange) => {
  const startDate = new Date(Date.now() - (TIME_RANGE_MS[timeRange] || TIME_RANGE_MS['24h']))
  const bucketMs  = BUCKET_MS[timeRange] || BUCKET_MS['24h']
  const base      = { deviceId, slaveId: slaveId || null, startDate, bucketMs }

  const [chartData, currentVars, alarms, forecast] = await Promise.all([
    bucketVariable(prisma, { ...base, variableName: 'PowerFactor' }),
    prisma.deviceConfigVariable.findMany({ where: { deviceId, name: 'PowerFactor' }, select: { name: true, currentValue: true } }),
    prisma.deviceVariableAlarmHistory.findMany({
      where:   { deviceId, variableName: 'PowerFactor', alarmTime: { gte: startDate } },
      orderBy: { alarmTime: 'desc' },
      take:    10,
    }),
    prisma.aIForecastReading.findFirst({ where: { deviceId, variableName: 'PowerFactor' }, orderBy: { generatedAt: 'desc' } }),
  ])

  return {
    current:        currentVars[0]?.currentValue ?? null,
    chartData,
    alarms,
    predictedChart: forecast ? (Array.isArray(forecast.predictions) ? forecast.predictions : []) : [],
  }
}

const getPowerFactorAnalysis = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h' } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

    const cacheKey = `ai:pf:${deviceId}:${slaveId || 'all'}:${timeRange}`
    const data = await cached(cacheKey, 45, () => buildPowerFactorAnalysis(deviceId, slaveId, timeRange))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const buildEnergyAnalysis = async (deviceId, slaveId, timeRange) => {
  const startDate = new Date(Date.now() - (TIME_RANGE_MS[timeRange] || TIME_RANGE_MS['24h']))
  const bucketMs  = BUCKET_MS[timeRange] || BUCKET_MS['24h']
  const base      = { deviceId, slaveId: slaveId || null, startDate, bucketMs }

  const [chartData, totalConsumption, currentVars, forecast] = await Promise.all([
    bucketVariable(prisma, { ...base, variableName: 'PowerConsumption' }),
    sumVariable(prisma, { ...base, variableName: 'PowerConsumption' }),
    prisma.deviceConfigVariable.findMany({
      where:  { deviceId, name: { in: ['PowerConsumption', 'ActivePower'] } },
      select: { name: true, currentValue: true },
    }),
    prisma.aIForecastReading.findFirst({ where: { deviceId, variableName: 'PowerConsumption' }, orderBy: { generatedAt: 'desc' } }),
  ])

  return {
    current:          Object.fromEntries(currentVars.map((v) => [v.name, v.currentValue])),
    totalConsumption,
    chartData,
    predictedChart:   forecast ? (Array.isArray(forecast.predictions) ? forecast.predictions : []) : [],
  }
}

const getEnergyAnalysis = async (req, res, next) => {
  try {
    const { deviceId, slaveId, timeRange = '24h' } = req.query
    if (!deviceId) return next(new AppError('deviceId is required', 400))

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
