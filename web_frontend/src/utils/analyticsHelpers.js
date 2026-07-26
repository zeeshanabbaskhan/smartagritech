/** Shared helpers for org/user AI analytics — real API values only, no synthetic metrics. */

export const PERIOD_TO_RANGE = {
  Today: '24h',
  'This Week': '7d',
  'This Month': '30d',
  Custom: '30d',
}

export const RANGE_LABELS = { '24h': 'Today', '7d': 'Last 7 days', '30d': 'This Month' }

/** Map a From/To date span to the nearest backend AI timeRange preset. */
export function timeRangeFromDates(from, to) {
  if (!from || !to) return '7d'
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '7d'
  const days = Math.max(1, Math.ceil((end - start) / 86_400_000) + 1)
  if (days <= 1) return '24h'
  if (days <= 7) return '7d'
  return '30d'
}

export function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 16)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function alarmStatus(alarm) {
  const state = String(alarm?.alarmState ?? alarm?.state ?? '').toUpperCase()
  if (state === 'ACTIVE') return 'Active'
  if (state === 'RESOLVED' || state === 'CLEARED') return 'Resolved'
  return alarm?.processState === 'UNPROCESSED' ? 'Active' : 'Resolved'
}

export function alarmSeverity(alarm, imbalancePct) {
  if (alarm?.severity) return alarm.severity
  if (Number.isFinite(imbalancePct)) return imbalancePct > 3 ? 'Critical' : 'Warning'
  return String(alarm?.alarmState ?? '').toUpperCase() === 'ACTIVE' ? 'High' : 'Medium'
}

/**
 * Build imbalance event rows from the real imbalance series.
 * Only points that exceed the threshold are included — no padded/fake rows.
 * Phase values come from the merged chart at the matching index when available.
 */
export function imbalanceEventsFromSeries({
  imbalance = [],
  chartRows = [],
  phaseKeys = ['phaseA', 'phaseB', 'phaseC'],
  chartKeys = ['voltageA', 'voltageB', 'voltageC'],
  unit = 'V',
  threshold = 2,
  limit = 50,
} = {}) {
  const events = []
  for (let i = 0; i < imbalance.length; i += 1) {
    const point = imbalance[i]
    const value = Number(point?.value)
    if (!Number.isFinite(value) || value < threshold) continue
    const row = chartRows[i] ?? {}
    const entry = {
      id: `${point.timestamp ?? i}-${value}`,
      time: formatTs(point.timestamp),
      imbalance: `${value.toFixed(1)}%`,
      imbalanceValue: value,
      severity: value > 3 ? 'Critical' : 'Warning',
      status: 'Detected',
    }
    phaseKeys.forEach((key, idx) => {
      const raw = row[chartKeys[idx]]
      entry[key] = Number.isFinite(Number(raw)) ? `${Number(raw).toFixed(1)}${unit}` : '—'
    })
    events.push(entry)
    if (events.length >= limit) break
  }
  return events
}

/**
 * Energy stats + charts from getAiEnergy — no fabricated peak split, tariff, or power/10.
 * Daily bar uses measured average power per bucket (kW), not invented kWh.
 */
export function energyFromAiResponse(data, { deviceName = 'Device' } = {}) {
  const points = data?.chartData ?? []
  const chartData = points.map((p) => ({
    time: p.timestamp
      ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—',
    timestamp: p.timestamp,
    power: Number(p.value) || 0,
  }))
  const total = Number(data?.totalConsumption)
  const peak = chartData.reduce((max, p) => Math.max(max, p.power), 0)
  const avg = chartData.length
    ? chartData.reduce((sum, p) => sum + p.power, 0) / chartData.length
    : 0

  // Down-sample for the interval bar — still real bucket averages, never invented values
  const step = Math.max(1, Math.floor(chartData.length / 12))
  const dailyData = chartData
    .filter((_, i) => i % step === 0)
    .map((p) => ({ day: p.time, kW: +p.power.toFixed(2) }))

  const rows = chartData.map((p, i) => ({
    id: i,
    date: formatTs(p.timestamp),
    power: `${p.power.toFixed(1)} kW`,
  }))

  const statCards = [
    {
      label: 'Total Consumption',
      value: Number.isFinite(total) ? Number(total).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—',
      unit: Number.isFinite(total) ? 'units' : '',
      iconKey: 'zap',
      color: 'primary',
    },
    {
      label: 'Peak Power',
      value: chartData.length ? peak.toFixed(1) : '—',
      unit: chartData.length ? 'kW' : '',
      iconKey: 'trend',
      color: 'warning',
    },
    {
      label: 'Avg Power',
      value: chartData.length ? avg.toFixed(1) : '—',
      unit: chartData.length ? 'kW' : '',
      iconKey: 'activity',
      color: 'info',
    },
    {
      label: 'Samples',
      value: String(chartData.length),
      unit: '',
      iconKey: 'receipt',
      color: 'success',
    },
  ]

  return {
    chartData,
    dailyData,
    rows,
    deviceName,
    meta: {
      total: Number.isFinite(total) ? total : null,
      peak: chartData.length ? peak : null,
      avg: chartData.length ? avg : null,
      samples: chartData.length,
    },
    statCards,
  }
}

/** Build Active vs Resolved anomaly activity bars from real anomaly rows. */
export function anomalyActivitySeries(rows = []) {
  const byDay = new Map()
  for (const row of rows) {
    const raw = row._raw?.alarmTime ?? row.time
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) continue
    const key = d.toISOString().slice(0, 10)
    if (!byDay.has(key)) byDay.set(key, { day: key, active: 0, resolved: 0 })
    const bucket = byDay.get(key)
    if (row.status === 'Active') bucket.active += 1
    else bucket.resolved += 1
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}
