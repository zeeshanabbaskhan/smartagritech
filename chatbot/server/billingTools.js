/**
 * billingTools.js  — Phase D2
 *
 * 8 billing/cost-analysis tool functions that compute numbers directly
 * from the in-memory CSV data. The LLM NEVER estimates PKR figures on its own —
 * it only phrases what these functions return.
 *
 * All functions are org-scoped (organizationId or orgName).
 */

const { db } = require('./dataLoader')

// ── helpers ───────────────────────────────────────────────────────────────────
const findOrg = (orgName) =>
  db.organizations.find(o => o.name.toLowerCase().includes(orgName.toLowerCase()))

const isoMonth = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

const NOW = new Date('2026-08-06T00:00:00.000Z')

const monthStart = (monthOffset) => {
  const d = new Date(NOW)
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCMonth(d.getUTCMonth() - monthOffset)
  return d
}

const monthEnd = (monthOffset) => {
  const start = monthStart(monthOffset)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return end
}

const filterByMonth = (rows, orgId, monthOffset) => {
  const start = monthStart(monthOffset)
  const end   = monthEnd(monthOffset)
  // For current month (offset=0), cap at NOW (today only has partial data)
  const effectiveEnd = monthOffset === 0 ? NOW : end
  return rows.filter(r =>
    r.organizationId === orgId &&
    new Date(r.startDate) >= start &&
    new Date(r.startDate) < effectiveEnd
  )
}

const sum = (arr, key) => arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0)

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1 — getMonthlyBill
// ─────────────────────────────────────────────────────────────────────────────
function getMonthlyBill({ orgName, monthOffset = 0 }) {
  const org = findOrg(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  const rows = filterByMonth(db.intervalHistories, org.id, monthOffset)
  if (rows.length === 0) return { error: `No interval data found for ${org.name} at monthOffset=${monthOffset}` }

  const totalKwh  = sum(rows, 'totalUnit')
  const totalCost = sum(rows, 'tariff')
  const label     = monthOffset === 0 ? 'Current month to date'
                  : monthOffset === 1 ? 'Last month'
                  : `${monthOffset} months ago`

  const start = monthStart(monthOffset)
  const end   = monthOffset === 0 ? NOW : monthEnd(monthOffset)

  // Per-device breakdown
  const byDevice = {}
  rows.forEach(r => {
    if (!byDevice[r.deviceName]) byDevice[r.deviceName] = { kwh: 0, cost: 0 }
    byDevice[r.deviceName].kwh  += parseFloat(r.totalUnit) || 0
    byDevice[r.deviceName].cost += parseFloat(r.tariff)    || 0
  })

  return {
    organization: org.name,
    period:       label,
    from:         start.toISOString().slice(0, 10),
    to:           (monthOffset === 0 ? NOW : monthEnd(monthOffset)).toISOString().slice(0, 10),
    totalKwh:     parseFloat(totalKwh.toFixed(2)),
    totalCostPKR: parseFloat(totalCost.toFixed(2)),
    deviceBreakdown: Object.entries(byDevice)
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([name, v]) => ({
        device: name,
        kwh:    parseFloat(v.kwh.toFixed(2)),
        costPKR: parseFloat(v.cost.toFixed(2)),
      })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2 — compareMonthlyBills
// ─────────────────────────────────────────────────────────────────────────────
function compareMonthlyBills({ orgName }) {
  const org = findOrg(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  const thisMonthRows = filterByMonth(db.intervalHistories, org.id, 0)
  const lastMonthRows = filterByMonth(db.intervalHistories, org.id, 1)

  if (thisMonthRows.length === 0 || lastMonthRows.length === 0) {
    return { error: `Insufficient data for comparison for ${org.name}` }
  }

  const thisCost  = sum(thisMonthRows, 'tariff')
  const lastCost  = sum(lastMonthRows, 'tariff')
  const thisKwh   = sum(thisMonthRows, 'totalUnit')
  const lastKwh   = sum(lastMonthRows, 'totalUnit')

  // Same period last month (first N days of last month, where N = days elapsed this month)
  const daysElapsed = Math.ceil((NOW - monthStart(0)) / 86400_000)
  const lastMonthSamePeriodEnd = new Date(monthStart(1))
  lastMonthSamePeriodEnd.setUTCDate(lastMonthSamePeriodEnd.getUTCDate() + daysElapsed)
  const lastMonthSamePeriod = lastMonthRows.filter(r => new Date(r.startDate) < lastMonthSamePeriodEnd)
  const lastSameCost = sum(lastMonthSamePeriod, 'tariff')
  const diffVsSamePeriod = parseFloat((thisCost - lastSameCost).toFixed(2))
  const pctVsSamePeriod  = lastSameCost > 0
    ? parseFloat(((diffVsSamePeriod / lastSameCost) * 100).toFixed(1))
    : null

  return {
    organization:       org.name,
    daysElapsedThisMonth: daysElapsed,
    thisMonthToDate: {
      from:     monthStart(0).toISOString().slice(0, 10),
      to:       NOW.toISOString().slice(0, 10),
      kwh:      parseFloat(thisKwh.toFixed(2)),
      costPKR:  parseFloat(thisCost.toFixed(2)),
    },
    lastMonthFull: {
      from:     monthStart(1).toISOString().slice(0, 10),
      to:       monthEnd(1).toISOString().slice(0, 10),
      kwh:      parseFloat(lastKwh.toFixed(2)),
      costPKR:  parseFloat(lastCost.toFixed(2)),
    },
    lastMonthSamePeriod: {
      days:     daysElapsed,
      costPKR:  parseFloat(lastSameCost.toFixed(2)),
    },
    vsLastMonthSamePeriod: {
      diffPKR:  diffVsSamePeriod,
      pctChange: pctVsSamePeriod,
      trend:    diffVsSamePeriod > 0 ? 'higher' : diffVsSamePeriod < 0 ? 'lower' : 'same',
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3 — getTopConsumingDevices
// ─────────────────────────────────────────────────────────────────────────────
function getTopConsumingDevices({ orgName, periodDays = 30 }) {
  const org = findOrg(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  const cutoff = new Date(NOW.getTime() - parseInt(periodDays) * 86400_000)
  const rows   = db.intervalHistories.filter(r =>
    r.organizationId === org.id && new Date(r.startDate) >= cutoff
  )

  if (rows.length === 0) return { error: `No data for ${org.name} in last ${periodDays} days` }

  const byDevice = {}
  rows.forEach(r => {
    if (!byDevice[r.deviceName]) byDevice[r.deviceName] = { kwh: 0, cost: 0, days: 0 }
    byDevice[r.deviceName].kwh  += parseFloat(r.totalUnit) || 0
    byDevice[r.deviceName].cost += parseFloat(r.tariff)    || 0
    byDevice[r.deviceName].days += 1
  })

  const ranked = Object.entries(byDevice)
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([name, v], i) => ({
      rank:          i + 1,
      device:        name,
      totalKwh:      parseFloat(v.kwh.toFixed(2)),
      totalCostPKR:  parseFloat(v.cost.toFixed(2)),
      avgDailyKwh:   parseFloat((v.kwh / v.days).toFixed(2)),
      avgDailyCostPKR: parseFloat((v.cost / v.days).toFixed(2)),
    }))

  const orgTotal = ranked.reduce((s, d) => s + d.totalCostPKR, 0)

  return {
    organization: org.name,
    periodDays:   parseInt(periodDays),
    totalCostPKR: parseFloat(orgTotal.toFixed(2)),
    devices:      ranked.map(d => ({
      ...d,
      sharePct: parseFloat(((d.totalCostPKR / orgTotal) * 100).toFixed(1)),
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 4 — getDailyConsumptionBreakdown
// ─────────────────────────────────────────────────────────────────────────────
function getDailyConsumptionBreakdown({ orgName, periodDays = 30 }) {
  const org = findOrg(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  const cutoff = new Date(NOW.getTime() - parseInt(periodDays) * 86400_000)
  const rows   = db.intervalHistories.filter(r =>
    r.organizationId === org.id && new Date(r.startDate) >= cutoff
  )

  if (rows.length === 0) return { error: `No data for ${org.name}` }

  const byDay = {}
  rows.forEach(r => {
    const day = r.startDate.slice(0, 10)
    if (!byDay[day]) byDay[day] = { kwh: 0, cost: 0 }
    byDay[day].kwh  += parseFloat(r.totalUnit) || 0
    byDay[day].cost += parseFloat(r.tariff)    || 0
  })

  const dailyList = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      kwh:     parseFloat(v.kwh.toFixed(2)),
      costPKR: parseFloat(v.cost.toFixed(2)),
    }))

  const sorted = [...dailyList].sort((a, b) => b.costPKR - a.costPKR)
  const avgCost = parseFloat((dailyList.reduce((s, d) => s + d.costPKR, 0) / dailyList.length).toFixed(2))

  return {
    organization: org.name,
    periodDays:   parseInt(periodDays),
    avgDailyCostPKR: avgCost,
    topDays:      sorted.slice(0, 5),
    dailyBreakdown: dailyList,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 5 — forecastMonthlyBill
// ─────────────────────────────────────────────────────────────────────────────
function forecastMonthlyBill({ orgName }) {
  const org = findOrg(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  const thisMonthRows = filterByMonth(db.intervalHistories, org.id, 0)
  const lastMonthRows = filterByMonth(db.intervalHistories, org.id, 1)

  if (thisMonthRows.length === 0) return { error: `No current month data for ${org.name}` }

  const daysElapsed  = Math.ceil((NOW - monthStart(0)) / 86400_000)
  const daysInMonth  = new Date(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 0).getUTCDate()
  const daysRemaining = daysInMonth - daysElapsed

  const thisCostSoFar = sum(thisMonthRows, 'tariff')
  const thisKwhSoFar  = sum(thisMonthRows, 'totalUnit')
  const avgDailyCost  = thisCostSoFar / daysElapsed
  const avgDailyKwh   = thisKwhSoFar  / daysElapsed

  const forecastedCost = parseFloat((avgDailyCost * daysInMonth).toFixed(2))
  const forecastedKwh  = parseFloat((avgDailyKwh  * daysInMonth).toFixed(2))

  const lastCost = lastMonthRows.length ? sum(lastMonthRows, 'tariff') : null
  const vsLast   = lastCost
    ? parseFloat((forecastedCost - lastCost).toFixed(2))
    : null

  return {
    organization:      org.name,
    currentMonth:      isoMonth(NOW),
    daysElapsed,
    daysInMonth,
    daysRemaining,
    toDateCostPKR:     parseFloat(thisCostSoFar.toFixed(2)),
    avgDailyCostPKR:   parseFloat(avgDailyCost.toFixed(2)),
    forecastedTotalCostPKR: forecastedCost,
    forecastedTotalKwh:     forecastedKwh,
    lastMonthActualCostPKR: lastCost ? parseFloat(lastCost.toFixed(2)) : null,
    forecastVsLastMonth: vsLast !== null ? {
      diffPKR:   vsLast,
      pctChange: parseFloat(((vsLast / lastCost) * 100).toFixed(1)),
      trend:     vsLast > 0 ? 'higher' : vsLast < 0 ? 'lower' : 'same',
    } : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 6 — getPowerFactorImpact
// ─────────────────────────────────────────────────────────────────────────────
function getPowerFactorImpact({ orgName }) {
  const org = findOrg(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  // Find power factor alarms for this org
  const pfAlarms = db.alarmHistories.filter(r =>
    r.organizationId === org.id &&
    r.variableName === 'PowerFactor'
  )

  // Get current PF readings for devices in this org
  const pfVars = db.deviceConfigVariables.filter(v =>
    v.organizationId === org.id && v.name === 'PowerFactor'
  )

  // Recent consumption for affected devices
  const cutoff = new Date(NOW.getTime() - 30 * 86400_000)
  const affectedDeviceIds = [...new Set(pfAlarms.map(a => a.deviceId))]

  const affectedConsumption = db.intervalHistories.filter(r =>
    affectedDeviceIds.includes(r.deviceId) &&
    new Date(r.startDate) >= cutoff
  )
  const affectedCost = sum(affectedConsumption, 'tariff')

  // NOTE: We do NOT compute a fabricated PKR saving — we return the alarm facts
  // and let the LLM explain qualitatively. Per the accuracy constraint.
  return {
    organization:   org.name,
    note:           'Savings estimate requires utility-specific penalty rates not in this dataset. Figures below are factual alarm data only.',
    powerFactorAlarms: pfAlarms.map(a => ({
      device:     a.deviceName,
      value:      parseFloat(a.currentValue),
      condition:  a.triggeringCondition,
      state:      a.alarmState,
      alarmTime:  a.alarmTime,
    })),
    currentReadings: pfVars.map(v => ({
      device:   v.deviceName,
      powerFactor: parseFloat(v.currentValue),
      status:   v.deviceStatus,
    })).filter(v => !isNaN(v.powerFactor)),
    affectedDevices30Days: {
      deviceCount:    affectedDeviceIds.length,
      totalCostPKR:   parseFloat(affectedCost.toFixed(2)),
      note:           'Total cost of affected devices over last 30 days. Poor power factor may increase apparent power drawn and attract utility penalties — exact penalty depends on your tariff schedule.',
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 7 — simulateConsumptionReduction
// ─────────────────────────────────────────────────────────────────────────────
function simulateConsumptionReduction({ orgName, deviceName, percentReduction, periodDays = 30 }) {
  const org = findOrg(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  const device = db.devices.find(d =>
    d.organizationId === org.id &&
    d.name.toLowerCase().includes(deviceName.toLowerCase())
  )
  if (!device) return { error: `No device matching "${deviceName}" in ${org.name}` }

  const cutoff = new Date(NOW.getTime() - parseInt(periodDays) * 86400_000)
  const deviceRows = db.intervalHistories.filter(r =>
    r.deviceId === device.id && new Date(r.startDate) >= cutoff
  )
  const orgRows = db.intervalHistories.filter(r =>
    r.organizationId === org.id && new Date(r.startDate) >= cutoff
  )

  if (deviceRows.length === 0) return { error: `No history for device "${device.name}"` }

  const factor        = parseFloat(percentReduction) / 100
  const actualCost    = sum(deviceRows, 'tariff')
  const actualKwh     = sum(deviceRows, 'totalUnit')
  const savedCost     = parseFloat((actualCost * factor).toFixed(2))
  const savedKwh      = parseFloat((actualKwh  * factor).toFixed(2))
  const orgTotalCost  = sum(orgRows, 'tariff')
  const newOrgCost    = parseFloat((orgTotalCost - savedCost).toFixed(2))

  return {
    organization:    org.name,
    device:          device.name,
    periodDays:      parseInt(periodDays),
    percentReduction: parseFloat(percentReduction),
    actual: {
      deviceKwh:    parseFloat(actualKwh.toFixed(2)),
      deviceCostPKR: parseFloat(actualCost.toFixed(2)),
      orgTotalCostPKR: parseFloat(orgTotalCost.toFixed(2)),
    },
    simulated: {
      deviceKwhSaved:   savedKwh,
      deviceCostSaved:  savedCost,
      newDeviceCostPKR: parseFloat((actualCost - savedCost).toFixed(2)),
      newOrgTotalCostPKR: newOrgCost,
      orgSavingPct: parseFloat(((savedCost / orgTotalCost) * 100).toFixed(1)),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 8 — getBudgetPlan
// ─────────────────────────────────────────────────────────────────────────────
function getBudgetPlan({ orgName, targetAmountPKR, monthOffset = 0 }) {
  const org = findOrg(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  // Get forecast
  const forecast = forecastMonthlyBill({ orgName })
  if (forecast.error) return forecast

  const target  = parseFloat(targetAmountPKR)
  const projected = forecast.forecastedTotalCostPKR
  const gap     = parseFloat((projected - target).toFixed(2))

  if (gap <= 0) {
    return {
      organization:   org.name,
      targetPKR:      target,
      forecastedPKR:  projected,
      status:         'on_track',
      message:        `Forecasted bill (PKR ${projected}) is already under your target of PKR ${target}. You are on track.`,
    }
  }

  // Which devices to cut to close the gap
  const top = getTopConsumingDevices({ orgName, periodDays: 30 })
  if (top.error) return top

  const reductionNeededPct = parseFloat(((gap / projected) * 100).toFixed(1))

  // Build a cut plan: greedily cut top devices by 20% each until gap is closed
  let remainingGap = gap
  const cutPlan = []
  for (const dev of top.devices) {
    if (remainingGap <= 0) break
    const maxSaving = parseFloat((dev.avgDailyCostPKR * forecast.daysInMonth * 0.2).toFixed(2))
    const actualCut = parseFloat(Math.min(maxSaving, remainingGap).toFixed(2))
    const cutPct    = parseFloat(((actualCut / (dev.avgDailyCostPKR * forecast.daysInMonth)) * 100).toFixed(1))
    cutPlan.push({
      device:          dev.device,
      suggestedCutPct: cutPct,
      estimatedSavingPKR: actualCut,
    })
    remainingGap -= actualCut
  }

  return {
    organization:         org.name,
    targetPKR:            target,
    forecastedPKR:        projected,
    gapPKR:               gap,
    overBudget:           true,
    reductionNeededPct,
    status:               'over_budget',
    cutPlan,
    note:                 'Cut plan estimates 20% reduction per device sequentially by cost rank. Actual savings depend on operational feasibility.',
  }
}

// ── Export all tools ──────────────────────────────────────────────────────────
module.exports = {
  getMonthlyBill,
  compareMonthlyBills,
  getTopConsumingDevices,
  getDailyConsumptionBreakdown,
  forecastMonthlyBill,
  getPowerFactorImpact,
  simulateConsumptionReduction,
  getBudgetPlan,
}
