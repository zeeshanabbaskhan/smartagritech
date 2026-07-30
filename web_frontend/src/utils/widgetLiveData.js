/**
 * Live data helpers for custom dashboard widgets.
 * Maps widget metrics / time ranges onto sensor, anomaly, slab-rate, and facility APIs.
 */
import emsApi, { list, one } from '../api/emsApi'
import {
  METRICS, getScopeChildren, collectDeviceIdsFromNode, resolveScopeDeviceIds, findNodeInTree,
} from '../data/facilitiesHierarchy'
import { unitForVariable } from './deviceMetrics'

export const WIDGET_TIME_TO_API = {
  today: '24h',
  week: '7d',
  month: '30d',
  year: '365d',
}

export const METRIC_TO_VARIABLE = {
  energyConsumption: 'PowerConsumption',
  activePower: 'ActivePower',
  voltage: 'VoltageA',
  current: 'CurrentA',
  powerFactor: 'PowerFactor',
  cost: 'PowerConsumption',
  carbonEmissions: 'PowerConsumption',
}

const FALLBACK_COST_PER_KWH = 45
const CARBON_KG_PER_KWH = 0.45

/** Resolve the real sensor variable name for a widget (dynamic first, catalog fallback). */
export function resolveWidgetVariableName(widget) {
  if (!widget) return null
  if (widget.variableName && widget.variableName !== '_none') return widget.variableName
  const metric = widget.metric
  if (!metric || metric === '_none' || metric === 'devicesOnline' || metric === 'activeAlarms') return null
  return METRIC_TO_VARIABLE[metric] || metric
}

function metricMeta(widget) {
  const variableName = resolveWidgetVariableName(widget)
  const metric = widget?.metric || 'energyConsumption'
  const fromCatalog = METRICS[metric]
  if (fromCatalog) return { ...fromCatalog, variableName }
  return {
    label: variableName || metric,
    unit: widget?.unit || unitForVariable(variableName || metric),
    color: '#F5A623',
    variableName,
  }
}

let cachedTariff = { at: 0, rate: FALLBACK_COST_PER_KWH }

async function resolveTariffRate() {
  if (Date.now() - cachedTariff.at < 60_000) return cachedTariff.rate
  try {
    const slabs = list(await emsApi.getSlabRates({ limit: 100 }))
    if (slabs.length) {
      const avg = slabs.reduce((s, r) => s + (parseFloat(r.rate) || 0), 0) / slabs.length
      cachedTariff = { at: Date.now(), rate: avg > 0 ? avg : FALLBACK_COST_PER_KWH }
      return cachedTariff.rate
    }
  } catch (_) {}
  cachedTariff = { at: Date.now(), rate: FALLBACK_COST_PER_KWH }
  return cachedTariff.rate
}

function applyMetricScaleSync(metric, value, tariffRate) {
  if (value == null || Number.isNaN(Number(value))) return 0
  const n = Number(value)
  if (metric === 'cost') return Math.round(n * tariffRate * 100) / 100
  if (metric === 'carbonEmissions') return Math.round(n * CARBON_KG_PER_KWH * 100) / 100
  return Math.round(n * 100) / 100
}

function formatBucketLabel(iso, widgetRange) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  if (widgetRange === 'today') return `${String(d.getHours()).padStart(2, '0')}:00`
  if (widgetRange === 'week') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  if (widgetRange === 'year') {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]
  }
  return `${d.getDate()}`
}

function pickLatestValue(latestMap, metricOrVar, tariffRate, scaleMetric) {
  if (!latestMap || typeof latestMap !== 'object') return null
  const primary = METRIC_TO_VARIABLE[metricOrVar] || metricOrVar
  const candidates = [
    primary,
    metricOrVar,
    metricOrVar === 'activePower' ? 'PowerConsumption' : null,
    metricOrVar === 'energyConsumption' ? 'ActivePower' : null,
  ].filter(Boolean)

  for (const key of candidates) {
    const entry = latestMap[key]
    const raw = entry && typeof entry === 'object' ? entry.value : entry
    if (raw != null && raw !== '') {
      const n = parseFloat(raw)
      if (!Number.isNaN(n)) return applyMetricScaleSync(scaleMetric || metricOrVar, n, tariffRate)
    }
  }
  return null
}

function metricFromDeviceHot(hot, metricOrVar, tariffRate, scaleMetric) {
  if (!hot) return null
  const primary = METRIC_TO_VARIABLE[metricOrVar] || metricOrVar
  const raw = hot[primary]
    ?? hot[metricOrVar]
    ?? (metricOrVar === 'activePower' ? hot.PowerConsumption : null)
    ?? (metricOrVar === 'energyConsumption' ? hot.ActivePower : null)
  if (raw == null || raw === '') return null
  const n = parseFloat(raw)
  return Number.isNaN(n) ? null : applyMetricScaleSync(scaleMetric || metricOrVar, n, tariffRate)
}

export function resolveDeviceId(widget, dashboardContext) {
  return widget?.targetDeviceId || dashboardContext?.targetDeviceId || null
}

function resolveScope(widget, dashboardContext) {
  return widget.scopeOverride || {
    level: dashboardContext?.level,
    buildingId: dashboardContext?.buildingId,
    floorId: dashboardContext?.floorId,
    departmentId: dashboardContext?.departmentId,
    nodeId: dashboardContext?.nodeId,
  }
}

/**
 * Fetch everything a WidgetRenderer needs for one widget.
 */
export async function fetchWidgetLiveBundle({ widget, dashboardContext, hierarchy, orgName }) {
  const metric = widget.metric || 'energyConsumption'
  const variableName = resolveWidgetVariableName(widget)
  const cfg = metricMeta(widget)
  const timeRange = widget.timeRange === 'inherit' || !widget.timeRange
    ? (dashboardContext?.timeRange || 'today')
    : widget.timeRange
  const apiRange = WIDGET_TIME_TO_API[timeRange] || '24h'
  const deviceId = resolveDeviceId(widget, dashboardContext)
  const tariffRate = await resolveTariffRate()
  const scope = resolveScope(widget, dashboardContext)
  const scaleMetric = metric === 'cost' || metric === 'carbonEmissions' ? metric : 'raw'

  const empty = {
    series: [],
    current: 0,
    previous: 0,
    comparison: [],
    tableRows: [],
    alarms: [],
    heatmap: null,
    multiSeries: {},
    loadingOk: true,
    source: 'empty',
  }

  if (metric === 'devicesOnline' || metric === 'activeAlarms') {
    if (metric === 'devicesOnline') {
      const devices = list(await emsApi.getDevices({ limit: 100 }))
      const scopeIds = new Set(resolveScopeDeviceIds(hierarchy, scope))
      const scoped = scopeIds.size ? devices.filter((d) => scopeIds.has(d.id)) : devices
      const online = scoped.filter((d) => String(d.status || '').toUpperCase() === 'ONLINE').length
      return {
        ...empty,
        current: online,
        series: [{ label: 'Now', value: online }],
        comparison: scoped.slice(0, 12).map((d) => ({
          name: d.name,
          value: String(d.status || '').toUpperCase() === 'ONLINE' ? 1 : 0,
          unit: '',
        })),
        tableRows: scoped.map((d) => ({
          device: d.name,
          value: String(d.status || '').toUpperCase() === 'ONLINE' ? 1 : 0,
          status: String(d.status || '').toUpperCase() === 'ONLINE' ? 'Online' : 'Offline',
          unit: '',
        })),
        source: 'devices',
      }
    }
    const anomalies = list(await emsApi.getAnomalies({
      limit: 50,
      alarmState: 'ACTIVE',
      ...(deviceId ? { deviceId } : {}),
    }))
    return {
      ...empty,
      current: anomalies.length,
      series: [{ label: 'Active', value: anomalies.length }],
      alarms: mapAlarms(anomalies),
      source: 'anomalies',
    }
  }

  const devicesRes = await emsApi.getDevices({ limit: 100, withMetrics: 'true' }).catch(() => null)
  const devices = devicesRes ? list(devicesRes) : []
  const deviceById = Object.fromEntries(devices.map((d) => [d.id, d]))
  const hotKey = variableName || metric

  const tableRows = devices.map((d) => {
    const val = metricFromDeviceHot(d.latestMetrics, hotKey, tariffRate, scaleMetric === 'raw' ? metric : scaleMetric)
    return {
      device: d.name,
      value: val ?? 0,
      status: String(d.status || '').toUpperCase() === 'ONLINE' ? 'Online' : 'Offline',
      unit: cfg.unit,
    }
  })

  // Facility group-by: sum live metrics for devices linked under each child node
  let comparison = []
  if (widget.groupBy && widget.groupBy !== 'none') {
    const children = getScopeChildren(hierarchy, scope)
    if (children.length) {
      comparison = children.map((child) => {
        const match = hierarchy?.tree
          ? findNodeInTree(hierarchy.tree, child.nodeId)?.node
          : null
        const ids = match ? collectDeviceIdsFromNode(match) : []
        let sum = 0
        for (const id of ids) {
          const d = deviceById[id]
          sum += metricFromDeviceHot(d?.latestMetrics, hotKey, tariffRate, scaleMetric === 'raw' ? metric : scaleMetric) ?? 0
        }
        return { name: child.name, value: Math.round(sum * 100) / 100, unit: cfg.unit }
      })
    } else {
      comparison = tableRows.map((r) => ({ name: r.device, value: r.value, unit: r.unit }))
    }
  } else {
    comparison = tableRows.map((r) => ({ name: r.device, value: r.value, unit: r.unit }))
  }

  const alarmsRaw = list(await emsApi.getAnomalies({
    limit: 20,
    alarmState: 'ACTIVE',
    ...(deviceId ? { deviceId } : {}),
  }).catch(() => ({ data: [] })))

  // Prefer explicit device; else first device in facility scope
  const scopeDeviceIds = resolveScopeDeviceIds(hierarchy, scope)
  const effectiveDeviceId = deviceId || scopeDeviceIds[0] || null

  if (!effectiveDeviceId || !variableName) {
    const scopedRows = scopeDeviceIds.length
      ? tableRows.filter((r) => {
          const d = devices.find((x) => x.name === r.device)
          return d && scopeDeviceIds.includes(d.id)
        })
      : tableRows
    return {
      ...empty,
      current: scopedRows.reduce((s, r) => s + (r.value || 0), 0),
      series: scopedRows.slice(0, 12).map((r) => ({ label: r.device, value: r.value })),
      comparison,
      tableRows: scopedRows.length ? scopedRows : tableRows,
      alarms: mapAlarms(alarmsRaw),
      source: 'org-devices',
      unit: cfg.unit,
    }
  }

  const [latestRes, aggRes, summaryRes] = await Promise.all([
    emsApi.getLatestReadings({ deviceId: effectiveDeviceId }).catch(() => null),
    emsApi.getSensorAggregate({ deviceId: effectiveDeviceId, variableName, timeRange: apiRange }).catch(() => null),
    emsApi.getDashboardSummary({ deviceId: effectiveDeviceId, timeRange: apiRange === '365d' ? '30d' : apiRange }).catch(() => null),
  ])

  const latestMap = one(latestRes) || {}
  let current = pickLatestValue(latestMap, variableName, tariffRate, scaleMetric === 'raw' ? metric : scaleMetric) ?? 0

  const aggPoints = list(aggRes)
  let series = aggPoints.map((p) => ({
    label: formatBucketLabel(p.timestamp, timeRange),
    value: applyMetricScaleSync(scaleMetric === 'raw' ? metric : scaleMetric, p.value, tariffRate),
  }))

  // Collapse year weekly buckets into monthly labels when needed
  if (timeRange === 'year' && series.length > 12) {
    const byMonth = {}
    aggPoints.forEach((p) => {
      const d = new Date(p.timestamp)
      if (Number.isNaN(d.getTime())) return
      const key = d.getMonth()
      if (!byMonth[key]) byMonth[key] = { sum: 0, n: 0 }
      byMonth[key].sum += Number(p.value) || 0
      byMonth[key].n += 1
    })
    series = Object.keys(byMonth).sort((a, b) => a - b).map((m) => ({
      label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
      value: applyMetricScaleSync(scaleMetric === 'raw' ? metric : scaleMetric, byMonth[m].sum / Math.max(1, byMonth[m].n), tariffRate),
    }))
  }

  if (!series.length && summaryRes?.data) {
    const s = summaryRes.data
    const chart =
      (variableName && s.charts?.[variableName])
      || (metric === 'energyConsumption' && s.totalPowerConsumption?.chartData)
      || (metric === 'activePower' && s.totalPowerConsumption?.chartData)
      || (metric === 'voltage' && s.voltageImbalance?.chartData)
      || (metric === 'current' && s.currentImbalance?.chartData)
      || (metric === 'powerFactor' && s.powerFactor?.chartData)
      || []
    series = (chart || []).map((p) => ({
      label: formatBucketLabel(p.timestamp, timeRange),
      value: applyMetricScaleSync(scaleMetric === 'raw' ? metric : scaleMetric, p.value, tariffRate),
    }))
    if (!current && s.totalPowerConsumption?.value != null && (metric === 'energyConsumption' || metric === 'cost' || metric === 'carbonEmissions')) {
      current = applyMetricScaleSync(metric, s.totalPowerConsumption.value, tariffRate)
    }
  }

  if (!series.length) series = [{ label: 'Now', value: current }]

  const previous = series.length > 1 ? series[series.length - 2].value : current

  const multiKeys = (widget.metrics || []).map((m) => m.variableName || m.key).filter(Boolean)
  const multiSeries = {}
  if (widget.type === 'multiseries' && multiKeys.length) {
    await Promise.all(multiKeys.map(async (key) => {
      const vName = METRIC_TO_VARIABLE[key] || key
      const res = await emsApi.getSensorAggregate({
        deviceId: effectiveDeviceId,
        variableName: vName,
        timeRange: apiRange,
      }).catch(() => null)
      multiSeries[key] = list(res).map((p) => ({
        label: formatBucketLabel(p.timestamp, timeRange),
        value: applyMetricScaleSync(scaleMetric === 'raw' ? metric : scaleMetric, p.value, tariffRate),
      }))
    }))
  }

  let heatmap = null
  if (widget.type === 'heatmap') {
    const heatAgg = list(await emsApi.getSensorAggregate({
      deviceId: effectiveDeviceId,
      variableName,
      timeRange: '7d',
    }).catch(() => null))
    heatmap = buildHeatmapMatrix(heatAgg, scaleMetric === 'raw' ? metric : scaleMetric, tariffRate)
  }

  return {
    series,
    current,
    previous,
    comparison,
    tableRows,
    alarms: mapAlarms(alarmsRaw),
    heatmap,
    multiSeries,
    loadingOk: true,
    source: 'device',
    unit: cfg.unit,
    orgName,
    tariffRate,
  }
}

function mapAlarms(rows) {
  return (rows || []).slice(0, 12).map((a, i) => {
    const sev = String(a.alarmState || '').toUpperCase() === 'ACTIVE'
      ? (String(a.triggerType || '').toLowerCase().includes('critical') ? 'danger' : 'warning')
      : 'info'
    const t = a.alarmTime ? new Date(a.alarmTime) : null
    const hoursAgo = t && !Number.isNaN(t.getTime())
      ? Math.max(0, Math.round((Date.now() - t.getTime()) / 3600000))
      : 0
    return {
      id: a.id || i,
      name: a.triggerName || a.variableName || 'Alarm',
      severity: sev,
      time: `${hoursAgo}h ago`,
    }
  })
}

function buildHeatmapMatrix(points, metric, tariffRate) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const matrix = DAYS.map(() => Array.from({ length: 24 }, () => ({ sum: 0, n: 0 })))
  for (const p of points || []) {
    const d = new Date(p.timestamp)
    if (Number.isNaN(d.getTime())) continue
    const dayIdx = (d.getDay() + 6) % 7
    const hour = d.getHours()
    const cell = matrix[dayIdx][hour]
    cell.sum += applyMetricScaleSync(metric, p.value, tariffRate)
    cell.n += 1
  }
  return matrix.map((row) => row.map((c) => (c.n ? Math.round((c.sum / c.n) * 10) / 10 : 0)))
}

export function mergeMultiSeries(primarySeries, multiSeries, seriesList) {
  const labels = primarySeries.map((p) => p.label)
  for (const s of seriesList) {
    const pts = multiSeries[s.key] || []
    if (pts.length > labels.length) {
      return pts.map((pt, i) => {
        const entry = { label: pt.label }
        seriesList.forEach((sk) => {
          entry[sk.key] = (multiSeries[sk.key] || [])[i]?.value
            ?? (sk.key === seriesList[0].key ? primarySeries[i]?.value : null)
        })
        return entry
      })
    }
  }
  return labels.map((label, i) => {
    const entry = { label }
    seriesList.forEach((s) => {
      entry[s.key] = (multiSeries[s.key] || primarySeries)[i]?.value ?? null
    })
    return entry
  })
}
