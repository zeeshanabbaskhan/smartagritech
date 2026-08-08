import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Gauge, Activity, Zap, PieChart, Package,
  Waves, TrendingUp, TrendingDown, Minus, Download, Loader2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { resolvePresetRange, toYmd } from '../../components/ui/DataCenterFilterBar'
import PageState, { ChartEmpty, useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { downloadCsv } from '../../utils/csv'
import { latestToReadings } from '../../utils/sensorReadings'

const READOUT_DEFS = [
  { key: 'VoltageA',      label: 'Voltage A',        unit: 'V' },
  { key: 'VoltageB',      label: 'Voltage B',        unit: 'V' },
  { key: 'VoltageC',      label: 'Voltage C',        unit: 'V' },
  { key: 'PhaseVoltageA', label: 'Phase Voltage A',  unit: 'V' },
  { key: 'PhaseVoltageB', label: 'Phase Voltage B',  unit: 'V' },
  { key: 'PhaseVoltageC', label: 'Phase Voltage C',  unit: 'V' },
  { key: 'CurrentA',      label: 'Current A',        unit: 'A' },
  { key: 'CurrentB',      label: 'Current B',        unit: 'A' },
  { key: 'CurrentC',      label: 'Current C',        unit: 'A' },
  { key: 'ActivePower',   label: 'Operating Power',  unit: 'kW' },
  { key: 'ReactivePower', label: 'Reactive Power',   unit: 'kVar' },
  { key: 'ApparentPower', label: 'Apparent Power',   unit: 'kVA' },
  { key: 'PowerConsumption', label: 'Units (kWh)',   unit: 'kWh' },
  { key: 'ExportPower',   label: 'Export Power',     unit: 'kWh' },
  { key: 'PowerFactor',   label: 'Power Factor',     unit: '', icon: PieChart },
  { key: 'Frequency',     label: 'Frequency',        unit: 'Hz' },
  { key: 'Temperature',   label: 'Temperature',      unit: '°C' },
  { key: 'THDUa',         label: 'THD Ua',           unit: '%' },
  { key: 'THDUb',         label: 'THD Ub',           unit: '%' },
  { key: 'THDUc',         label: 'THD Uc',           unit: '%' },
  { key: 'THDIa',         label: 'THD Ia',           unit: '%' },
  { key: 'THDIb',         label: 'THD Ib',           unit: '%' },
  { key: 'THDIc',         label: 'THD Ic',           unit: '%' },
  { key: 'TotalCost',     label: 'Total cost',       unit: 'PKR', icon: Package },
]

const defaultRange = resolvePresetRange('last7') || {
  from: toYmd(new Date(Date.now() - 6 * 86400000)),
  to: toYmd(new Date()),
}

function readoutIcon(row) {
  if (row.icon) return row.icon
  if (row.key.startsWith('Voltage') || row.key.startsWith('PhaseVoltage')) return AlertTriangle
  if (row.key.startsWith('Current')) return Gauge
  if (row.key.includes('Power') || row.key === 'PowerConsumption') return Activity
  if (row.key.startsWith('THD')) return Waves
  if (row.key === 'Frequency') return Zap
  if (row.key === 'Temperature') return Gauge
  return Activity
}

function findReading(readings, key) {
  const aliases = [key, key.toLowerCase(), key.replace(/([a-z])([A-Z])/g, '$1 $2')]
  return readings.find((r) => aliases.some((a) => {
    const name = String(r.variableName || '')
    return name.toLowerCase() === String(a).toLowerCase()
      || name.replace(/\s+/g, '').toLowerCase() === key.toLowerCase()
  }))
}

function fmtNum(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function formatChartTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function daysBetween(from, to) {
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 7
  return Math.max(0, Math.round((b - a) / 86400000))
}

/** Prefer bucketed aggregates for longer ranges; fall back to raw history. */
function rangeToTimeRange(from, to) {
  const days = daysBetween(from, to)
  if (days <= 1) return '24h'
  if (days <= 7) return '7d'
  return '30d'
}

function mapSeriesPoints(points = []) {
  return [...points]
    .map((p) => {
      const ts = p.timestamp ?? p.receivedTime ?? p.time
      const t = new Date(ts).getTime()
      if (Number.isNaN(t)) return null
      return {
        t,
        time: formatChartTime(ts),
        value: Number(p.value ?? p.v ?? 0),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t)
}

function emptyReadouts() {
  return READOUT_DEFS.map((d) => ({ ...d, value: '—', apiName: d.key }))
}

function emptySavings() {
  return [
    { label: 'Daily', pct: 0, sub: 'No energy data', trend: 'flat' },
    { label: 'Weekly', pct: 0, sub: 'No energy data', trend: 'flat' },
    { label: 'Monthly', pct: 0, sub: 'No energy data', trend: 'flat' },
  ]
}

export default function UserDashboardDetail() {
  const { selectedDeviceId, selectedSlaveId, slaves, loading: devicesLoading } = useDevices()
  const { showToast } = useToast()

  const [selectedKey, setSelectedKey] = useState('VoltageA')
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const chartGenRef = useRef(0)

  // Wait until device+slave selection settles (avoids new-device + old-slave races).
  const filtersReady = Boolean(
    selectedDeviceId
    && (selectedSlaveId || (!devicesLoading && slaves.length === 0)),
  )

  const { data, loading, error, reload } = useFetch(async () => {
    if (!selectedDeviceId) {
      return { readouts: emptyReadouts(), savings: emptySavings() }
    }
    // Soft-skip until slave selection settles after a device change.
    if (!filtersReady) return undefined
    const q = {
      deviceId: selectedDeviceId,
      slaveId: selectedSlaveId || undefined,
      timeRange: '24h',
    }
    const [latestRes, summaryRes, energyRes] = await Promise.all([
      emsApi.getLatestReadings(q).catch(() => null),
      emsApi.getDashboardSummary(q).catch(() => null),
      emsApi.getAiEnergy(q).catch(() => null),
    ])
    const readings = latestToReadings(latestRes)
    const readouts = READOUT_DEFS.map((def) => {
      const hit = findReading(readings, def.key)
      let value = hit?.value
      if (value == null && def.key === 'PowerConsumption') {
        value = summaryRes?.data?.totalPowerConsumption?.value ?? energyRes?.data?.totalConsumption
      }
      if (value == null && def.key === 'ExportPower') {
        value = summaryRes?.data?.totalExportPower?.value ?? energyRes?.data?.totalExport
      }
      if (value == null && def.key === 'PowerFactor') value = summaryRes?.data?.powerFactor?.value
      if (value == null && def.key === 'Frequency') value = summaryRes?.data?.frequency?.value
      if (value == null && def.key === 'ActivePower') value = summaryRes?.data?.totalActivePower?.value
      return {
        ...def,
        value: fmtNum(value),
        unit: hit?.unit || def.unit,
        apiName: hit?.variableName || def.key,
      }
    })

    // Prefer dashboard-summary energySavingsComparison (authoritative).
    const esc = summaryRes?.data?.energySavingsComparison || {}
    const daily = esc.daily ?? energyRes?.data?.dailyComparison
    const weekly = esc.weekly ?? energyRes?.data?.weeklyComparison
    const monthly = esc.monthly ?? energyRes?.data?.monthlyComparison
    const fmtKwh = (n) => {
      const v = Number(n) || 0
      return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
    const toSaving = (label, block) => {
      if (!block) return { label, pct: 0, sub: 'No energy data', trend: 'flat' }
      const pct = Number(block.percentage ?? block.percentChange ?? block.pct ?? 0)
      const cur = Number(block.current ?? block.currentKwh ?? 0)
      const prev = Number(block.previous ?? block.previousKwh ?? 0)
      const empty = cur === 0 && prev === 0
      return {
        label,
        pct: empty ? 0 : pct,
        sub: empty ? 'No energy data' : `${fmtKwh(cur)} vs ${fmtKwh(prev)} kWh`,
        trend: empty ? 'flat' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
      }
    }

    return {
      readouts,
      savings: [
        toSaving('Daily', daily),
        toSaving('Weekly', weekly),
        toSaving('Monthly', monthly),
      ],
    }
  }, [selectedDeviceId, selectedSlaveId, filtersReady])

  const readouts = data?.readouts ?? emptyReadouts()
  const savings = data?.savings?.length ? data.savings : emptySavings()

  const selected = readouts.find((r) => r.key === selectedKey) || readouts[0]
  const selectedApiName = selected?.apiName || selected?.key || 'VoltageA'

  const loadChart = useCallback(async () => {
    const gen = ++chartGenRef.current
    if (!filtersReady || !selectedDeviceId || !selectedApiName) {
      setChartData([])
      return
    }
    if (!dateFrom || !dateTo) {
      setChartError('Select a date range')
      setChartData([])
      return
    }
    setChartLoading(true)
    setChartError(null)
    try {
      const base = {
        deviceId: selectedDeviceId,
        slaveId: selectedSlaveId || undefined,
        variableName: selectedApiName,
      }
      const fromMs = new Date(`${dateFrom}T00:00:00`).getTime()
      const toMs = new Date(`${dateTo}T23:59:59.999`).getTime()

      // Exact date-range history first so custom From/To always drives the chart.
      const histRes = await emsApi.getSensorHistory({
        ...base,
        startDate: dateFrom,
        endDate: `${dateTo}T23:59:59.999`,
        limit: 100,
      }).catch(() => null)
      let points = Array.isArray(histRes?.data) ? histRes.data : list(histRes)
      let series = mapSeriesPoints(points).filter((p) => p.t >= fromMs && p.t <= toMs)

      // Fall back to bucketed aggregates when history is sparse.
      if (!series.length) {
        const timeRange = rangeToTimeRange(dateFrom, dateTo)
        const aggRes = await emsApi.getSensorAggregate({ ...base, timeRange }).catch(() => null)
        points = Array.isArray(aggRes?.data) ? aggRes.data : list(aggRes)
        series = mapSeriesPoints(points).filter((p) => p.t >= fromMs && p.t <= toMs)
      }

      if (gen !== chartGenRef.current) return
      setChartData(series)
    } catch (e) {
      if (gen !== chartGenRef.current) return
      setChartData([])
      setChartError(e.message || 'Failed to load chart')
    } finally {
      if (gen === chartGenRef.current) setChartLoading(false)
    }
  }, [filtersReady, selectedDeviceId, selectedSlaveId, selectedApiName, dateFrom, dateTo])

  useEffect(() => { loadChart() }, [loadChart])

  const downloadParams = () => ({
    deviceId: selectedDeviceId,
    slaveId: selectedSlaveId || undefined,
    startDate: dateFrom || undefined,
    endDate: dateTo ? `${dateTo}T23:59:59.999` : undefined,
  })

  const handleDownloadData = async () => {
    if (!selectedDeviceId) {
      showToast('Select a device first', 'warning')
      return
    }
    setDownloading(true)
    try {
      await emsApi.downloadSensorCsv({
        ...downloadParams(),
        variableName: selectedApiName,
      })
      showToast('Download started', 'success')
    } catch (e) {
      if (chartData.length) {
        downloadCsv(
          `${selectedApiName}_data.csv`,
          ['Time', selectedApiName],
          chartData.map((r) => [r.time, r.value]),
        )
        showToast('Exported chart data', 'success')
      } else {
        showToast(e.message || 'Download failed', 'error')
      }
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadAll = async () => {
    if (!selectedDeviceId) {
      showToast('Select a device first', 'warning')
      return
    }
    setDownloading(true)
    try {
      const vars = readouts.map((r) => r.apiName || r.key)
      const rows = []
      for (const variableName of vars) {
        try {
          const res = await emsApi.getSensorHistory({
            deviceId: selectedDeviceId,
            slaveId: selectedSlaveId || undefined,
            variableName,
            startDate: dateFrom,
            endDate: dateTo ? `${dateTo}T23:59:59.999` : undefined,
            limit: 100,
          })
          const points = Array.isArray(res?.data) ? res.data : list(res)
          for (const p of points) {
            rows.push([
              variableName,
              p.value,
              p.unit || '',
              p.receivedTime ?? p.timestamp ?? '',
            ])
          }
        } catch {
          // skip variables with no history
        }
      }
      if (!rows.length) {
        showToast('No data to download for this range', 'warning')
        return
      }
      downloadCsv('all_sensor_data.csv', ['variableName', 'value', 'unit', 'timestamp'], rows)
      showToast('Download started', 'success')
    } catch (e) {
      showToast(e.message || 'Download failed', 'error')
    } finally {
      setDownloading(false)
    }
  }

  // Keep filters mounted while content reloads (PageState would unmount the selector).
  const contentLoading = loading && !data

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard Detail</h2>
          <p className="breadcrumb">Manage Dashboard / Detail</p>
        </div>
      </div>

      <DeviceSlaveSelector />

      <PageState loading={contentLoading} error={error} onRetry={reload}>
        <div className={`space-y-5 ${loading ? 'opacity-70 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Left: selectable metric cards */}
            <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {readouts.map((row) => {
                const Icon = readoutIcon(row)
                const active = row.key === selected.key
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setSelectedKey(row.key)}
                    className={`card p-4 text-left transition-all duration-150 border-2 ${
                      active
                        ? 'border-info-600 shadow-elevated ring-1 ring-info-600/30'
                        : 'border-transparent hover:border-surface-300 dark:hover:border-surface-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-700 dark:text-surface-300 mb-2">
                      <Icon size={13} className={`flex-shrink-0 ${active ? 'text-info-600' : 'text-primary-600'}`} />
                      <span>{row.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-surface-900 dark:text-surface-100">{row.value}</span>
                      {row.unit ? <span className="text-xs font-semibold text-surface-400">{row.unit}</span> : null}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Right: selected variable chart panel */}
            <div className="xl:col-span-7 card p-4 sm:p-5 space-y-4 min-h-[28rem]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">
                    {selected?.label || 'Select a variable'}
                  </h3>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {selected?.value ?? '—'}{selected?.unit ? ` ${selected.unit}` : ''} · live reading
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="label" htmlFor="detail-date-from">From</label>
                    <input
                      id="detail-date-from"
                      type="date"
                      className="input py-1.5 text-xs w-[9.5rem]"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="detail-date-to">To</label>
                    <input
                      id="detail-date-to"
                      type="date"
                      className="input py-1.5 text-xs w-[9.5rem]"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={handleDownloadAll}
                    disabled={downloading || !selectedDeviceId}
                  >
                    <Download size={13} /> Download All
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={handleDownloadData}
                    disabled={downloading || !selectedDeviceId}
                  >
                    <Download size={13} /> Download Data
                  </button>
                </div>
              </div>

              {chartError ? (
                <div className="text-xs text-danger-600 py-2">{chartError}</div>
              ) : null}

              <div className="relative">
                {chartLoading ? (
                  <div className="flex flex-col items-center justify-center h-72 text-surface-500">
                    <Loader2 className="animate-spin mb-2" size={24} />
                    <p className="text-xs">Loading {selected?.label}…</p>
                  </div>
                ) : chartData.length === 0 ? (
                  <ChartEmpty height={288} message={`No history for ${selected?.label || 'this variable'} in the selected range`} />
                ) : (
                  <ResponsiveContainer width="100%" height={288}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="detailVarFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.35} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#4B5563" minTickGap={28} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#9AA09A' }}
                        stroke="#4B5563"
                        width={48}
                        unit={selected?.unit ? ` ${selected.unit}` : undefined}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#141828',
                          border: '1px solid #374151',
                          borderRadius: 8,
                          fontSize: 12,
                          color: '#FEFEF8',
                        }}
                        formatter={(v) => [`${fmtNum(v)}${selected?.unit ? ` ${selected.unit}` : ''}`, selected?.label]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name={selected?.label}
                        stroke="#2563EB"
                        strokeWidth={2}
                        fill="url(#detailVarFill)"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-3">Energy Savings Comparison</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {savings.map((s) => {
                const TrendIcon = s.trend === 'up' ? TrendingUp : s.trend === 'down' ? TrendingDown : Minus
                const barColor  = s.trend === 'up' ? 'bg-success-600' : s.trend === 'down' ? 'bg-danger-600' : 'bg-surface-300'
                const textColor = s.trend === 'up' ? 'text-success-600' : s.trend === 'down' ? 'text-danger-600' : 'text-surface-400'
                const bg        = s.trend === 'up' ? 'bg-success-100/50 text-success-700' : s.trend === 'down' ? 'bg-danger-100/50 text-danger-700' : 'bg-surface-100 text-surface-500'
                return (
                  <div key={s.label} className="card p-4 text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 right-0 h-1 ${barColor}`} />
                    <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center mb-2 ${bg}`}>
                      <TrendIcon size={15} />
                    </div>
                    <p className="text-xs text-surface-400 font-semibold">{s.label}</p>
                    <p className={`text-lg font-bold mt-1 ${textColor}`}>{s.pct > 0 ? '+' : ''}{Number(s.pct).toFixed(1)}%</p>
                    <p className="text-[10px] text-surface-400 mt-1">{s.sub}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </PageState>
    </div>
  )
}
