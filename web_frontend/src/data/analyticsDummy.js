/**
 * Shared dummy / demo fallbacks for AI analytics pages.
 * Used when live API returns empty or errors so charts, KPIs, and tables stay populated.
 * Shapes match OrganizationAnalyticsPage + AnalyticsDetailPage + portal demo data.
 */

const HOURS = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']

/** Portal-style base series (OrganizationAnalyticsPage). */
export const BASE_SERIES = [
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

function hourLabel(i) {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function demoDate(offsetDays = 0, hour = 10, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  d.setHours(hour, minute, 0, 0)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isEmptyArray(v) {
  return !Array.isArray(v) || v.length === 0
}

function isBlankValue(v) {
  return v == null || v === '' || v === '—' || v === '-'
}

/** Prefer live arrays/values; fill blanks from dummy. */
export function preferLive(live, dummy) {
  if (live == null) return dummy
  if (Array.isArray(dummy)) {
    return isEmptyArray(live) ? dummy : live
  }
  if (typeof dummy === 'object' && dummy !== null && !Array.isArray(dummy)) {
    const out = { ...dummy }
    for (const [key, liveVal] of Object.entries(live)) {
      if (Array.isArray(liveVal)) {
        out[key] = isEmptyArray(liveVal) ? (dummy[key] ?? liveVal) : liveVal
      } else if (liveVal != null && typeof liveVal === 'object') {
        out[key] = preferLive(liveVal, dummy[key] ?? {})
      } else if (!isBlankValue(liveVal)) {
        out[key] = liveVal
      }
    }
    return out
  }
  return isBlankValue(live) ? dummy : live
}

// ─── Org (OrganizationAnalyticsPage) payloads ────────────────────────────────

function imbalanceRows(kind) {
  const unit = kind === 'current' ? 'A' : 'V'
  return Array.from({ length: 12 }, (_, i) => {
    const a = kind === 'current' ? 17 + (i % 5) * 0.8 : 222 + (i % 6)
    const b = kind === 'current' ? 15 + (i % 4) * 0.7 : 218 + (i % 5)
    const c = kind === 'current' ? 19 + (i % 6) * 0.9 : 226 + (i % 4)
    const imb = (1.2 + (i % 5) * 0.35 + (i % 3) * 0.2).toFixed(1)
    return {
      id: `${kind}-demo-${i + 1}`,
      time: demoDate(i % 10, 6 + (i % 12), (i * 7) % 60),
      phaseA: `${a.toFixed(1)}${unit}`,
      phaseB: `${b.toFixed(1)}${unit}`,
      phaseC: `${c.toFixed(1)}${unit}`,
      imbalance: `${imb}%`,
      imbalanceValue: Number(imb),
      severity: Number(imb) > 2.5 ? 'Critical' : 'Warning',
      status: i % 3 === 0 ? 'Active' : 'Detected',
    }
  })
}

export function orgVoltageDummy() {
  const chartData = BASE_SERIES.map(({ time, voltageA, voltageB, voltageC }) => ({
    time, voltageA, voltageB, voltageC,
  }))
  const rows = imbalanceRows('voltage')
  const imbs = rows.map((r) => r.imbalanceValue)
  return {
    chartData,
    rows,
    meta: {
      maxImb: Math.max(...imbs),
      avgImb: imbs.reduce((a, b) => a + b, 0) / imbs.length,
    },
  }
}

export function orgCurrentDummy() {
  const chartData = BASE_SERIES.map(({ time, currentA, currentB, currentC }) => ({
    time, currentA, currentB, currentC,
  }))
  const rows = imbalanceRows('current')
  const imbs = rows.map((r) => r.imbalanceValue)
  return {
    chartData,
    rows,
    meta: {
      maxImb: Math.max(...imbs),
      avgImb: imbs.reduce((a, b) => a + b, 0) / imbs.length,
    },
  }
}

export function orgPowerFactorDummy() {
  const chartData = BASE_SERIES.map(({ time, pf }) => ({ time, pf }))
  const vals = chartData.map((p) => p.pf)
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: `pf-demo-${i + 1}`,
    time: demoDate(i % 8, 8 + i, 15),
    pf: (0.79 + (i % 5) * 0.01).toFixed(2),
    duration: `${20 + (i % 6) * 10} min`,
    threshold: '0.85',
    status: i % 2 === 0 ? 'Active' : 'Resolved',
  }))
  return {
    chartData,
    rows,
    meta: {
      currentPf: vals[vals.length - 1],
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      min: Math.min(...vals),
      below: vals.filter((v) => v < 0.85).length + rows.filter((r) => Number(r.pf) < 0.85).length,
    },
  }
}

export function orgEnergyDummy() {
  const chartData = BASE_SERIES.map(({ time, power }) => ({
    time,
    power,
    timestamp: null,
  }))
  const peak = Math.max(...chartData.map((p) => p.power))
  const avg = chartData.reduce((s, p) => s + p.power, 0) / chartData.length
  const dailyData = [
    { day: 'Mon', kWh: 312 },
    { day: 'Tue', kWh: 298 },
    { day: 'Wed', kWh: 341 },
    { day: 'Thu', kWh: 276 },
    { day: 'Fri', kWh: 355 },
    { day: 'Sat', kWh: 210 },
    { day: 'Sun', kWh: 188 },
  ]
  const total = dailyData.reduce((s, d) => s + d.kWh, 0)
  const rows = chartData.map((p, i) => ({
    id: i,
    date: demoDate(0, Number(p.time.slice(0, 2)), 0),
    power: `${p.power.toFixed(1)} kW`,
    kWh: Math.round(p.power * 2),
  }))
  return {
    chartData,
    dailyData,
    rows,
    meta: { total, peak, avg, samples: chartData.length },
  }
}

export function orgAnomaliesDummy() {
  const types = ['Overvoltage', 'Current Spike', 'PF Degradation', 'Phase Imbalance', 'Data Gap']
  const rows = Array.from({ length: 18 }, (_, i) => ({
    id: `anom-demo-${i + 1}`,
    type: types[i % types.length],
    device: ['Main Panel', 'Compressor DB', 'Solar Inverter', 'Office DB'][i % 4],
    variable: ['Voltage Phase A', 'Current Phase B', 'Power Factor', 'All Variables'][i % 4],
    desc: ['Threshold exceeded', 'Sudden spike detected', 'Below configured threshold', 'Telemetry gap detected'][i % 4],
    time: demoDate(i % 12, 7 + (i % 10), (i * 11) % 60),
    severity: ['Low', 'Warning', 'High', 'Critical'][i % 4],
    status: i % 3 === 0 ? 'Active' : 'Resolved',
  }))
  const byDay = new Map()
  for (let i = 0; i < 7; i += 1) {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, {
      day: key,
      active: 1 + (i % 4),
      resolved: 2 + ((i + 1) % 5),
    })
  }
  return {
    chartData: [...byDay.values()],
    rows,
    meta: {},
  }
}

const ORG_BUILDERS = {
  voltage: orgVoltageDummy,
  current: orgCurrentDummy,
  powerFactor: orgPowerFactorDummy,
  energy: orgEnergyDummy,
  anomalies: orgAnomaliesDummy,
}

export function getOrgAnalyticsDummy(type) {
  const build = ORG_BUILDERS[type] || orgVoltageDummy
  return build()
}

/** Merge live org analytics result with dummy when chart/rows are empty. */
export function withOrgAnalyticsFallback(type, live) {
  const dummy = getOrgAnalyticsDummy(type)
  if (!live) return { ...dummy, _demo: true }
  const hasChart = !isEmptyArray(live.chartData)
  const hasRows = !isEmptyArray(live.rows)
  const hasDaily = !isEmptyArray(live.dailyData)
  if (hasChart && hasRows && (type !== 'energy' || hasDaily)) {
    return { ...live, _demo: false }
  }
  const meta = { ...dummy.meta }
  if (live.meta) {
    for (const [k, v] of Object.entries(live.meta)) {
      if (v != null) meta[k] = v
    }
  }
  return {
    ...dummy,
    ...live,
    chartData: hasChart ? live.chartData : dummy.chartData,
    rows: hasRows ? live.rows : dummy.rows,
    dailyData: hasDaily ? live.dailyData : (dummy.dailyData ?? []),
    meta: hasChart || hasRows ? { ...dummy.meta, ...meta } : dummy.meta,
    _demo: !(hasChart && hasRows),
  }
}

// ─── User detail pages (AnalyticsDetailPage) ─────────────────────────────────

const PREDICTED_LABELS = [
  '12:00 AM', '01:00 AM', '02:00 AM', '03:00 AM', '04:00 AM',
  '05:00 AM', '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM',
]

export const userVoltageDummy = {
  value: '2.76',
  predictedData: PREDICTED_LABELS.map((t, i) => ({
    t, v: [2.6, 1.9, 1.9, 2.5, 1.9, 2.0, 2.6, 2.3, 1.9, 3.4][i],
  })),
  overTimeData: Array.from({ length: 17 }, (_, i) => ({
    t: hourLabel(i),
    v: 280 + Math.round(Math.sin(i) * 40),
  })),
  anomalyRows: Array.from({ length: 8 }, (_, i) => ({
    time: demoDate(i % 5, 9 + i, 10),
    type: 'Overvoltage',
    extra: `${(240 + i).toFixed(1)} V`,
  })),
}

export const userCurrentDummy = {
  value: '3.85',
  predictedData: PREDICTED_LABELS.map((t, i) => ({
    t, v: [25.0, 19.5, 19.0, 24.5, 19.0, 20.0, 25.5, 22.5, 18.5, 32.0][i],
  })),
  overTimeData: Array.from({ length: 15 }, (_, i) => ({
    t: `${String(i).padStart(2, '0')}:00`,
    v: Math.max(14, 25 - i * 0.7),
  })),
  anomalyRows: [],
}

export const userPowerFactorDummy = {
  value: '0.84',
  predictedData: PREDICTED_LABELS.map((t, i) => ({
    t, v: [0.91, 0.88, 0.87, 0.90, 0.86, 0.89, 0.92, 0.90, 0.85, 0.83][i],
  })),
  overTimeData: Array.from({ length: 17 }, (_, i) => ({
    t: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
    v: Number((0.82 + Math.abs(Math.sin(i)) * 0.12).toFixed(2)),
  })),
  anomalyRows: Array.from({ length: 6 }, (_, i) => ({
    time: demoDate(i % 4, 11 + i, 20),
    type: 'Low Power Factor',
    extra: (0.78 + i * 0.01).toFixed(2),
  })),
}

export const userEnergyDummy = {
  value: '131.78 kWh',
  predictedData: PREDICTED_LABELS.map((t, i) => ({
    t, v: [12.7, 11.9, 12.0, 13.4, 11.9, 12.1, 14.6, 13.3, 11.9, 15.4][i],
  })),
  overTimeData: Array.from({ length: 10 }, (_, i) => ({
    t: `Blk ${i + 1}`,
    v: [15, 17, 16.5, 14.5, 13.5, 16, 13, 10, 5, 2][i],
  })),
  anomalyRows: [],
}

export function withUserDetailFallback(live, dummy) {
  const base = preferLive(live ?? {}, dummy)
  const predictedData = preferLive(live?.predictedData, dummy.predictedData)
  const overTimeData = preferLive(live?.overTimeData, dummy.overTimeData)
  const anomalyRows = preferLive(live?.anomalyRows, dummy.anomalyRows ?? [])
  const value = preferLive(live?.value, dummy.value)
  const usingDemo =
    isBlankValue(live?.value)
    || isEmptyArray(live?.predictedData)
    || isEmptyArray(live?.overTimeData)
  return {
    ...base,
    value,
    predictedData,
    overTimeData,
    anomalyRows,
    _demo: usingDemo,
  }
}

// ─── User AI Analytics hub ───────────────────────────────────────────────────

export const userAiReadingsDummy = {
  rows: [
    { variable: 'Voltage Phase A', value: '228.4', time: demoDate(0, 14, 5) },
    { variable: 'Voltage Phase B', value: '226.1', time: demoDate(0, 14, 5) },
    { variable: 'Voltage Phase C', value: '229.8', time: demoDate(0, 14, 5) },
    { variable: 'Current Phase A', value: '18.2', time: demoDate(0, 14, 5) },
    { variable: 'Active Power', value: '12.4', time: demoDate(0, 14, 5) },
    { variable: 'Power Factor', value: '0.92', time: demoDate(0, 14, 5) },
    { variable: 'Frequency', value: '50.01', time: demoDate(0, 14, 5) },
  ],
  chart: Array.from({ length: 24 }, (_, i) => ({
    t: HOURS[i % HOURS.length] || `T${i}`,
    v: Number((220 + Math.sin(i / 3) * 8 + (i % 5)).toFixed(1)),
  })),
}

export function withUserAiFallback(live) {
  return preferLive(live ?? {}, userAiReadingsDummy)
}

// ─── User Anomalies page ─────────────────────────────────────────────────────

export const userAnomaliesDummy = {
  totalAnomalies: 68,
  issues: [
    { key: 'overvoltage', label: 'Overvoltage', category: 'Voltage', count: 51, color: '#EF4444' },
    { key: 'lowpf', label: 'Low Power Factor', category: 'Power Factor', count: 14, color: '#F5A623' },
    { key: 'criticalpf', label: 'Critical Low PF', category: 'Power Factor', count: 3, color: '#F97316' },
  ],
  timelineData: Array.from({ length: 17 }, (_, i) => ({
    t: `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
    v: Math.max(0, Math.round(2 + Math.sin(i / 2) * 3 + (i % 4))),
  })),
}

export function withUserAnomaliesFallback(live) {
  const total = Number(live?.totalAnomalies) || 0
  const issuesEmpty =
    isEmptyArray(live?.issues)
    || (live.issues.length === 1 && (live.issues[0].key === 'none' || live.issues[0].count === 0))
  const timelineEmpty =
    isEmptyArray(live?.timelineData)
    || (live.timelineData.length === 1 && (live.timelineData[0].t === '—' || live.timelineData[0].v === 0))
  if (total > 0 && !issuesEmpty && !timelineEmpty) {
    return { ...live, _demo: false }
  }
  return {
    totalAnomalies: total > 0 ? total : userAnomaliesDummy.totalAnomalies,
    issues: issuesEmpty ? userAnomaliesDummy.issues : live.issues,
    timelineData: timelineEmpty ? userAnomaliesDummy.timelineData : live.timelineData,
    _demo: true,
  }
}
