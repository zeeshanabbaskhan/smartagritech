import emsApi, { list, one } from '../api/emsApi'

const CHART_COLORS = ['#F5A623', '#3B82F6', '#EF4444', '#10B981', '#06b6d4', '#8B5CF6']

export function parseReadingsField(readings) {
  if (Array.isArray(readings)) return readings
  if (typeof readings === 'string') {
    try {
      const parsed = JSON.parse(readings)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** /sensor-data/latest → [{ variableName, value, unit, lastUpdatedAt? }] */
export function latestToReadings(res) {
  const payload = one(res) ?? res?.data ?? res ?? {}
  if (Array.isArray(payload.readings)) {
    return payload.readings.map((r) => ({
      variableName: r.variableName ?? r.name,
      value: r.value,
      unit: r.unit ?? '',
      lastUpdatedAt: r.lastUpdatedAt ?? r.receivedTime ?? null,
    }))
  }
  if (Array.isArray(payload.values)) {
    return payload.values.map((r) => ({
      variableName: r.variableName ?? r.name,
      value: r.value,
      unit: r.unit ?? '',
      lastUpdatedAt: r.lastUpdatedAt ?? null,
    }))
  }
  return Object.entries(payload)
    .filter(([, v]) => v && typeof v === 'object' && 'value' in v)
    .map(([variableName, v]) => ({
      variableName,
      value: v.value,
      unit: v.unit ?? '',
      lastUpdatedAt: v.lastUpdatedAt ?? null,
    }))
}

/** Flatten /sensor-data/readings rows for history tables */
export function flattenSensorRows(rows) {
  const out = []
  for (const row of rows ?? []) {
    const ts = row.timestamp ?? row.createdAt
    for (const r of parseReadingsField(row.readings)) {
      if (!r?.variableName) continue
      out.push({
        id: `${ts}-${r.variableName}`,
        timestamp: ts,
        variableName: r.variableName,
        value: r.value,
        unit: r.unit ?? '—',
      })
    }
  }
  return out
}

export function formatChartTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export async function fetchDeviceVariables(deviceId, slaveId = null) {
  if (!deviceId) return []
  const slaves = list(await emsApi.getDeviceConfig(deviceId))
  const targets = slaveId ? slaves.filter((s) => s.id === slaveId) : slaves
  const vars = []
  for (const slave of targets) {
    const rows = list(await emsApi.getDeviceVariables(deviceId, slave.id))
    for (const v of rows) {
      vars.push({
        name: v.name ?? v.variableName,
        unit: v.unit ?? '',
        slaveId: slave.id,
        slaveName: slave.name ?? slave.slaveName ?? slave.id,
      })
    }
  }
  return vars
}

function mergeAggregateSeries(seriesList) {
  const byTime = new Map()
  for (const s of seriesList) {
    for (const p of s.points ?? []) {
      const t = new Date(p.timestamp).getTime()
      if (Number.isNaN(t)) continue
      if (!byTime.has(t)) byTime.set(t, { time: formatChartTime(p.timestamp) })
      byTime.get(t)[s.key] = p.value
    }
  }
  return Array.from(byTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row)
}

/**
 * Device-scoped chart data for dashboards.
 * power: [{ time, power }] from PowerConsumption when present
 * multi: merged rows for up to 3 device variables (real aggregates, not fake)
 * lines: [{ key, label, color }] for rendering
 */
export async function fetchDeviceDashboardCharts(deviceId, timeRange = '24h', slaveId = null) {
  if (!deviceId) {
    return { power: [], multi: [], lines: [], variables: [] }
  }

  const q = { deviceId, timeRange }
  if (slaveId) q.slaveId = slaveId

  const [summaryRes, latestRes] = await Promise.all([
    emsApi.getDashboardSummary(q).catch(() => ({ data: {} })),
    emsApi.getLatestReadings({ deviceId, slaveId }).catch(() => null),
  ])

  const summary = summaryRes?.data ?? {}
  const readings = latestToReadings(latestRes)

  const power = (summary.totalPowerConsumption?.chartData ?? []).map((p) => ({
    time: formatChartTime(p.timestamp),
    power: p.value,
  }))

  const preferred = ['VoltageA', 'VoltageB', 'VoltageC', 'SoilMoisture', 'BatteryLevel', 'ActivePower', 'CurrentA']
  const fromLatest = readings.map((r) => r.variableName).filter(Boolean)
  const varNames = [...new Set([
    ...preferred.filter((n) => fromLatest.includes(n)),
    ...fromLatest.filter((n) => n !== 'PowerConsumption'),
  ])].slice(0, 3)

  const aggregates = await Promise.all(
    varNames.map(async (variableName) => {
      const res = await emsApi.getSensorAggregate({ deviceId, slaveId, variableName, timeRange }).catch(() => ({ data: [] }))
      const reading = readings.find((r) => r.variableName === variableName)
      return {
        key: variableName,
        label: variableName,
        unit: reading?.unit ?? '',
        points: res?.data ?? [],
      }
    }),
  )

  const lines = aggregates.map((s, i) => ({
    key: s.key,
    label: s.label,
    unit: s.unit,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  return {
    power,
    multi: mergeAggregateSeries(aggregates),
    lines,
    variables: readings,
    summary,
  }
}

export const SUMMARY_CARDS = [
  ['totalPowerConsumption', 'Total Consumption'],
  ['totalExportPower', 'Export Power'],
  ['powerFactor', 'Power Factor'],
  ['voltageImbalance', 'Voltage Imbalance'],
  ['currentImbalance', 'Current Imbalance'],
  ['frequency', 'Frequency'],
  ['thdV', 'THD Voltage'],
  ['thdI', 'THD Current'],
]
