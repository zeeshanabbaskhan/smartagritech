/** Shared helpers for org/user AI analytics. */

export const PERIOD_TO_RANGE = {
  Today: '24h',
  'This Week': '7d',
  'This Month': '30d',
  Custom: '30d',
}

export const RANGE_LABELS = { '24h': 'Today', '7d': 'Last 7 days', '30d': 'This Month' }

/**
 * CF dashboard reference series — visual fallback when a device has no logged
 * readings yet, so cards/graphs always render like the CF UI.
 */
export const CF_BASE_SERIES = [
  { time: '00:00', voltageA: 224, voltageB: 222, voltageC: 226, currentA: 12.1, currentB: 11.4, currentC: 13.2, power: 8.2, pf: 0.93 },
  { time: '02:00', voltageA: 225, voltageB: 223, voltageC: 225, currentA: 11.8, currentB: 10.9, currentC: 12.7, power: 7.9, pf: 0.91 },
  { time: '04:00', voltageA: 223, voltageB: 221, voltageC: 224, currentA: 10.5, currentB: 9.8, currentC: 11.1, power: 7.1, pf: 0.90 },
  { time: '06:00', voltageA: 226, voltageB: 224, voltageC: 227, currentA: 13.2, currentB: 12.5, currentC: 13.8, power: 8.9, pf: 0.94 },
  { time: '08:00', voltageA: 228, voltageB: 226, voltageC: 229, currentA: 18.5, currentB: 17.1, currentC: 19.2, power: 12.4, pf: 0.92 },
  { time: '10:00', voltageA: 230, voltageB: 228, voltageC: 231, currentA: 22.1, currentB: 20.6, currentC: 23.4, power: 14.8, pf: 0.93 },
  { time: '12:00', voltageA: 231, voltageB: 229, voltageC: 232, currentA: 24.3, currentB: 21.8, currentC: 24.9, power: 16.1, pf: 0.91 },
  { time: '14:00', voltageA: 229, voltageB: 227, voltageC: 230, currentA: 23.8, currentB: 22.2, currentC: 24.1, power: 15.7, pf: 0.92 },
  { time: '16:00', voltageA: 227, voltageB: 225, voltageC: 228, currentA: 21.2, currentB: 19.6, currentC: 22.7, power: 14.2, pf: 0.90 },
  { time: '18:00', voltageA: 225, voltageB: 223, voltageC: 226, currentA: 19.5, currentB: 18.3, currentC: 20.8, power: 13.1, pf: 0.93 },
  { time: '20:00', voltageA: 224, voltageB: 222, voltageC: 225, currentA: 16.8, currentB: 15.9, currentC: 17.4, power: 11.2, pf: 0.94 },
  { time: '22:00', voltageA: 223, voltageB: 221, voltageC: 224, currentA: 14.1, currentB: 13.5, currentC: 14.8, power: 9.5, pf: 0.91 },
]

export function cfFallbackChart(type) {
  if (type === 'voltage') {
    return CF_BASE_SERIES.map((p) => ({
      time: p.time, voltageA: p.voltageA, voltageB: p.voltageB, voltageC: p.voltageC,
    }))
  }
  if (type === 'current') {
    return CF_BASE_SERIES.map((p) => ({
      time: p.time, currentA: p.currentA, currentB: p.currentB, currentC: p.currentC,
    }))
  }
  if (type === 'powerFactor') {
    return CF_BASE_SERIES.map((p) => ({ time: p.time, pf: p.pf, value: p.pf }))
  }
  if (type === 'energy') {
    return CF_BASE_SERIES.map((p) => ({ time: p.time, power: p.power, timestamp: null }))
  }
  if (type === 'anomalies') {
    return [
      { day: 'Mon', active: 2, resolved: 3 },
      { day: 'Tue', active: 1, resolved: 4 },
      { day: 'Wed', active: 3, resolved: 2 },
      { day: 'Thu', active: 2, resolved: 5 },
      { day: 'Fri', active: 1, resolved: 3 },
      { day: 'Sat', active: 0, resolved: 2 },
      { day: 'Sun', active: 1, resolved: 1 },
    ]
  }
  return []
}

export function cfFallbackEvents(type) {
  if (type === 'voltage' || type === 'current') {
    const unit = type === 'voltage' ? 'V' : 'A'
    const keyA = type === 'voltage' ? 'voltageA' : 'currentA'
    const keyB = type === 'voltage' ? 'voltageB' : 'currentB'
    const keyC = type === 'voltage' ? 'voltageC' : 'currentC'
    return [
      { id: 1, time: '2026-06-09 14:22', phaseA: `${CF_BASE_SERIES[7][keyA]}${unit}`, phaseB: `${CF_BASE_SERIES[7][keyB]}${unit}`, phaseC: `${CF_BASE_SERIES[7][keyC]}${unit}`, imbalance: '2.1%', severity: 'Warning', status: 'Detected' },
      { id: 2, time: '2026-06-08 09:45', phaseA: `${CF_BASE_SERIES[5][keyA]}${unit}`, phaseB: `${CF_BASE_SERIES[5][keyB]}${unit}`, phaseC: `${CF_BASE_SERIES[5][keyC]}${unit}`, imbalance: '1.6%', severity: 'Warning', status: 'Detected' },
      { id: 3, time: '2026-06-07 22:10', phaseA: `${CF_BASE_SERIES[6][keyA]}${unit}`, phaseB: `${CF_BASE_SERIES[6][keyB]}${unit}`, phaseC: `${CF_BASE_SERIES[6][keyC]}${unit}`, imbalance: '2.9%', severity: 'Critical', status: 'Detected' },
    ]
  }
  if (type === 'powerFactor') {
    return [
      { id: 1, time: '2026-06-09 11:40', pf: '0.82', duration: '40 min', threshold: '0.85', status: 'Resolved' },
      { id: 2, time: '2026-06-08 16:15', pf: '0.84', duration: '25 min', threshold: '0.85', status: 'Resolved' },
      { id: 3, time: '2026-06-07 09:05', pf: '0.81', duration: '55 min', threshold: '0.85', status: 'Active' },
    ]
  }
  if (type === 'energy') {
    return CF_BASE_SERIES.map((p, i) => ({
      id: i,
      date: p.time,
      power: `${p.power.toFixed(1)} kW`,
      kWh: Math.round(p.power * 2),
      peak: (p.power * 1.1).toFixed(1),
      cost: Math.round(p.power * 2 * 28),
    }))
  }
  if (type === 'anomalies') {
    return [
      { id: 1, type: 'Overvoltage', device: 'Main Wapda', variable: 'VoltageA', desc: 'Phase A above threshold', time: '2026-06-09 14:22', severity: 'High', status: 'Active' },
      { id: 2, type: 'Current Spike', device: 'Main Wapda', variable: 'CurrentB', desc: 'Sudden current rise', time: '2026-06-08 09:45', severity: 'Medium', status: 'Resolved' },
      { id: 3, type: 'PF Degradation', device: 'Main Wapda', variable: 'PowerFactor', desc: 'PF dropped below 0.85', time: '2026-06-07 22:10', severity: 'High', status: 'Active' },
      { id: 4, type: 'Phase Imbalance', device: 'Main Wapda', variable: 'VoltageImbalance', desc: 'Imbalance exceeded 2%', time: '2026-06-07 11:05', severity: 'Medium', status: 'Resolved' },
    ]
  }
  return []
}

export function preferLive(live, fallback) {
  return Array.isArray(live) && live.length > 0 ? live : fallback
}

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

  const step = Math.max(1, Math.floor(chartData.length / 12))
  const dailyData = chartData
    .filter((_, i) => i % step === 0)
    .map((p) => ({ day: p.time, kW: +p.power.toFixed(2), kWh: Math.round(p.power * 2) }))

  const rows = chartData.map((p, i) => ({
    id: i,
    date: formatTs(p.timestamp) !== '—' ? formatTs(p.timestamp) : p.time,
    power: `${p.power.toFixed(1)} kW`,
    kWh: Math.round(p.power * 2),
    peak: (p.power * 1.05).toFixed(1),
    cost: Math.round(p.power * 2 * 28),
  }))

  const hasLive = chartData.length > 0
  const totalVal = Number.isFinite(total) ? total : (hasLive ? chartData.reduce((s, p) => s + p.power * 2, 0) : null)

  const statCards = [
    { label: 'Total kWh', value: totalVal != null ? Math.round(totalVal).toLocaleString() : '—', unit: totalVal != null ? 'kWh' : '', iconKey: 'zap', color: 'primary' },
    { label: 'Peak kW', value: hasLive ? peak.toFixed(1) : '—', unit: hasLive ? 'kW' : '', iconKey: 'trend', color: 'warning' },
    { label: 'Off-Peak kWh', value: totalVal != null ? Math.round(totalVal * 0.49).toLocaleString() : '—', unit: totalVal != null ? 'kWh' : '', iconKey: 'moon', color: 'info' },
    { label: 'On-Peak kWh', value: totalVal != null ? Math.round(totalVal * 0.51).toLocaleString() : '—', unit: totalVal != null ? 'kWh' : '', iconKey: 'sun', color: 'success' },
    { label: 'Cost', value: totalVal != null ? `PKR ${Math.round(totalVal * 28).toLocaleString()}` : '—', unit: '', iconKey: 'receipt', color: 'danger' },
  ]

  return {
    chartData,
    dailyData,
    rows,
    deviceName,
    isDemo: false,
    meta: {
      total: totalVal,
      peak: hasLive ? peak : null,
      avg: hasLive ? avg : null,
      samples: chartData.length,
      offPeak: totalVal != null ? Math.round(totalVal * 0.49) : null,
      onPeak: totalVal != null ? Math.round(totalVal * 0.51) : null,
      cost: totalVal != null ? Math.round(totalVal * 28) : null,
    },
    statCards,
  }
}

export function energyFromCfFallback(deviceName = 'Device') {
  const chartData = cfFallbackChart('energy')
  const dailyData = chartData.map((p) => ({ day: p.time, kW: p.power, kWh: Math.round(p.power * 2) }))
  const rows = cfFallbackEvents('energy')
  const total = rows.reduce((s, r) => s + r.kWh, 0)
  const peak = Math.max(...chartData.map((p) => p.power))
  return {
    chartData,
    dailyData,
    rows,
    deviceName,
    isDemo: true,
    meta: {
      total,
      peak,
      avg: chartData.reduce((s, p) => s + p.power, 0) / chartData.length,
      samples: chartData.length,
      offPeak: Math.round(total * 0.49),
      onPeak: Math.round(total * 0.51),
      cost: Math.round(total * 28),
    },
    statCards: [
      { label: 'Total kWh', value: total.toLocaleString(), unit: 'kWh', iconKey: 'zap', color: 'primary' },
      { label: 'Peak kW', value: peak.toFixed(1), unit: 'kW', iconKey: 'trend', color: 'warning' },
      { label: 'Off-Peak kWh', value: Math.round(total * 0.49).toLocaleString(), unit: 'kWh', iconKey: 'moon', color: 'info' },
      { label: 'On-Peak kWh', value: Math.round(total * 0.51).toLocaleString(), unit: 'kWh', iconKey: 'sun', color: 'success' },
      { label: 'Cost', value: `PKR ${Math.round(total * 28).toLocaleString()}`, unit: '', iconKey: 'receipt', color: 'danger' },
    ],
  }
}

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
