// Live values from Redis hash device:{id}:latest (keyed by config variable names).

const ALIASES = {
  power:       ['ActivePower', 'PowerConsumption', 'TotalActivePower', 'ActivePowerTotal', 'Power', 'kW'],
  current:     ['CurrentA', 'Ia', 'Current', 'TotalCurrent', 'CurrentTotal', 'AverageCurrent'],
  voltage:     ['VoltageA', 'Va', 'Voltage', 'AverageVoltage', 'VoltageAvg', 'Vab'],
  pf:          ['PowerFactor', 'PF', 'pf', 'AveragePowerFactor', 'TotalPowerFactor'],
  consumption: ['EnergyConsumption', 'ActiveEnergy', 'PowerConsumption', 'kWh', 'TotalEnergy', 'Energy'],
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
 * MQTT ActivePower registers are typically watts; classic EMS PowerConsumption is often already kW.
 */
export function powerReadingToKw(variableName, value, unit = '') {
  const n = Number(value)
  if (!Number.isFinite(n)) return NaN
  const u = String(unit || '').toLowerCase().trim()
  if (u === 'kw' || u === 'kilowatt') return n
  if (u === 'w' || u === 'watt' || u === 'watts') return n / 1000
  const nm = String(variableName || '')
  if (/powerconsumption/i.test(nm) && !/active/i.test(nm)) return n
  if (/activepower|^power$|totalactivepower|exportpower|solarpower/i.test(nm)) return n / 1000
  if (Math.abs(n) >= 200) return n / 1000
  return n
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

/** Device contributes live metrics when switch is ON (recent values OK even if Offline). */
export const isTelemetryActive = (d) => !isSwitchOff(d)

function parseMetricRaw(raw) {
  if (raw == null || raw === '') return NaN
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    return parseFloat(raw.value)
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
    entries.push({
      name,
      label: name,
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

/**
 * Fleet KPIs from real shared variable names across online devices.
 * Falls back to classic EMS aliases when no live metrics yet.
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

  const topNames = [...nameCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([n]) => n)

  if (topNames.length) {
    const cards = topNames.map((name) => {
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
