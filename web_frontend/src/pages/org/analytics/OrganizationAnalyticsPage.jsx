import { useEffect, useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, Download, Eye, RefreshCw, RotateCcw, Loader2 } from 'lucide-react'
import DataTable from '../../../components/ui/DataTable'
import Modal from '../../../components/ui/Modal'
import emsApi, { list } from '../../../api/emsApi'
import { mapDevice, mapAnomaly, mergeVoltageChart, mergeCurrentChart, aiPointsToChart } from '../../../utils/mappers'
import {
  RANGE_LABELS,
  formatTs,
  alarmStatus,
  alarmSeverity,
  imbalanceEventsFromSeries,
  energyFromAiResponse,
  energyFromCfFallback,
  anomalyActivitySeries,
  cfFallbackChart,
  cfFallbackEvents,
  preferLive,
} from '../../../utils/analyticsHelpers'

const CURRENCY = 'PKR'

const PAGE_CONFIG = {
  voltage: {
    title: 'Voltage Imbalance', crumb: 'Voltage Imbalance',
    chartTitle: 'Phase Voltage Trend', chartDescription: 'Average organization phase voltage comparison (V)',
    tableTitle: 'Detected Imbalance Events', kind: 'imbalance', api: 'getAiVoltage',
  },
  current: {
    title: 'Current Imbalance', crumb: 'Current Imbalance',
    chartTitle: 'Current Imbalance Trend', chartDescription: 'Average current by phase (A)',
    tableTitle: 'Detected Imbalance Events', kind: 'imbalance', api: 'getAiCurrent',
  },
  powerFactor: {
    title: 'Power Factor', crumb: 'Power Factor',
    chartTitle: 'Power Factor Trend', chartDescription: 'Organization average compared with selected scope',
    tableTitle: 'PF Below Threshold Events', kind: 'powerFactor', api: 'getAiPowerFactor',
  },
  energy: {
    title: 'Energy Consumption', crumb: 'Energy Consumption',
    chartTitle: 'Power Consumption', chartDescription: 'Active power over the selected reporting period (kW)',
    tableTitle: 'Consumption Records', kind: 'energy', api: 'getAiEnergy',
  },
  anomalies: {
    title: 'Anomalies', crumb: 'Anomalies',
    chartTitle: 'Anomaly Activity', chartDescription: 'Active and resolved anomaly trend',
    tableTitle: 'Anomalies', kind: 'anomaly', api: null,
  },
}

function Gauge({ value, scope }) {
  const num = Number(value) || 0
  const pct = Math.max(0, Math.min(1, (num - 0.7) / 0.3))
  const angle = pct * 180 - 180
  const color = num >= 0.9 ? '#16a34a' : num >= 0.85 ? '#F5A623' : '#dc2626'
  const needleX = 100 + 62 * Math.cos((angle * Math.PI) / 180)
  const needleY = 90 + 62 * Math.sin((angle * Math.PI) / 180)
  const status = num >= 0.9 ? 'Excellent' : num >= 0.85 ? 'Acceptable' : num >= 0.8 ? 'Warning' : 'Critical'
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-surface-800 text-center mb-1">Current Power Factor</h3>
      <p className="text-xs text-surface-600 dark:text-surface-400 text-center mb-4">{scope} · threshold 0.85</p>
      <svg viewBox="0 0 200 110" className="w-full max-w-xs mx-auto">
        <path d="M 30 90 A 70 70 0 0 1 170 90" fill="none" stroke="#ECEEE6" strokeWidth="14" strokeLinecap="round" />
        <path d={`M 30 90 A 70 70 0 ${pct > 0.5 ? 1 : 0} 1 ${30 + pct * 140} ${90 - Math.sin(pct * Math.PI) * 70}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        <line x1="100" y1="90" x2={needleX} y2={needleY} stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="90" r="4" fill="#1F2937" />
        <text x="100" y="78" fontSize="20" fill="#1F2937" textAnchor="middle" fontWeight="700">{num.toFixed(2)}</text>
        <text x="100" y="94" fontSize="8" fill="#64748b" textAnchor="middle">POWER FACTOR</text>
      </svg>
      <p className={`text-center text-xs mt-2 ${num >= 0.9 ? 'text-success-600' : num >= 0.85 ? 'text-primary-600' : 'text-danger-600'}`}>{status} · selected scope</p>
    </div>
  )
}

function MetricCard({ label, value, color = 'text-primary-600' }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">{label}</p>
    </div>
  )
}

function SeverityBadge({ value }) {
  const klass = value === 'Critical' || value === 'High' ? 'badge-danger' : value === 'Warning' || value === 'Medium' ? 'badge-warning' : 'badge-info'
  return <span className={`badge ${klass}`}>{value}</span>
}
function StatusBadge({ value }) {
  return <span className={`badge ${value === 'Active' || value === 'Detected' ? 'badge-danger' : 'badge-success'}`}>{value}</span>
}

function exportCsv(filename, rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0]).filter((k) => !['id', '_raw', 'imbalanceValue', 'deviceId'].includes(k))
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((k) => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function loadAnalytics({ type, deviceId, timeRange }) {
  const config = PAGE_CONFIG[type]
  const fallbackChart = cfFallbackChart(type)
  const fallbackRows = cfFallbackEvents(type)

  if (type === 'anomalies') {
    try {
      const anomalies = list(await emsApi.getAnomalies({ limit: 100 })).map(mapAnomaly)
      const rows = deviceId ? anomalies.filter((a) => a.deviceId === deviceId) : anomalies
      const liveChart = anomalyActivitySeries(rows)
      return {
        chartData: preferLive(liveChart, fallbackChart),
        rows: preferLive(rows, fallbackRows),
        isDemo: !(rows.length || liveChart.length),
      }
    } catch {
      return { chartData: fallbackChart, rows: fallbackRows, isDemo: true }
    }
  }

  if (!deviceId) {
    if (type === 'energy') return { ...energyFromCfFallback('Organization'), isDemo: true }
    if (type === 'powerFactor') {
      const chartData = fallbackChart
      const vals = chartData.map((p) => p.pf)
      return {
        chartData, rows: fallbackRows, isDemo: true,
        meta: { currentPf: vals[vals.length - 1], avg: vals.reduce((a, b) => a + b, 0) / vals.length, min: Math.min(...vals), below: vals.filter((v) => v < 0.85).length },
      }
    }
    const imb = type === 'voltage' ? 2.1 : 2.4
    return {
      chartData: fallbackChart, rows: fallbackRows, isDemo: true,
      meta: { maxImb: imb, avgImb: imb * 0.4 },
    }
  }

  try {
    const res = await emsApi[config.api]({ deviceId, timeRange })
    const d = res?.data ?? {}

    if (type === 'voltage') {
      const liveChart = mergeVoltageChart(d.chartData ?? {})
      const chartData = preferLive(liveChart, fallbackChart)
      const imbSeries = d.chartData?.voltageImbalance ?? []
      const imb = imbSeries.map((p) => p.value).filter((v) => v != null)
      const alarmRows = (d.alarms ?? []).map((a, i) => ({
        id: a.id ?? `alarm-${i}`,
        time: formatTs(a.alarmTime),
        phaseA: d.current?.VoltageA != null ? `${Number(d.current.VoltageA).toFixed(1)}V` : '—',
        phaseB: d.current?.VoltageB != null ? `${Number(d.current.VoltageB).toFixed(1)}V` : '—',
        phaseC: d.current?.VoltageC != null ? `${Number(d.current.VoltageC).toFixed(1)}V` : '—',
        imbalance: a.triggeringCondition ?? a.variableName ?? '—',
        severity: alarmSeverity(a),
        status: alarmStatus(a),
      }))
      const seriesRows = imbalanceEventsFromSeries({ imbalance: imbSeries, chartRows: liveChart, chartKeys: ['voltageA', 'voltageB', 'voltageC'], unit: 'V' })
      const liveRows = alarmRows.length ? alarmRows : seriesRows
      return {
        chartData,
        rows: preferLive(liveRows, fallbackRows),
        isDemo: !liveChart.length,
        meta: {
          maxImb: imb.length ? Math.max(...imb) : 2.1,
          avgImb: imb.length ? imb.reduce((a, b) => a + b, 0) / imb.length : 0.8,
        },
      }
    }

    if (type === 'current') {
      const liveChart = mergeCurrentChart(d.chartData ?? {})
      const chartData = preferLive(liveChart, fallbackChart)
      const imbSeries = d.chartData?.currentImbalance ?? []
      const imb = imbSeries.map((p) => p.value).filter((v) => v != null)
      const liveRows = imbalanceEventsFromSeries({ imbalance: imbSeries, chartRows: liveChart, chartKeys: ['currentA', 'currentB', 'currentC'], unit: 'A' })
      return {
        chartData,
        rows: preferLive(liveRows, fallbackRows),
        isDemo: !liveChart.length,
        meta: {
          maxImb: imb.length ? Math.max(...imb) : 2.4,
          avgImb: imb.length ? imb.reduce((a, b) => a + b, 0) / imb.length : 0.9,
        },
      }
    }

    if (type === 'powerFactor') {
      const liveChart = aiPointsToChart(d.chartData ?? [], 'pf')
      const chartData = preferLive(liveChart, fallbackChart)
      const vals = chartData.map((p) => p.pf ?? p.value).filter((v) => v != null)
      const currentPf = Number(d.current ?? (vals.length ? vals[vals.length - 1] : 0.91))
      const liveRows = (d.alarms ?? []).map((a, i) => ({
        id: a.id ?? i,
        time: formatTs(a.alarmTime),
        pf: a.currentValue != null ? Number(a.currentValue).toFixed(2) : currentPf.toFixed(2),
        duration: a.durationMinutes != null ? `${a.durationMinutes} min` : (a.duration ?? '—'),
        threshold: '0.85',
        status: alarmStatus(a),
      }))
      return {
        chartData,
        rows: preferLive(liveRows, fallbackRows),
        isDemo: !liveChart.length,
        meta: {
          currentPf,
          avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : currentPf,
          min: vals.length ? Math.min(...vals) : currentPf,
          below: vals.filter((v) => v < 0.85).length,
        },
      }
    }

    const energy = energyFromAiResponse(d)
    if (!energy.chartData.length) return energyFromCfFallback('Organization')
    return energy
  } catch {
    if (type === 'energy') return energyFromCfFallback('Organization')
    return {
      chartData: fallbackChart,
      rows: fallbackRows,
      isDemo: true,
      meta: type === 'powerFactor'
        ? { currentPf: 0.91, avg: 0.92, min: 0.90, below: 1 }
        : { maxImb: 2.1, avgImb: 0.8 },
    }
  }
}

export default function OrganizationAnalyticsPage({ type }) {
  const config = PAGE_CONFIG[type]
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [timeRange, setTimeRange] = useState('7d')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    emsApi.getDevices({ limit: 100 }).then((res) => {
      if (!alive) return
      const mapped = list(res).map(mapDevice)
      setDevices(mapped)
      setDeviceId((prev) => prev || mapped[0]?.id || '')
    }).catch(() => setDevices([]))
    return () => { alive = false }
  }, [])

  const reload = async () => {
    setLoading(true)
    try {
      const result = await loadAnalytics({ type, deviceId: deviceId || null, timeRange })
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [type, deviceId, timeRange])

  const selectedDevice = devices.find((d) => d.id === deviceId)
  const scopeLabel = selectedDevice ? selectedDevice.name : 'Organization'

  const fallbackEnergy = useMemo(() => energyFromCfFallback(scopeLabel || 'Organization'), [scopeLabel])

  const filteredRows = useMemo(() => {
    const rows = data?.rows?.length ? data.rows : cfFallbackEvents(type)
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => Object.values(r).join(' ').toLowerCase().includes(q))
  }, [data, search, type])

  const chartData = data?.chartData?.length ? data.chartData : cfFallbackChart(type)
  const dailyData = data?.dailyData?.length
    ? data.dailyData
    : (type === 'energy' ? fallbackEnergy.dailyData : [])

  const stats = useMemo(() => {
    const m = data?.meta ?? (type === 'energy' ? fallbackEnergy.meta : {})
    if (type === 'powerFactor') {
      return [
        ['Avg Power Factor', m.avg != null ? Number(m.avg).toFixed(2) : '0.92', 'text-success-600'],
        ['Min Power Factor', m.min != null ? Number(m.min).toFixed(2) : '0.90', 'text-primary-600'],
        ['Hours Below 0.85', m.below != null ? `${m.below}` : '1', 'text-danger-600'],
        ['Events', String(filteredRows.length || 3), 'text-info-600'],
      ]
    }
    if (type === 'energy') {
      return [
        ['Total Energy', m.total != null ? `${Number(m.total).toLocaleString()} kWh` : `${fallbackEnergy.meta.total.toLocaleString()} kWh`, 'text-primary-600'],
        ['Peak Power', m.peak != null ? `${Number(m.peak).toFixed(1)} kW` : `${fallbackEnergy.meta.peak.toFixed(1)} kW`, 'text-primary-600'],
        ['Off-Peak Energy', m.offPeak != null ? `${Number(m.offPeak).toLocaleString()} kWh` : `${fallbackEnergy.meta.offPeak.toLocaleString()} kWh`, 'text-info-600'],
        ['On-Peak Energy', m.onPeak != null ? `${Number(m.onPeak).toLocaleString()} kWh` : `${fallbackEnergy.meta.onPeak.toLocaleString()} kWh`, 'text-success-600'],
        ['Estimated Cost', m.cost != null ? `${CURRENCY} ${Number(m.cost).toLocaleString()}` : `${CURRENCY} ${fallbackEnergy.meta.cost.toLocaleString()}`, 'text-danger-600'],
        ['Samples', String(m.samples ?? filteredRows.length), 'text-info-600'],
      ]
    }
    if (type === 'anomalies') {
      return [
        ['Active Anomalies', String(filteredRows.filter((r) => r.status === 'Active').length), 'text-danger-600'],
        ['Resolved Anomalies', String(filteredRows.filter((r) => r.status === 'Resolved').length), 'text-success-600'],
        ['Critical Anomalies', String(filteredRows.filter((r) => r.severity === 'Critical' || r.severity === 'High').length), 'text-danger-600'],
        ['Total', String(filteredRows.length), 'text-info-600'],
      ]
    }
    return [
      [`Maximum ${type === 'current' ? 'Current ' : ''}Imbalance`, m.maxImb != null ? `${Number(m.maxImb).toFixed(1)}%` : '2.1%', 'text-primary-600'],
      [`Average ${type === 'current' ? 'Current ' : ''}Imbalance`, m.avgImb != null ? `${Number(m.avgImb).toFixed(1)}%` : '0.8%', 'text-info-600'],
      ['Events Detected', String(filteredRows.length || 3), 'text-danger-600'],
      ['Devices Affected', '1', 'text-success-600'],
    ]
  }, [data, filteredRows, type, fallbackEnergy])

  const columns = {
    imbalance: [
      { key: 'time', label: 'Timestamp', render: (v) => <span className="font-mono text-xs">{v}</span> },
      { key: 'phaseA', label: 'Phase A' }, { key: 'phaseB', label: 'Phase B' }, { key: 'phaseC', label: 'Phase C' },
      { key: 'imbalance', label: 'Imbalance', render: (v) => <span className="font-semibold text-primary-600">{v}</span> },
      { key: 'severity', label: 'Severity', render: (v) => <SeverityBadge value={v} /> },
      { key: 'status', label: 'Status', render: (v) => <StatusBadge value={v} /> },
    ],
    powerFactor: [
      { key: 'time', label: 'Timestamp', render: (v) => <span className="font-mono text-xs">{v}</span> },
      { key: 'pf', label: 'Power Factor', render: (v) => <span className="font-semibold text-primary-600">{v}</span> },
      { key: 'duration', label: 'Duration' }, { key: 'threshold', label: 'Threshold' },
      { key: 'status', label: 'Status', render: (v) => <StatusBadge value={v} /> },
    ],
    energy: [
      { key: 'date', label: 'Time', render: (v) => <span className="font-mono text-xs">{v}</span> },
      { key: 'power', label: 'Active Power' },
      { key: 'kWh', label: 'Energy', render: (v) => (v != null ? `${Number(v).toLocaleString()} kWh` : '—') },
      { key: 'cost', label: 'Estimated Cost', render: (v) => (v != null ? `${CURRENCY} ${Number(v).toLocaleString()}` : '—') },
    ],
    anomaly: [
      { key: 'type', label: 'Anomaly Type' }, { key: 'device', label: 'Device' },
      { key: 'variable', label: 'Variable' }, { key: 'desc', label: 'Description' },
      { key: 'time', label: 'Detected At', render: (v) => <span className="font-mono text-xs">{v}</span> },
      { key: 'severity', label: 'Severity', render: (v) => <SeverityBadge value={v} /> },
      { key: 'status', label: 'Status', render: (v) => <StatusBadge value={v} /> },
    ],
  }[config.kind]

  const pfValue = data?.meta?.currentPf ?? 0.91

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="page-title">{config.title}</h2>
            <span className="badge badge-info">Organization</span>
            {data?.isDemo && <span className="badge badge-neutral">Sample preview</span>}
          </div>
          <p className="breadcrumb">Organization / AI Analytics / {config.crumb}</p>
          <p className="text-xs text-surface-500 mt-1">{scopeLabel} · {config.chartDescription}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary px-3" onClick={reload} title="Refresh">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
          <button type="button" className="btn-secondary" onClick={() => exportCsv(`${config.title.toLowerCase().replace(/\s+/g, '-')}.csv`, filteredRows)}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Device</label>
            <select className="select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              {type === 'anomalies' && <option value="">All organization devices</option>}
              {devices.length === 0 && <option value="">No devices — showing sample</option>}
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {type !== 'anomalies' && (
            <div>
              <label className="label">Period</label>
              <select className="select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                {Object.entries(RANGE_LABELS).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Search</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records..." />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={reload}>Load</button>
            <button type="button" className="btn-secondary" onClick={() => { setSearch(''); setTimeRange('7d'); }}><RotateCcw size={14} /> Reset</button>
          </div>
        </div>
      </div>

      {/* Always show full CF layout */}
      <div className={`space-y-6 ${loading ? 'opacity-70' : ''}`}>
        {type === 'powerFactor' && <Gauge value={pfValue} scope={scopeLabel} />}

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-800 mb-1">{config.chartTitle} — {scopeLabel}</h3>
              <p className="text-xs text-surface-500">{config.chartDescription}</p>
            </div>
            {type !== 'anomalies' && <span className="badge badge-neutral">{RANGE_LABELS[timeRange]}</span>}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            {type === 'anomalies' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="active" fill="#EF4444" name="Active" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" fill="#22C55E" name="Resolved" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : type === 'current' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="currentA" fill="#F5A623" name="Phase A" radius={[2, 2, 0, 0]} />
                <Bar dataKey="currentB" fill="#3B82F6" name="Phase B" radius={[2, 2, 0, 0]} />
                <Bar dataKey="currentC" fill="#EF4444" name="Phase C" radius={[2, 2, 0, 0]} />
              </BarChart>
            ) : type === 'energy' ? (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="orgEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F5A623" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} kW`, 'Active Power']} />
                <Area type="monotone" dataKey="power" stroke="#F5A623" fill="url(#orgEnergyGrad)" strokeWidth={2} name="Power" />
              </AreaChart>
            ) : type === 'powerFactor' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis domain={[0.8, 1]} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip />
                <Line type="monotone" dataKey="pf" stroke="#F5A623" dot={false} strokeWidth={2} name="Power Factor" />
              </LineChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis domain={[210, 240]} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="voltageA" stroke="#F5A623" dot={false} strokeWidth={2} name="Phase A" />
                <Line type="monotone" dataKey="voltageB" stroke="#3B82F6" dot={false} strokeWidth={2} name="Phase B" />
                <Line type="monotone" dataKey="voltageC" stroke="#EF4444" dot={false} strokeWidth={2} name="Phase C" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${type === 'energy' ? 'xl:grid-cols-6' : 'xl:grid-cols-4'} gap-4`}>
          {stats.map(([label, value, color]) => <MetricCard key={label} label={label} value={value} color={color} />)}
        </div>

        {type === 'energy' && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-surface-800 mb-1">Daily Consumption</h3>
            <p className="text-xs text-surface-500 mb-4">Energy consumed per interval (kWh)</p>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip formatter={(v) => [`${v} kWh`, 'Consumption']} />
                <Bar dataKey="kWh" fill="#F5A623" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-2">
              <AlertTriangle size={14} className="text-primary-600" /> {config.tableTitle}
            </h3>
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            pageSize={7}
            searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
            emptyMessage="No records found"
            actions={(row) => (
              <button type="button" className="btn-ghost p-1.5 rounded" title="View details" onClick={() => setDetail(row)}><Eye size={14} /></button>
            )}
          />
        </div>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${config.title} Details`} size="lg">
        {detail && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              {detail.severity && <SeverityBadge value={detail.severity} />}
              {detail.status && <StatusBadge value={detail.status} />}
            </div>
            {Object.entries(detail)
              .filter(([key]) => !['id', '_raw', 'deviceId', 'imbalanceValue'].includes(key))
              .map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm gap-4">
                  <span className="text-surface-400 capitalize flex-shrink-0">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-surface-900 font-medium text-right">{String(value)}</span>
                </div>
              ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
