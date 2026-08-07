/**
 * Billing / cost-analysis tools backed by Prisma IntervalHistory.
 * Org scope always comes from ctx.organizationId (JWT).
 */

const prisma = require('../../config/database')
const { resolveOrg } = require('./chatbotTools')

const isoMonth = (date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

const monthStart = (now, monthOffset) => {
  const d = new Date(now)
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCMonth(d.getUTCMonth() - monthOffset)
  return d
}

const monthEnd = (now, monthOffset) => {
  const start = monthStart(now, monthOffset)
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return end
}

const sum = (arr, key) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0)

async function loadMonthRows(orgId, monthOffset, now = new Date()) {
  const start = monthStart(now, monthOffset)
  const end = monthEnd(now, monthOffset)
  const effectiveEnd = monthOffset === 0 ? now : end

  return prisma.intervalHistory.findMany({
    where: {
      organizationId: orgId,
      startDate: { gte: start, lt: effectiveEnd },
    },
    include: { device: { select: { id: true, name: true } } },
  })
}

async function getMonthlyBill(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved
  const now = new Date()
  const monthOffset = parseInt(args.monthOffset, 10) || 0

  const rows = await loadMonthRows(org.id, monthOffset, now)
  if (rows.length === 0) {
    return { error: `No interval data found for ${org.name} at monthOffset=${monthOffset}` }
  }

  const totalKwh = sum(rows, 'totalUnit')
  const totalCost = sum(rows, 'tariff')
  const label =
    monthOffset === 0
      ? 'Current month to date'
      : monthOffset === 1
        ? 'Last month'
        : `${monthOffset} months ago`

  const byDevice = {}
  for (const r of rows) {
    const name = r.device?.name || 'Unknown'
    if (!byDevice[name]) byDevice[name] = { kwh: 0, cost: 0 }
    byDevice[name].kwh += r.totalUnit || 0
    byDevice[name].cost += r.tariff || 0
  }

  return {
    organization: org.name,
    period: label,
    from: monthStart(now, monthOffset).toISOString().slice(0, 10),
    to: (monthOffset === 0 ? now : monthEnd(now, monthOffset)).toISOString().slice(0, 10),
    totalKwh: parseFloat(totalKwh.toFixed(2)),
    totalCostPKR: parseFloat(totalCost.toFixed(2)),
    deviceBreakdown: Object.entries(byDevice)
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([name, v]) => ({
        device: name,
        kwh: parseFloat(v.kwh.toFixed(2)),
        costPKR: parseFloat(v.cost.toFixed(2)),
      })),
  }
}

async function compareMonthlyBills(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved
  const now = new Date()

  const [thisMonthRows, lastMonthRows] = await Promise.all([
    loadMonthRows(org.id, 0, now),
    loadMonthRows(org.id, 1, now),
  ])

  if (thisMonthRows.length === 0 || lastMonthRows.length === 0) {
    return { error: `Insufficient data for comparison for ${org.name}` }
  }

  const thisCost = sum(thisMonthRows, 'tariff')
  const lastCost = sum(lastMonthRows, 'tariff')
  const thisKwh = sum(thisMonthRows, 'totalUnit')
  const lastKwh = sum(lastMonthRows, 'totalUnit')

  const daysElapsed = Math.ceil((now - monthStart(now, 0)) / 86400_000)
  const lastMonthSamePeriodEnd = new Date(monthStart(now, 1))
  lastMonthSamePeriodEnd.setUTCDate(lastMonthSamePeriodEnd.getUTCDate() + daysElapsed)
  const lastMonthSamePeriod = lastMonthRows.filter((r) => r.startDate < lastMonthSamePeriodEnd)
  const lastSameCost = sum(lastMonthSamePeriod, 'tariff')
  const diffVsSamePeriod = parseFloat((thisCost - lastSameCost).toFixed(2))
  const pctVsSamePeriod =
    lastSameCost > 0 ? parseFloat(((diffVsSamePeriod / lastSameCost) * 100).toFixed(1)) : null

  return {
    organization: org.name,
    daysElapsedThisMonth: daysElapsed,
    thisMonthToDate: {
      from: monthStart(now, 0).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      kwh: parseFloat(thisKwh.toFixed(2)),
      costPKR: parseFloat(thisCost.toFixed(2)),
    },
    lastMonthFull: {
      from: monthStart(now, 1).toISOString().slice(0, 10),
      to: monthEnd(now, 1).toISOString().slice(0, 10),
      kwh: parseFloat(lastKwh.toFixed(2)),
      costPKR: parseFloat(lastCost.toFixed(2)),
    },
    lastMonthSamePeriod: {
      days: daysElapsed,
      costPKR: parseFloat(lastSameCost.toFixed(2)),
    },
    vsLastMonthSamePeriod: {
      diffPKR: diffVsSamePeriod,
      pctChange: pctVsSamePeriod,
      trend: diffVsSamePeriod > 0 ? 'higher' : diffVsSamePeriod < 0 ? 'lower' : 'same',
    },
  }
}

async function getTopConsumingDevices(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved
  const now = new Date()
  const periodDays = parseInt(args.periodDays, 10) || 30
  const cutoff = new Date(now.getTime() - periodDays * 86400_000)

  const rows = await prisma.intervalHistory.findMany({
    where: { organizationId: org.id, startDate: { gte: cutoff } },
    include: { device: { select: { name: true } } },
  })

  if (rows.length === 0) return { error: `No data for ${org.name} in last ${periodDays} days` }

  const byDevice = {}
  for (const r of rows) {
    const name = r.device?.name || 'Unknown'
    if (!byDevice[name]) byDevice[name] = { kwh: 0, cost: 0, days: 0 }
    byDevice[name].kwh += r.totalUnit || 0
    byDevice[name].cost += r.tariff || 0
    byDevice[name].days += 1
  }

  const ranked = Object.entries(byDevice)
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([name, v], i) => ({
      rank: i + 1,
      device: name,
      totalKwh: parseFloat(v.kwh.toFixed(2)),
      totalCostPKR: parseFloat(v.cost.toFixed(2)),
      avgDailyKwh: parseFloat((v.kwh / Math.max(1, v.days)).toFixed(2)),
      avgDailyCostPKR: parseFloat((v.cost / Math.max(1, v.days)).toFixed(2)),
    }))

  const orgTotal = ranked.reduce((s, d) => s + d.totalCostPKR, 0)

  return {
    organization: org.name,
    periodDays,
    totalCostPKR: parseFloat(orgTotal.toFixed(2)),
    devices: ranked.map((d) => ({
      ...d,
      sharePct: orgTotal > 0 ? parseFloat(((d.totalCostPKR / orgTotal) * 100).toFixed(1)) : 0,
    })),
  }
}

async function getDailyConsumptionBreakdown(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved
  const now = new Date()
  const periodDays = parseInt(args.periodDays, 10) || 30
  const cutoff = new Date(now.getTime() - periodDays * 86400_000)

  const rows = await prisma.intervalHistory.findMany({
    where: { organizationId: org.id, startDate: { gte: cutoff } },
  })

  if (rows.length === 0) return { error: `No data for ${org.name}` }

  const byDay = {}
  for (const r of rows) {
    const day = r.startDate.toISOString().slice(0, 10)
    if (!byDay[day]) byDay[day] = { kwh: 0, cost: 0 }
    byDay[day].kwh += r.totalUnit || 0
    byDay[day].cost += r.tariff || 0
  }

  const dailyList = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      kwh: parseFloat(v.kwh.toFixed(2)),
      costPKR: parseFloat(v.cost.toFixed(2)),
    }))

  const sorted = [...dailyList].sort((a, b) => b.costPKR - a.costPKR)
  const avgCost = parseFloat(
    (dailyList.reduce((s, d) => s + d.costPKR, 0) / Math.max(1, dailyList.length)).toFixed(2)
  )

  return {
    organization: org.name,
    periodDays,
    avgDailyCostPKR: avgCost,
    topDays: sorted.slice(0, 5),
    dailyBreakdown: dailyList,
  }
}

async function forecastMonthlyBill(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved
  const now = new Date()

  const [thisMonthRows, lastMonthRows] = await Promise.all([
    loadMonthRows(org.id, 0, now),
    loadMonthRows(org.id, 1, now),
  ])

  if (thisMonthRows.length === 0) return { error: `No current month data for ${org.name}` }

  const daysElapsed = Math.max(1, Math.ceil((now - monthStart(now, 0)) / 86400_000))
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const daysRemaining = daysInMonth - daysElapsed

  const thisCostSoFar = sum(thisMonthRows, 'tariff')
  const thisKwhSoFar = sum(thisMonthRows, 'totalUnit')
  const avgDailyCost = thisCostSoFar / daysElapsed
  const avgDailyKwh = thisKwhSoFar / daysElapsed

  const forecastedCost = parseFloat((avgDailyCost * daysInMonth).toFixed(2))
  const forecastedKwh = parseFloat((avgDailyKwh * daysInMonth).toFixed(2))

  const lastCost = lastMonthRows.length ? sum(lastMonthRows, 'tariff') : null
  const vsLast = lastCost != null ? parseFloat((forecastedCost - lastCost).toFixed(2)) : null

  return {
    organization: org.name,
    currentMonth: isoMonth(now),
    daysElapsed,
    daysInMonth,
    daysRemaining,
    toDateCostPKR: parseFloat(thisCostSoFar.toFixed(2)),
    avgDailyCostPKR: parseFloat(avgDailyCost.toFixed(2)),
    forecastedTotalCostPKR: forecastedCost,
    forecastedTotalKwh: forecastedKwh,
    lastMonthActualCostPKR: lastCost != null ? parseFloat(lastCost.toFixed(2)) : null,
    forecastVsLastMonth:
      vsLast !== null
        ? {
            diffPKR: vsLast,
            pctChange: parseFloat(((vsLast / lastCost) * 100).toFixed(1)),
            trend: vsLast > 0 ? 'higher' : vsLast < 0 ? 'lower' : 'same',
          }
        : null,
  }
}

async function getPowerFactorImpact(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved
  const now = new Date()
  const cutoff = new Date(now.getTime() - 30 * 86400_000)

  const [pfAlarms, pfVars] = await Promise.all([
    prisma.deviceVariableAlarmHistory.findMany({
      where: {
        organizationId: org.id,
        variableName: { contains: 'PowerFactor', mode: 'insensitive' },
      },
      orderBy: { alarmTime: 'desc' },
      take: 50,
      include: { device: { select: { name: true } } },
    }),
    prisma.deviceConfigVariable.findMany({
      where: {
        organizationId: org.id,
        name: { contains: 'PowerFactor', mode: 'insensitive' },
      },
      include: {
        device: { select: { name: true, status: true } },
      },
    }),
  ])

  const affectedDeviceIds = [...new Set(pfAlarms.map((a) => a.deviceId).filter(Boolean))]

  let affectedCost = 0
  if (affectedDeviceIds.length > 0) {
    const affectedRows = await prisma.intervalHistory.findMany({
      where: {
        organizationId: org.id,
        deviceId: { in: affectedDeviceIds },
        startDate: { gte: cutoff },
      },
      select: { tariff: true },
    })
    affectedCost = sum(affectedRows, 'tariff')
  }

  return {
    organization: org.name,
    note: 'Savings estimate requires utility-specific penalty rates. Figures below are factual alarm data only.',
    powerFactorAlarms: pfAlarms.map((a) => ({
      device: a.device?.name ?? null,
      value: a.currentValue,
      condition: a.triggeringCondition,
      state: a.alarmState,
      alarmTime: a.alarmTime,
    })),
    currentReadings: pfVars
      .map((v) => ({
        device: v.device?.name ?? null,
        powerFactor: parseFloat(v.currentValue),
        status: v.device?.status ?? null,
      }))
      .filter((v) => !Number.isNaN(v.powerFactor)),
    affectedDevices30Days: {
      deviceCount: affectedDeviceIds.length,
      totalCostPKR: parseFloat(affectedCost.toFixed(2)),
      note: 'Total cost of affected devices over last 30 days. Exact PF penalty depends on your tariff schedule.',
    },
  }
}

async function simulateConsumptionReduction(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved
  const now = new Date()
  const periodDays = parseInt(args.periodDays, 10) || 30
  const cutoff = new Date(now.getTime() - periodDays * 86400_000)

  const device = await prisma.device.findFirst({
    where: {
      organizationId: org.id,
      name: { contains: args.deviceName, mode: 'insensitive' },
    },
  })
  if (!device) return { error: `No device matching "${args.deviceName}" in ${org.name}` }

  const [deviceRows, orgRows] = await Promise.all([
    prisma.intervalHistory.findMany({
      where: { deviceId: device.id, startDate: { gte: cutoff } },
    }),
    prisma.intervalHistory.findMany({
      where: { organizationId: org.id, startDate: { gte: cutoff } },
      select: { tariff: true },
    }),
  ])

  if (deviceRows.length === 0) return { error: `No history for device "${device.name}"` }

  const factor = parseFloat(args.percentReduction) / 100
  if (Number.isNaN(factor) || factor < 0 || factor > 1) {
    return { error: 'percentReduction must be a number between 0 and 100' }
  }

  const actualCost = sum(deviceRows, 'tariff')
  const actualKwh = sum(deviceRows, 'totalUnit')
  const savedCost = parseFloat((actualCost * factor).toFixed(2))
  const savedKwh = parseFloat((actualKwh * factor).toFixed(2))
  const orgTotalCost = sum(orgRows, 'tariff')
  const newOrgCost = parseFloat((orgTotalCost - savedCost).toFixed(2))

  return {
    organization: org.name,
    device: device.name,
    periodDays,
    percentReduction: parseFloat(args.percentReduction),
    actual: {
      deviceKwh: parseFloat(actualKwh.toFixed(2)),
      deviceCostPKR: parseFloat(actualCost.toFixed(2)),
      orgTotalCostPKR: parseFloat(orgTotalCost.toFixed(2)),
    },
    simulated: {
      deviceKwhSaved: savedKwh,
      deviceCostSaved: savedCost,
      newDeviceCostPKR: parseFloat((actualCost - savedCost).toFixed(2)),
      newOrgTotalCostPKR: newOrgCost,
      orgSavingPct:
        orgTotalCost > 0 ? parseFloat(((savedCost / orgTotalCost) * 100).toFixed(1)) : 0,
    },
  }
}

async function getBudgetPlan(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved

  const forecast = await forecastMonthlyBill(args, ctx)
  if (forecast.error) return forecast

  const target = parseFloat(args.targetAmountPKR)
  if (Number.isNaN(target)) return { error: 'targetAmountPKR must be a number' }

  const projected = forecast.forecastedTotalCostPKR
  const gap = parseFloat((projected - target).toFixed(2))

  if (gap <= 0) {
    return {
      organization: org.name,
      targetPKR: target,
      forecastedPKR: projected,
      status: 'on_track',
      message: `Forecasted bill (PKR ${projected}) is already under your target of PKR ${target}. You are on track.`,
    }
  }

  const top = await getTopConsumingDevices({ ...args, periodDays: 30 }, ctx)
  if (top.error) return top

  const reductionNeededPct = parseFloat(((gap / projected) * 100).toFixed(1))
  let remainingGap = gap
  const cutPlan = []

  for (const dev of top.devices) {
    if (remainingGap <= 0) break
    const monthCost = (dev.avgDailyCostPKR || 0) * forecast.daysInMonth
    const maxSaving = parseFloat((monthCost * 0.2).toFixed(2))
    const actualCut = parseFloat(Math.min(maxSaving, remainingGap).toFixed(2))
    const cutPct = monthCost > 0 ? parseFloat(((actualCut / monthCost) * 100).toFixed(1)) : 0
    cutPlan.push({
      device: dev.device,
      suggestedCutPct: cutPct,
      estimatedSavingPKR: actualCut,
    })
    remainingGap -= actualCut
  }

  return {
    organization: org.name,
    targetPKR: target,
    forecastedPKR: projected,
    gapPKR: gap,
    overBudget: true,
    reductionNeededPct,
    status: 'over_budget',
    cutPlan,
    note: 'Cut plan estimates up to 20% reduction per device by cost rank. Actual savings depend on operational feasibility.',
  }
}

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
