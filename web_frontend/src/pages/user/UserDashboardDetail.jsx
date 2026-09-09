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
import { onSocketEvent, subscribeDevice } from '../../services/socketService'

/** Known metrics: labels/order applied when the selected slave's latest payload matches aliases. */
const READOUT_DEFS = [
  {
    key: 'VoltageA',
    label: 'Voltage A',
    unit: 'V',
    aliases: ['Voltage', 'Phase VoltageA', 'Phase Voltage A', 'PhaseVoltageA', 'VoltageA', 'Voltage A', 'Va', 'V1', 'Line Voltage', 'Phase Voltage', 'Voltage R'],
  },
  {
    key: 'VoltageB',
    label: 'Voltage B',
    unit: 'V',
    aliases: ['VoltageB', 'Voltage B', 'Phase VoltageB', 'Phase Voltage B', 'PhaseVoltageB', 'Vb', 'V2', 'Voltage Y'],
  },
  {
    key: 'VoltageC',
    label: 'Voltage C',
    unit: 'V',
    aliases: ['VoltageC', 'Voltage C', 'Phase VoltageC', 'Phase Voltage C', 'PhaseVoltageC', 'Vc', 'V3', 'Voltage B'],
  },
  {
    key: 'CurrentA',
    label: 'Current A',
    unit: 'A',
    aliases: ['Current A', 'CurrentA', 'Current', 'PhaseCurrentA', 'Phase Current A', 'Total Current', 'Ia', 'I1', 'Current R'],
  },
  {
    key: 'CurrentB',
    label: 'Current B',
    unit: 'A',
    aliases: ['Current B', 'CurrentB', 'PhaseCurrentB', 'Phase Current B', 'Ib', 'I2', 'Current Y'],
  },
  {
    key: 'CurrentC',
    label: 'Current C',
    unit: 'A',
    aliases: ['Current C', 'CurrentC', 'PhaseCurrentC', 'Phase Current C', 'Ic', 'I3', 'Current B'],
  },
  {
    key: 'ActivePower',
    label: 'Operating Power',
    unit: 'kW',
    aliases: ['Active Power', 'Total Power', 'ActivePower', 'Operating Power', 'OperatingPower', 'Power', 'Total Active Power', 'Active Power (kW)', 'Total Active Power(kW)', 'Active Power A', 'ActivePowerA'],
  },
  {
    key: 'ReactivePower',
    label: 'Reactive Power',
    unit: 'kVar',
    aliases: ['Reactive Power', 'ReactivePower', 'kVar', 'Reactive Power A', 'Total Reactive Power', 'Reactive Power(kVar)'],
  },
  {
    key: 'ApparentPower',
    label: 'Apparent Power',
    unit: 'kVA',
    aliases: ['Apparent Power', 'ApparentPower', 'kVA', 'Apparent Power A', 'Total Apparent Power', 'Apparent Power(kVA)'],
  },
  {
    key: 'PowerConsumption',
    label: 'Units (kWh)',
    unit: 'kWh',
    aliases: ['Active Energy', 'PowerConsumption', 'Energy', 'Units', 'kWh', 'Total Energy', 'Active Energy(kWh)', 'Active Energy (kWh)', 'Power Consumption'],
  },
  {
    key: 'ExportPower',
    label: 'Export Power',
    unit: 'kWh',
    aliases: ['Export Power', 'ExportPower', 'SolarPower', 'Solar', 'Export'],
  },
  {
    key: 'PowerFactor',
    label: 'Power Factor',
    unit: '',
    icon: PieChart,
    aliases: ['Power Factor', 'PowerFactor', 'PF', 'pf', 'Avg PF', 'Power Factor Avg', 'Power Factor A'],
  },
  {
    key: 'Frequency',
    label: 'Frequency',
    unit: 'Hz',
    aliases: ['Frequency', 'Freq', 'Hz'],
  },
  {
    key: 'Temperature',
    label: 'Temperature',
    unit: '°C',
    aliases: ['Temperature', 'Temp', 'Ambient Temperature', 'Module Temperature'],
  },
  {
    key: 'THDUa',
    label: 'THD Ua',
    unit: '%',
    aliases: ['THD Ua', 'THDUa', 'THD_V', 'THD-V', 'THDV', 'THD Voltage', 'THD V', 'THD Va'],
  },
  {
    key: 'THDUb',
    label: 'THD Ub',
    unit: '%',
    aliases: ['THD Ub', 'THDUb', 'THD Vb'],
  },
  {
    key: 'THDUc',
    label: 'THD Uc',
    unit: '%',
    aliases: ['THD Uc', 'THDUc', 'THD Vc'],
  },
  {
    key: 'THDIa',
    label: 'THD Ia',
    unit: '%',
    aliases: ['THD Ia', 'THDIa', 'THD_I', 'THD-I', 'THDI', 'THD Current', 'THD I', 'THD Ia'],
  },
  {
    key: 'THDIb',
    label: 'THD Ib',
    unit: '%',
    aliases: ['THD Ib', 'THDIb', 'THD Ib'],
  },
  {
    key: 'THDIc',
    label: 'THD Ic',
    unit: '%',
    aliases: ['THD Ic', 'THDIc', 'THD Ic'],
  },
  {
    key: 'TotalCost',
    label: 'Total cost',
    unit: 'PKR',
    icon: Package,
    aliases: ['Total cost', 'TotalCost', 'Cost', 'PKR', 'Electricity Cost'],
  },
]

/**
 * Reference spreadsheet columns (wide format). Prefer these headers when the
 * selected slave actually has a matching variable; otherwise omit / use extras.
 */
const EXPORT_REF_COLS = [
  { match: ['Voltage', 'VoltageA', 'Phase VoltageA', 'Phase Voltage A', 'PhaseVoltageA', 'Voltage A', 'Va'], header: 'Voltage A' },
  { match: ['VoltageB', 'Voltage B', 'Phase VoltageB', 'Phase Voltage B', 'PhaseVoltageB', 'Vb'], header: 'Voltage B' },
  { match: ['VoltageC', 'Voltage C', 'Phase VoltageC', 'Phase Voltage C', 'PhaseVoltageC', 'Vc'], header: 'Voltage C' },
  { match: ['Current A', 'CurrentA', 'Current', 'PhaseCurrentA', 'Ia'], header: 'Current A' },
  { match: ['Current B', 'CurrentB', 'PhaseCurrentB', 'Ib'], header: 'Current B' },
  { match: ['Current C', 'CurrentC', 'PhaseCurrentC', 'Ic'], header: 'Current C' },
  { match: ['Active Power', 'Total Power', 'ActivePower', 'Operating Power', 'Operating', 'Power'], header: 'Operating Power' },
  { match: ['Reactive Power', 'ReactivePower', 'kVar'], header: 'Reactive Power' },
  { match: ['Apparent Power', 'ApparentPower', 'kVA'], header: 'Apparent Power' },
  { match: ['Power Factor', 'PowerFactor', 'PF'], header: 'Power Factor' },
  { match: ['Frequency', 'Freq', 'Hz'], header: 'Frequency' },
  { match: ['Active Energy', 'PowerConsumption', 'Energy', 'Units', 'kWh'], header: 'Units' },
  { match: ['Export Power', 'ExportPower', 'Solar'], header: 'Export Power' },
  { match: ['Temperature', 'Temp'], header: 'Temperature' },
]

const defaultRange = resolvePresetRange('last7') || {
  from: toYmd(new Date(Date.now() - 6 * 86400000)),
  to: toYmd(new Date()),
}

function readoutIcon(row) {
  if (row.icon) return row.icon
  const key = String(row.key || row.apiName || '')
  if (/powerfactor/i.test(key)) return PieChart
  if (/cost|price|pkr/i.test(key)) return Package
  if (/voltage|phase/i.test(key)) return AlertTriangle
  if (/current|amp/i.test(key)) return Gauge
  if (/thd/i.test(key)) return Waves
  if (/freq/i.test(key)) return Zap
  if (/temp/i.test(key)) return Gauge
  if (/power|energy|kwh|export|consump/i.test(key)) return Activity
  return Activity
}

function normName(s) {
  return String(s || '').replace(/[\s_\-()]+/g, '').toLowerCase()
}

function findReading(readings, def) {
  if (!def) return null
  const aliases = def.aliases || [def.key]
  const aliasNorms = aliases.map(normName)
  for (const r of readings) {
    const vn = String(r.variableName || '')
    const vnNorm = normName(vn)
    if (aliasNorms.includes(vnNorm)) {
      return r
    }
  }
  return null
}

function isRegisterVar(name) {
  return /^R\d/i.test(String(name || ''))
}

function fmtNum(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/**
 * Cards from variables present on the selected slave’s latest payload only.
 * READOUT_DEFS supply labels/order for known metrics when a hit exists.
 * Other named (non-R*) vars are appended; if only R* vars exist, show those.
 */
function buildReadoutsFromLatest(readings) {
  const used = new Set()
  const known = []

  for (const def of READOUT_DEFS) {
    const hit = findReading(readings, def)
    if (!hit) continue
    const hitNorm = normName(hit.variableName)
    if (used.has(hitNorm)) continue
    used.add(hitNorm)
    used.add(normName(def.key))
    if (def.aliases) {
      def.aliases.forEach((a) => used.add(normName(a)))
    }
    known.push({
      key: hit.variableName || def.key,
      label: def.label,
      unit: hit.unit || def.unit || '',
      value: fmtNum(hit.value),
      apiName: hit.variableName || def.key,
      icon: def.icon,
    })
  }

  const extras = []
  const registers = []
  for (const r of readings) {
    const name = r.variableName
    if (!name) continue
    const n = normName(name)
    if (used.has(n)) continue
    used.add(n)
    const row = {
      key: name,
      label: name,
      unit: r.unit || '',
      value: fmtNum(r.value),
      apiName: name,
    }
    if (isRegisterVar(name)) registers.push(row)
    else extras.push(row)
  }

  if (known.length || extras.length) return [...known, ...extras]
  return registers
}

function formatChartTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Excel-friendly local datetime for wide CSV exports.
 * Uses YYYY-MM-DD HH:mm:ss (no ISO T/Z). Wrapped as an Excel text formula so
 * Excel keeps the literal string instead of a date serial (########).
 */
function formatExportTime(ts) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts ?? '')
  const pad = (n) => String(n).padStart(2, '0')
  const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `="${formatted}"`
}

function matchesExportKey(name, matchKeys) {
  const n = normName(name)
  return matchKeys.some((k) => normName(k) === n)
}

/**
 * Column plan for wide export: reference headers for vars present on the slave,
 * then any remaining slave vars (by readout order). Never invent missing metrics.
 */
function buildExportColumns(readouts) {
  const used = new Set()
  const cols = []

  for (const ref of EXPORT_REF_COLS) {
    const hit = readouts.find((r) => (
      matchesExportKey(r.apiName || r.key, ref.match)
      || matchesExportKey(r.key, ref.match)
    ))
    if (!hit) continue
    const apiName = hit.apiName || hit.key
    used.add(normName(apiName))
    used.add(normName(hit.key))
    cols.push({ header: ref.header, apiName })
  }

  for (const r of readouts) {
    const apiName = r.apiName || r.key
    if (!apiName) continue
    if (used.has(normName(apiName)) || used.has(normName(r.key))) continue
    used.add(normName(apiName))
    cols.push({ header: r.label || apiName, apiName })
  }

  return cols
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

/** True when series spans a meaningful portion of the requested FROM–TO window. */
function seriesCoversRange(series, fromMs, toMs) {
  if (!series.length) return false
  const span = toMs - fromMs
  if (span <= 0) return true
  // Single-day / short windows: any in-range points are fine.
  if (span <= 36 * 3600_000) return true
  const covered = series[series.length - 1].t - series[0].t
  return covered >= span * 0.4
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

/** Page through history for a date-bounded export (avoids “latest N minutes only”). */
async function fetchHistoryForRange({ deviceId, slaveId, variableName, startDate, endDate }) {
  const BATCH = 2000
  const MAX_FETCHED = 50_000
  const points = []
  let skip = 0
  while (skip < MAX_FETCHED) {
    const res = await emsApi.getSensorHistory({
      deviceId,
      slaveId,
      variableName,
      startDate,
      endDate,
      limit: BATCH,
      skip,
    })
    const batch = Array.isArray(res?.data) ? res.data : list(res)
    const fetched = Number(res?.fetched)
    points.push(...batch)
    if (!Number.isFinite(fetched) || fetched <= 0) break
    skip += fetched
    if (fetched < BATCH) break
  }
  return points
}

const EMPTY_READOUTS = []

function emptySavings() {
  return [
    { label: 'Daily', pct: 0, sub: 'No energy data', trend: 'flat' },
    { label: 'Weekly', pct: 0, sub: 'No energy data', trend: 'flat' },
    { label: 'Monthly', pct: 0, sub: 'No energy data', trend: 'flat' },
  ]
}

export default function UserDashboardDetail() {
  const { selectedDeviceId, selectedSlaveId, slaves, selectedDevice, loading: devicesLoading } = useDevices()
  const { showToast } = useToast()

  const [selectedKey, setSelectedKey] = useState(null)
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const chartGenRef = useRef(0)

  // Wait until device+slave selection settles
  const filtersReady = Boolean(
    selectedDeviceId
    && (selectedSlaveId || (!devicesLoading && slaves.length === 0)),
  )
  const selectionKey = `${selectedDeviceId || ''}:${selectedSlaveId || ''}`

  // Clear chart + selection on device/slave change
  useEffect(() => {
    setChartData([])
    setChartError(null)
    setSelectedKey(null)
  }, [selectedDeviceId, selectedSlaveId])

  const { data, loading, error, reload } = useFetch(async () => {
    if (!selectedDeviceId) {
      return {
        readouts: [],
        savings: emptySavings(),
        hasVariables: false,
        hasLiveData: false,
      }
    }
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
    const readouts = buildReadoutsFromLatest(readings)

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

    const hasVariables = readouts.length > 0
    const hasLiveData = readouts.some((r) => r.value !== '—')

    return {
      readouts,
      savings: [
        toSaving('Daily', daily),
        toSaving('Weekly', weekly),
        toSaving('Monthly', monthly),
      ],
      hasVariables,
      hasLiveData,
    }
  }, [selectedDeviceId, selectedSlaveId, filtersReady])

  // Real-time device room subscription
  useEffect(() => {
    if (selectedDeviceId) {
      subscribeDevice(selectedDeviceId)
    }
  }, [selectedDeviceId])

  // Live telemetry streaming on socket event
  useEffect(() => {
    const unsub = onSocketEvent((event, payload) => {
      if (event === 'reading:new' && payload?.deviceId === selectedDeviceId) {
        reload({ silent: true })
      }
    })
    return () => unsub?.()
  }, [selectedDeviceId, reload])

  // 10s auto-refresh fallback
  useEffect(() => {
    if (!selectedDeviceId) return
    const interval = setInterval(() => {
      reload({ silent: true })
    }, 10000)
    return () => clearInterval(interval)
  }, [selectedDeviceId, reload])

  const readouts = data?.readouts ?? EMPTY_READOUTS
  const savings = data?.savings?.length ? data.savings : emptySavings()
  const hasVariables = Boolean(data?.hasVariables)
  const hasLiveData = Boolean(data?.hasLiveData)
  const isEmpty = !loading && (!hasVariables || !hasLiveData)

  // Set selected key when readouts change
  useEffect(() => {
    if (!data?.readouts?.length) {
      setSelectedKey(null)
      return
    }
    const rows = data.readouts
    setSelectedKey((prev) => {
      if (prev && rows.some((r) => r.key === prev)) return prev
      return rows[0].key
    })
  }, [selectionKey, data])

  const selected = readouts.find((r) => r.key === selectedKey) || readouts[0] || null
  const selectedApiName = selected?.apiName || selected?.key || null

  const loadChart = useCallback(async () => {
    const gen = ++chartGenRef.current
    if (!filtersReady || !selectedDeviceId || !selectedApiName || !hasVariables) {
      setChartData([])
      setChartLoading(false)
      return
    }
    if (!dateFrom || !dateTo) {
      setChartError('Select a date range')
      setChartData([])
      setChartLoading(false)
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
      const endDate = `${dateTo}T23:59:59.999`

      // 1) Exact FROM–TO bucketed aggregate
      const aggRes = await emsApi.getSensorAggregate({
        ...base,
        startDate: dateFrom,
        endDate,
      }).catch(() => null)
      let points = Array.isArray(aggRes?.data) ? aggRes.data : list(aggRes)
      let series = mapSeriesPoints(points).filter((p) => p.t >= fromMs && p.t <= toMs)

      // 2) Raw history across the same bounds when aggregate is empty
      if (!series.length) {
        const histRes = await emsApi.getSensorHistory({
          ...base,
          startDate: dateFrom,
          endDate,
          limit: 5000,
        }).catch(() => null)
        points = Array.isArray(histRes?.data) ? histRes.data : list(histRes)
        series = mapSeriesPoints(points).filter((p) => p.t >= fromMs && p.t <= toMs)
      }

      // 3) Named timeRange aggregate if history still only covers a sliver / is empty
      if (!series.length || !seriesCoversRange(series, fromMs, toMs)) {
        const timeRange = rangeToTimeRange(dateFrom, dateTo)
        const namedRes = await emsApi.getSensorAggregate({ ...base, timeRange }).catch(() => null)
        points = Array.isArray(namedRes?.data) ? namedRes.data : list(namedRes)
        const namedSeries = mapSeriesPoints(points).filter((p) => p.t >= fromMs && p.t <= toMs)
        if (namedSeries.length && (
          !series.length
          || seriesCoversRange(namedSeries, fromMs, toMs)
        )) {
          series = namedSeries
        }
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
  }, [filtersReady, selectedDeviceId, selectedSlaveId, selectedApiName, dateFrom, dateTo, hasVariables])

  useEffect(() => { loadChart() }, [loadChart])

  const downloadParams = () => ({
    deviceId: selectedDeviceId,
    slaveId: selectedSlaveId || undefined,
    startDate: dateFrom || undefined,
    endDate: dateTo ? `${dateTo}T23:59:59.999` : undefined,
  })

  const runWideDownload = async (cols, mode, filenameSuffix) => {
    if (!selectedDeviceId) {
      showToast('Select a device first', 'warning')
      return
    }
    if (!cols.length) {
      showToast('No variables to download', 'warning')
      return
    }
    if (!dateFrom || !dateTo) {
      showToast('Select a date range', 'warning')
      return
    }

    const deviceName = selectedDevice?.name || selectedDevice?.deviceName || selectedDeviceId
    const slave = slaves.find((s) => String(s.id) === String(selectedSlaveId))
    const slaveName = slave?.name ?? slave?.slaveName ?? (selectedSlaveId || '')

    setDownloading(mode)
    try {
      const params = downloadParams()
      const byTime = new Map()

      await Promise.all(cols.map(async ({ apiName }) => {
        try {
          const points = await fetchHistoryForRange({
            deviceId: params.deviceId,
            slaveId: params.slaveId,
            variableName: apiName,
            startDate: params.startDate,
            endDate: params.endDate,
          })
          for (const p of points) {
            const raw = p.receivedTime ?? p.timestamp
            const t = new Date(raw).getTime()
            if (Number.isNaN(t)) continue
            if (!byTime.has(t)) {
              byTime.set(t, {
                receivedTime: formatExportTime(raw),
                values: {},
              })
            }
            const v = p.value
            byTime.get(t).values[apiName] = v == null ? '' : v
          }
        } catch {
          // Skip variables with no history for this range
        }
      }))

      if (!byTime.size) {
        showToast('No data to download for this range', 'warning')
        return
      }

      const header = ['Device Name', 'Slave Name', 'Received Time', ...cols.map((c) => c.header)]
      const rows = Array.from(byTime.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, row]) => [
          deviceName,
          slaveName,
          row.receivedTime,
          ...cols.map((c) => row.values[c.apiName] ?? ''),
        ])

      const safeDevice = String(deviceName).replace(/[^\w.-]+/g, '_') || 'device'
      downloadCsv(`${safeDevice}_${filenameSuffix}.csv`, header, rows)
      showToast('Download started', 'success')
    } catch (e) {
      showToast(e.message || 'Download failed', 'error')
    } finally {
      setDownloading(null)
    }
  }

  const handleDownloadAll = () => {
    if (!readouts.length) {
      showToast('No variables for this slave', 'warning')
      return
    }
    const cols = buildExportColumns(readouts)
    return runWideDownload(cols, 'all', 'sensor_data_all')
  }

  const handleDownloadData = () => {
    if (!selected) {
      showToast('No variable selected', 'warning')
      return
    }
    const apiName = selected.apiName || selected.key
    if (!apiName) {
      showToast('No variable to download', 'warning')
      return
    }
    const planned = buildExportColumns(readouts).find((c) =>
      normName(c.apiName) === normName(apiName) || normName(c.apiName) === normName(selected.key),
    )
    const col = planned || { header: selected.label || apiName, apiName }
    return runWideDownload([col], 'data', 'sensor_data')
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard Detail</h2>
          <p className="breadcrumb">Manage Dashboard / Detail</p>
        </div>
      </div>

      <DeviceSlaveSelector />

      <PageState loading={loading && !data} error={error} onRetry={reload}>
        <div className="space-y-5 min-h-[28rem]">
          {isEmpty ? (
            <div className="card px-4 py-8 flex flex-col items-center justify-center gap-2 border border-surface-200 dark:border-surface-700 bg-surface-100/60 dark:bg-surface-800/40 text-center">
              <AlertTriangle size={20} className="text-danger-600" />
              <p className="text-sm font-semibold text-danger-600">Data is empty</p>
              <p className="text-xs text-surface-500">
                {!hasVariables
                  ? 'No variables configured for this device / slave.'
                  : 'No live readings for this device / slave.'}
              </p>
            </div>
          ) : null}

          {hasVariables ? (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                {/* Left: selectable metric cards */}
                <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {readouts.map((row) => {
                    const Icon = readoutIcon(row)
                    const active = selected && row.key === selected.key
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
                        disabled={Boolean(downloading) || !selectedDeviceId || !readouts.length}
                      >
                        {downloading === 'all'
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Download size={13} />}
                        Download All
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        onClick={handleDownloadData}
                        disabled={Boolean(downloading) || !selectedDeviceId || !selectedApiName}
                      >
                        {downloading === 'data'
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Download size={13} />}
                        Download Data
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
            </>
          ) : null}
        </div>
      </PageState>
    </div>
  )
}
