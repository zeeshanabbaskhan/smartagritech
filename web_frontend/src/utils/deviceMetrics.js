// Live values from Redis hash device:{id}:latest (keyed by config variable names).

const ALIASES = {
  power:       ['Total Power', 'TotalPower', 'ActivePower', 'TotalActivePower', 'Active Power', 'Total Active Power', 'ActivePowerTotal', 'Power', 'Total kW', 'kW', 'PowerConsumption'],
  current:     ['Current A', 'Current B', 'Current C', 'CurrentA', 'Ia', 'Current', 'TotalCurrent', 'CurrentTotal', 'AverageCurrent'],
  voltage:     ['Voltage', 'VoltageA', 'VoltageB', 'VoltageC', 'Va', 'AverageVoltage', 'VoltageAvg', 'Vab'],
  pf:          ['Power Factor', 'PowerFactor', 'PF', 'pf', 'AveragePowerFactor', 'TotalPowerFactor'],
  consumption: ['Units', 'EnergyConsumption', 'ActiveEnergy', 'PowerConsumption', 'kWh', 'TotalEnergy', 'Energy'],
}

const UNIT_HINTS = [
  [/voltage|volt|\bv\b/i, 'V'],
  [/current|\ba\b|amp/i, 'A'],
  [/powerfactor|\bpf\b/i, ''],
  [/frequency|\bhz\b/i, 'Hz'],
  [/energy|kwh|consumption/i, 'kWh'],
  [/power|kw(?!h)/i, 'kW'],
  [/temp/i, '°C'],
  [/moist/i, '%'],
  [/battery/i, '%'],
]

/**
 * Normalize instantaneous power readings to kW.
 * Ingest formulas already scale ActivePower (=s/1000); do not divide again.
 */
export function powerReadingToKw(variableName, value, unit = '') {
  const n = Number(value)
  if (!Number.isFinite(n)) return NaN
  const u = String(unit || '').toLowerCase().trim()
  if (u === 'kw' || u === 'kilowatt') return Math.abs(n)
  if (u === 'w' || u === 'watt' || u === 'watts') return Math.abs(n) / 1000
  const nm = String(variableName || '')
  if (/powerconsumption/i.test(nm) && !/active/i.test(nm)) return Math.abs(n)
  if (/activepower|^power$|totalactivepower|exportpower|solarpower|total power|totalpower|active power/i.test(nm)) {
    // If raw value is >= 2500, it is in Watts (e.g. 55000 W = 55 kW, 132000 W = 132 kW, 340000 W = 340 kW)
    if (Math.abs(n) >= 2500) return Math.abs(n) / 1000
    return Math.abs(n)
  }
  if (Math.abs(n) >= 2500) return Math.abs(n) / 1000
  return Math.abs(n)
}

/** Best-effort unit label from variable name. */
export function unitForVariable(name) {
  const n = String(name || '')
  for (const [re, unit] of UNIT_HINTS) {
    if (re.test(n)) return unit
  }
  return ''
}

const isOffline = (d) => d.status === 'Offline' || d.status === 'OFFLINE' || d.status === 'offline'

/** True when remote switch is OFF — live telemetry must be hidden. */
export const isSwitchOff = (d) => {
  if (!d) return false
  if (d.switchOn === false) return true
  const s = String(d.switchState || '').toUpperCase()
  return s === 'OFF'
}

/** Device contributes live KPIs only when switch is ON and status is Online. */
export const isTelemetryActive = (d) => !isSwitchOff(d) && !isOffline(d)

function parseMetricRaw(raw) {
  if (raw == null || raw === '') return NaN
  if (typeof raw === 'object' && raw !== null) {
    if (raw.displayValue != null && raw.displayValue !== '') {
      const d = parseFloat(raw.displayValue)
      if (Number.isFinite(d)) return d
    }
    if ('value' in raw) {
      return parseFloat(raw.value)
    }
  }
  return parseFloat(raw)
}

/** All device variables (live + configured), sorted by name. */
export function listDeviceMetricEntries(device, { limit = 24, includeEmpty = true } = {}) {
  if (isSwitchOff(device)) return []
  const metrics = device?.latestMetrics
  if (!metrics || typeof metrics !== 'object') return []
  const entries = []
  for (const [name, raw] of Object.entries(metrics)) {
    if (!name || name.startsWith('_')) continue
    const value = parseMetricRaw(raw)
    if (!includeEmpty && !Number.isFinite(value)) continue
    const unitFromMeta = raw && typeof raw === 'object' ? (raw.unit || '') : ''
    const displayLabel = raw && typeof raw === 'object' ? (raw.displayName || '') : ''
    entries.push({
      name,
      label: displayLabel || name,
      value: Number.isFinite(value) ? value : NaN,
      unit: unitFromMeta || unitForVariable(name),
    })
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  return limit > 0 ? entries.slice(0, limit) : entries
}

/** Return a numeric metric value from a device, or NaN if unavailable. */
export function readDeviceMetric(device, type) {
  if (isSwitchOff(device)) return NaN
  const metrics = device?.latestMetrics
  if (!metrics || typeof metrics !== 'object') return NaN

  const finish = (name, raw) => {
    const n = parseMetricRaw(raw)
    if (!Number.isFinite(n)) return NaN
    const unit = raw && typeof raw === 'object' ? (raw.unit || '') : ''
    // Alias 'power' and ActivePower* readings → kW for org KPIs / charts
    if (type === 'power' || (/activepower|totalactivepower/i.test(String(type)) && /activepower|totalactivepower/i.test(String(name)))) {
      return powerReadingToKw(name, n, unit)
    }
    return n
  }

  // Direct variable name (dynamic path)
  if (metrics[type] != null && metrics[type] !== '') {
    const n = finish(type, metrics[type])
    if (Number.isFinite(n)) return n
  }

  const keys = ALIASES[type] ?? [type]
  for (const key of keys) {
    const n = finish(key, metrics[key])
    if (Number.isFinite(n) && n > 0) return n
  }

  // 3-Phase summation fallback for meters split into phase powers
  if (type === 'power') {
    const pA = parseMetricRaw(metrics['PowerA'] ?? metrics['Power A'] ?? metrics['Power_A'] ?? metrics['P1'])
    const pB = parseMetricRaw(metrics['PowerB'] ?? metrics['Power B'] ?? metrics['Power_B'] ?? metrics['P2'])
    const pC = parseMetricRaw(metrics['PowerC'] ?? metrics['Power C'] ?? metrics['Power_C'] ?? metrics['P3'])
    if (Number.isFinite(pA) || Number.isFinite(pB) || Number.isFinite(pC)) {
      const sum = (Number.isFinite(pA) ? Math.abs(pA) : 0) + (Number.isFinite(pB) ? Math.abs(pB) : 0) + (Number.isFinite(pC) ? Math.abs(pC) : 0)
      if (sum > 0) return +sum.toFixed(2)
    }
  }

  // First non-zero/valid alias if available
  for (const key of keys) {
    const n = finish(key, metrics[key])
    if (Number.isFinite(n)) return n
  }

  return NaN
}

/** Formatted display string for a metric ('—' when unavailable). */
export function formatDeviceMetric(device, type, { offline = false } = {}) {
  if (isSwitchOff(device)) return type === 'status' ? 'Offline' : '—'
  if (offline && type === 'status') return 'Offline'
  const n = readDeviceMetric(device, type)
  if (!Number.isFinite(n)) return '—'
  if (/powerfactor|\bpf\b/i.test(String(type))) return n.toFixed(2)
  return Math.abs(n) >= 1000 ? n.toFixed(0) : n.toFixed(1)
}

const PRIMARY_KPI_PREFERENCE = [
  'ActivePower',
  'TotalActivePower',
  'PowerConsumption',
  'Power',
  'CurrentA',
  'CurrentB',
  'CurrentC',
  'Current',
  'TotalCurrent',
  'VoltageA',
  'VoltageB',
  'VoltageC',
  'Voltage',
  'PowerFactor',
  'Frequency',
]

/**
 * Fleet KPIs from real shared variable names across online devices.
 * Uses deterministic electrical ordering (Power -> Current A -> Current B -> Current C)
 * to avoid cards jumping or swapping when new metrics report.
 */
export function computeDynamicKpis(devices = []) {
  const online = devices.filter((d) => isTelemetryActive(d))
  const nameCounts = new Map()
  for (const d of online) {
    for (const { name, value } of listDeviceMetricEntries(d, { limit: 0 })) {
      if (!Number.isFinite(value)) continue
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
    }
  }

  // Deterministically select top 4 KPI names:
  // 1. Preferred power variable
  // 2. Current A
  // 3. Current B
  // 4. Current C
  // Fall back to other available variables if any are missing.
  const chosenNames = []
  const availableNames = new Set(nameCounts.keys())

  // Slot 1: Power variable
  const powerCandidate = ['ActivePower', 'TotalActivePower', 'PowerConsumption', 'Power'].find((k) => availableNames.has(k))
  if (powerCandidate) {
    chosenNames.push(powerCandidate)
    availableNames.delete(powerCandidate)
  }

  // Slot 2: Current A
  const curACandidate = ['CurrentA', 'Ia', 'Current', 'TotalCurrent'].find((k) => availableNames.has(k))
  if (curACandidate) {
    chosenNames.push(curACandidate)
    availableNames.delete(curACandidate)
  }

  // Slot 3: Current B
  const curBCandidate = ['CurrentB', 'Ib'].find((k) => availableNames.has(k))
  if (curBCandidate) {
    chosenNames.push(curBCandidate)
    availableNames.delete(curBCandidate)
  }

  // Slot 4: Current C
  const curCCandidate = ['CurrentC', 'Ic'].find((k) => availableNames.has(k))
  if (curCCandidate) {
    chosenNames.push(curCCandidate)
    availableNames.delete(curCCandidate)
  }

  // If fewer than 4 chosen, fill remaining from available sorted by PRIMARY_KPI_PREFERENCE then count
  if (chosenNames.length < 4 && availableNames.size > 0) {
    const remaining = [...availableNames].sort((a, b) => {
      const idxA = PRIMARY_KPI_PREFERENCE.indexOf(a)
      const idxB = PRIMARY_KPI_PREFERENCE.indexOf(b)
      if (idxA >= 0 && idxB >= 0) return idxA - idxB
      if (idxA >= 0) return -1
      if (idxB >= 0) return 1
      const countDiff = (nameCounts.get(b) || 0) - (nameCounts.get(a) || 0)
      if (countDiff !== 0) return countDiff
      return a.localeCompare(b)
    })
    for (const r of remaining) {
      if (chosenNames.length >= 4) break
      chosenNames.push(r)
    }
  }

  if (chosenNames.length) {
    const cards = chosenNames.map((name) => {
      const vals = online
        .map((d) => readDeviceMetric(d, name))
        .filter(Number.isFinite)
      const sum = vals.reduce((s, v) => s + v, 0)
      const mean = vals.length ? sum / vals.length : NaN
      const useMean = /voltage|pf|powerfactor|frequency|temp|moist|battery/i.test(name)
      return {
        key: name,
        label: name,
        metric: name,
        unit: unitForVariable(name),
        value: useMean ? mean : sum,
        agg: useMean ? 'Mean' : 'Sum',
        gaugeMax: useMean ? (mean > 0 ? mean * 1.4 : 1) : (sum > 0 ? sum * 1.2 : 100),
      }
    })
    return { cards, onlineCount: online.length, dynamic: true }
  }

  // Compat: no live metrics yet — classic EMS-shaped KPIs
  const nums = (type) => online.map((d) => readDeviceMetric(d, type)).filter(Number.isFinite)
  const sum = (type) => nums(type).reduce((s, v) => s + v, 0)
  const mean = (type) => {
    const arr = nums(type)
    return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : NaN
  }
  return {
    cards: [
      { key: 'power', label: 'Total Power', metric: 'power', unit: 'kW', value: sum('power'), agg: 'Sum', gaugeMax: 135 },
      { key: 'current', label: 'Total Current', metric: 'current', unit: 'A', value: sum('current'), agg: 'Sum', gaugeMax: 80 },
      { key: 'voltage', label: 'Avg Voltage', metric: 'voltage', unit: 'V', value: mean('voltage'), agg: 'Mean', gaugeMax: 240 },
      { key: 'pf', label: 'Avg Power Factor', metric: 'pf', unit: '', value: mean('pf'), agg: 'Mean', gaugeMax: 1 },
    ],
    onlineCount: online.length,
    dynamic: false,
  }
}

/** @deprecated Prefer computeDynamicKpis — kept for older callers */
export function computeKpis(devices = []) {
  const { cards, onlineCount } = computeDynamicKpis(devices)
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c.value]))
  return {
    totalPower: byKey.power ?? byKey.ActivePower ?? NaN,
    totalCurrent: byKey.current ?? byKey.CurrentA ?? NaN,
    avgVoltage: byKey.voltage ?? byKey.VoltageA ?? NaN,
    avgPF: byKey.pf ?? byKey.PowerFactor ?? NaN,
    onlineCount,
    cards,
  }
}

export { isOffline, ALIASES }
