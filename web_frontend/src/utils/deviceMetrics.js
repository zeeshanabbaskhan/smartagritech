// Reads live values out of a device's `latestMetrics` hash (device:{id}:latest).
// The hash is keyed by template variable names, which vary by deployment, so we
// probe a list of common aliases for each logical metric.

const ALIASES = {
  power:       ['ActivePower', 'PowerConsumption', 'TotalActivePower', 'ActivePowerTotal', 'Power', 'kW'],
  current:     ['CurrentA', 'Ia', 'Current', 'TotalCurrent', 'CurrentTotal', 'AverageCurrent'],
  voltage:     ['VoltageA', 'Va', 'Voltage', 'AverageVoltage', 'VoltageAvg', 'Vab'],
  pf:          ['PowerFactor', 'PF', 'pf', 'AveragePowerFactor', 'TotalPowerFactor'],
  consumption: ['EnergyConsumption', 'ActiveEnergy', 'PowerConsumption', 'kWh', 'TotalEnergy'],
}

/** Return a numeric metric value from a device, or NaN if unavailable. */
export function readDeviceMetric(device, type) {
  const metrics = device?.latestMetrics
  if (!metrics || typeof metrics !== 'object') return NaN
  const keys = ALIASES[type] ?? [type]
  for (const key of keys) {
    const raw = metrics[key]
    if (raw != null && raw !== '') {
      const n = parseFloat(raw)
      if (Number.isFinite(n)) return n
    }
  }
  return NaN
}

/** Formatted display string for a metric ('—' when unavailable). */
export function formatDeviceMetric(device, type, { offline = false } = {}) {
  if (offline) return type === 'status' ? 'Offline' : '—'
  const n = readDeviceMetric(device, type)
  if (!Number.isFinite(n)) return '—'
  return type === 'pf' ? n.toFixed(2) : n.toFixed(1)
}

const isOffline = (d) => d.status === 'Offline' || d.status === 'OFFLINE' || d.status === 'offline'

/** Aggregate KPI values (sum power/current, mean voltage/pf) over online devices. */
export function computeKpis(devices = []) {
  const online = devices.filter((d) => !isOffline(d))
  const nums = (type) => online.map((d) => readDeviceMetric(d, type)).filter(Number.isFinite)
  const sum = (type) => nums(type).reduce((s, v) => s + v, 0)
  const mean = (type) => {
    const arr = nums(type)
    return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : NaN
  }
  return {
    totalPower: sum('power'),
    totalCurrent: sum('current'),
    avgVoltage: mean('voltage'),
    avgPF: mean('pf'),
    onlineCount: online.length,
  }
}

export { isOffline }
