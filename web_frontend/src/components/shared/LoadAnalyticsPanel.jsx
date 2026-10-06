import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  Calendar,
  Download,
  Zap,
  TrendingUp,
  Activity,
  ChevronLeft,
  Layers,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import emsApi from '../../api/emsApi'
import { powerReadingToKw } from '../../utils/deviceMetrics'

const ORG_TIMEZONE = 'Asia/Karachi'
const ORG_OFFSET_HOURS = 5 // Pakistan is UTC+5

function pad(n) {
  return String(n).padStart(2, '0')
}

function toYmd(d) {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getOrgNow() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const ymd = formatter.format(now)
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Returns ISO strings for the exact start and end of the Pakistan day range in UTC.
 * Ensures identical results regardless of browser/laptop timezone.
 */
function getDayBoundsUtc(dateFromStr, dateToStr) {
  if (!dateFromStr || !dateToStr) return { startDate: dateFromStr, endDate: dateToStr }
  const [y1, m1, d1] = dateFromStr.split('-').map(Number)
  const [y2, m2, d2] = dateToStr.split('-').map(Number)
  // PKT is UTC+5 -> 00:00:00 PKT is 19:00:00 UTC of previous day (0 - 5 = -5)
  const startUtc = new Date(Date.UTC(y1, m1 - 1, d1, 0 - ORG_OFFSET_HOURS, 0, 0, 0))
  // PKT is UTC+5 -> 23:59:59.999 PKT is 18:59:59.999 UTC of same day (23 - 5 = 18)
  const endUtc = new Date(Date.UTC(y2, m2 - 1, d2, 23 - ORG_OFFSET_HOURS, 59, 59, 999))
  return { startDate: startUtc.toISOString(), endDate: endUtc.toISOString() }
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisWeek', label: 'This Week' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'lastMonth', label: 'Previous Month' },
]

function getPresetRange(presetId) {
  const today = getOrgNow()
  switch (presetId) {
    case 'today':
      return { from: toYmd(today), to: toYmd(today) }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { from: toYmd(y), to: toYmd(y) }
    }
    case 'thisWeek': {
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
      const monday = new Date(today.getFullYear(), today.getMonth(), diff)
      return { from: toYmd(monday), to: toYmd(today) }
    }
    case 'last7':
      return { from: toYmd(addDays(today, -6)), to: toYmd(today) }
    case 'thisMonth':
      return { from: toYmd(new Date(today.getFullYear(), today.getMonth(), 1)), to: toYmd(today) }
    case 'last30':
      return { from: toYmd(addDays(today, -29)), to: toYmd(today) }
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toYmd(first), to: toYmd(last) }
    }
    default:
      return { from: toYmd(addDays(today, -6)), to: toYmd(today) }
  }
}

function formatChartTime(isoString, isMultiDay) {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return ''
  if (isMultiDay) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: ORG_TIMEZONE,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

function formatTooltipDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d)
}

/**
 * Reusable, High-Performance Load & Historical Analytics View
 * @param {'group' | 'slave'} mode
 * @param {object} group - group object (when mode === 'group')
 * @param {object} slave - slave details object { slaveId, slaveName, deviceId, deviceName } (when mode === 'slave')
 * @param {Array} memberSlaves - array of slave objects for group mode [{ id, name, deviceId, deviceName }]
 * @param {number} currentLiveKw - live instant kW
 * @param {Function} onBack - callback to return to previous view
 */
export default function LoadAnalyticsPanel({
  mode = 'group',
  group = null,
  slave = null,
  memberSlaves = [],
  memberDevices = [],
  currentLiveKw = 0,
  onBack,
}) {
  const [selectedPreset, setSelectedPreset] = useState('today')
  const [dateFrom, setDateFrom] = useState(() => getPresetRange('today').from)
  const [dateTo, setDateTo] = useState(() => getPresetRange('today').to)
  const [chartData, setChartData] = useState([])
  const [slaveStats, setSlaveStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // In-memory cache with TTL to ensure real-time consistency across all laptops and sessions
  const cacheRef = useRef({})
  const hasLoadedRef = useRef(false)

  const isMultiDay = useMemo(() => {
    if (!dateFrom || !dateTo) return false
    return dateFrom !== dateTo
  }, [dateFrom, dateTo])

  // Direct devices in this group that don't already have specific member slaves
  const effectiveDevices = useMemo(() => {
    if (mode !== 'group') return []
    const slaveDevIds = new Set((memberSlaves || []).map((s) => s.deviceId).filter(Boolean))
    return (memberDevices || []).filter((d) => d.id && !slaveDevIds.has(d.id))
  }, [mode, memberSlaves, memberDevices])

  // All individual members (slaves + direct devices) for legends & breakdowns
  const allGroupMembers = useMemo(() => {
    if (mode !== 'group') return []
    const list = [...(memberSlaves || [])]
    effectiveDevices.forEach((d) => {
      list.push({
        id: d.id,
        name: d.name || 'Device',
        deviceId: d.id,
        deviceName: d.name || 'Device',
        isDirectDevice: true,
      })
    })
    return list
  }, [mode, memberSlaves, effectiveDevices])

  // Stable key representing member slaves / devices
  const slavesKey = useMemo(() => {
    if (mode === 'slave') return `${slave?.deviceId}_${slave?.slaveId}`
    const slaveParts = (memberSlaves || []).map((s) => `${s.deviceId}_${s.id}`).sort()
    const devParts = effectiveDevices.map((d) => `dev_${d.id}`).sort()
    return [...slaveParts, ...devParts].join(';')
  }, [mode, slave?.deviceId, slave?.slaveId, memberSlaves, effectiveDevices])

  const handlePresetSelect = (presetId) => {
    setSelectedPreset(presetId)
    const range = getPresetRange(presetId)
    setDateFrom(range.from)
    setDateTo(range.to)
  }

  const handleCustomDateChange = (from, to) => {
    setSelectedPreset('custom')
    if (from !== undefined) setDateFrom(from)
    if (to !== undefined) setDateTo(to)
  }

  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (!dateFrom || !dateTo) return

      const todayYmd = toYmd(new Date())
      const isLiveRange = dateTo >= todayYmd
      // Active/live ranges cached for 10s to keep range-switching instant but prevent stale sessions.
      // Past historical ranges cached for 5 minutes.
      const CACHE_TTL_MS = isLiveRange ? 10000 : 300000

      const cacheKey = `${mode}:${slavesKey}:${dateFrom}:${dateTo}`
      const cached = cacheRef.current[cacheKey]
      const now = Date.now()

      if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        setChartData(cached.chartData)
        setSlaveStats(cached.slaveStats)
        setLoading(false)
        setError(null)
        return
      }

      // Only show full loading spinner if we have no chart data currently rendered
      if (!hasLoadedRef.current || forceRefresh) {
        setLoading(true)
      }
      setError(null)

      // Compute exact UTC start/end timestamps covering the Pakistan calendar day (UTC+5)
      const { startDate, endDate } = getDayBoundsUtc(dateFrom, dateTo)

      try {
        if (mode === 'slave') {
          const devId = slave?.deviceId
          const sId = slave?.slaveId
          if (!devId || !sId) {
            setChartData([])
            setLoading(false)
            return
          }

          const res = await emsApi.getSensorAggregate({
            deviceId: devId,
            slaveId: sId,
            variableName: 'ActivePower',
            startDate,
            endDate,
          })
          const points = Array.isArray(res?.data) ? res.data : []
          const formatted = points.map((p) => {
            const val = powerReadingToKw('ActivePower', p.value)
            const safeVal = Number.isFinite(val) ? Math.abs(val) : 0
            return {
              timestamp: p.timestamp,
              time: formatChartTime(p.timestamp, isMultiDay),
              loadKw: +safeVal.toFixed(2),
            }
          })

          cacheRef.current[cacheKey] = {
            chartData: formatted,
            slaveStats: {},
            timestamp: Date.now(),
          }
          setChartData(formatted)
          hasLoadedRef.current = true
        } else {
          // Group Mode: Fetch series for member slaves AND direct member devices
          const slavesToQuery = memberSlaves.filter((s) => s.id && s.deviceId)
          const devicesToQuery = effectiveDevices.filter((d) => d.id)

          if (slavesToQuery.length === 0 && devicesToQuery.length === 0) {
            setChartData([])
            setLoading(false)
            return
          }

          // Group member slaves by parent deviceId to batch requests (1 call per device instead of N per slave)
          const devMap = new Map()
          slavesToQuery.forEach((s) => {
            if (!devMap.has(s.deviceId)) devMap.set(s.deviceId, [])
            devMap.get(s.deviceId).push(s)
          })

          const tasks = [
            ...Array.from(devMap.entries()).map(async ([devId, devSlaves]) => {
              try {
                const sIds = devSlaves.map((s) => s.id)
                const res = await emsApi.getSensorAggregate({
                  deviceId: devId,
                  slaveIds: sIds.join(','),
                  variableName: 'ActivePower',
                  startDate,
                  endDate,
                })
                const points = Array.isArray(res?.data) ? res.data : []
                return { kind: 'slaves', devId, devSlaves, points }
              } catch {
                return { kind: 'slaves', devId, devSlaves, points: [] }
              }
            }),
            ...devicesToQuery.map(async (d) => {
              try {
                const res = await emsApi.getSensorAggregate({
                  deviceId: d.id,
                  variableName: 'ActivePower',
                  startDate,
                  endDate,
                })
                const points = Array.isArray(res?.data) ? res.data : []
                return { kind: 'device', device: d, points }
              } catch {
                return { kind: 'device', device: d, points: [] }
              }
            }),
          ]

          const responses = await Promise.all(tasks)

          // Merge all points by timestamp bucket
          const timeMap = new Map()
          const statsMap = {}

          allGroupMembers.forEach((m) => {
            statsMap[m.id] = {
              id: m.id,
              name: m.name || 'Member',
              deviceName: m.deviceName || 'Device',
              values: [],
            }
          })

          responses.forEach((resp) => {
            if (resp.kind === 'slaves') {
              const { devSlaves, points } = resp
              points.forEach((p) => {
                const ts = new Date(p.timestamp).getTime()
                if (Number.isNaN(ts)) return
                const rawKw = powerReadingToKw('ActivePower', p.value)
                const val = Number.isFinite(rawKw) ? Math.abs(rawKw) : 0
                const sId = p.slaveId || (devSlaves.length === 1 ? devSlaves[0].id : null)
                if (!sId) return

                if (!timeMap.has(ts)) {
                  timeMap.set(ts, {
                    rawTimestamp: ts,
                    isoTimestamp: p.timestamp,
                    time: formatChartTime(p.timestamp, isMultiDay),
                    combinedKw: 0,
                    members: {},
                  })
                }
                const bucket = timeMap.get(ts)
                bucket.members[sId] = +val.toFixed(2)
                bucket.combinedKw = +(bucket.combinedKw + val).toFixed(2)

                if (statsMap[sId]) {
                  statsMap[sId].values.push(val)
                }
              })
            } else if (resp.kind === 'device') {
              const { device, points } = resp
              points.forEach((p) => {
                const ts = new Date(p.timestamp).getTime()
                if (Number.isNaN(ts)) return
                const rawKw = powerReadingToKw('ActivePower', p.value)
                const val = Number.isFinite(rawKw) ? Math.abs(rawKw) : 0

                if (!timeMap.has(ts)) {
                  timeMap.set(ts, {
                    rawTimestamp: ts,
                    isoTimestamp: p.timestamp,
                    time: formatChartTime(p.timestamp, isMultiDay),
                    combinedKw: 0,
                    members: {},
                  })
                }
                const bucket = timeMap.get(ts)
                bucket.members[device.id] = +val.toFixed(2)
                bucket.combinedKw = +(bucket.combinedKw + val).toFixed(2)

                if (statsMap[device.id]) {
                  statsMap[device.id].values.push(val)
                }
              })
            }
          })

          const sortedChart = Array.from(timeMap.values())
            .sort((a, b) => a.rawTimestamp - b.rawTimestamp)
            .map((row) => ({
              timestamp: row.isoTimestamp,
              time: row.time,
              loadKw: row.combinedKw,
              ...row.members,
            }))

          cacheRef.current[cacheKey] = {
            chartData: sortedChart,
            slaveStats: statsMap,
            timestamp: Date.now(),
          }
          setChartData(sortedChart)
          setSlaveStats(statsMap)
          hasLoadedRef.current = true
        }
      } catch (err) {
        setError(err?.message || 'Failed to load historical telemetry')
        if (!hasLoadedRef.current) setChartData([])
      } finally {
        setLoading(false)
      }
    },
    [mode, slavesKey, slave, memberSlaves, effectiveDevices, allGroupMembers, dateFrom, dateTo, isMultiDay],
  )

  useEffect(() => {
    loadData(false)
  }, [loadData])

  // Periodic real-time update when viewing today or current range (every 10s)
  useEffect(() => {
    const todayYmd = toYmd(new Date())
    const isLive = dateTo >= todayYmd
    if (!isLive) return
    const timer = setInterval(() => {
      loadData(true)
    }, 10000)
    return () => clearInterval(timer)
  }, [dateTo, loadData])

  // Aggregate summary calculations from real points
  const stats = useMemo(() => {
    const liveVal = currentLiveKw != null && Number.isFinite(Number(currentLiveKw))
      ? +Number(currentLiveKw).toFixed(2)
      : (chartData.length ? +(Number(chartData[chartData.length - 1]?.loadKw) || 0).toFixed(2) : 0)

    if (!chartData.length) {
      return {
        current: liveVal,
        peak: liveVal,
        avg: liveVal,
        min: liveVal,
        count: 0,
      }
    }
    const values = chartData.map((d) => Number(d.loadKw) || 0)
    const peak = Math.max(...values)
    const min = Math.min(...values)
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length

    return {
      current: liveVal,
      peak: +peak.toFixed(2),
      avg: +avg.toFixed(2),
      min: +min.toFixed(2),
      count: values.length,
    }
  }, [chartData, currentLiveKw])

  // Download CSV handler
  const handleDownloadCsv = () => {
    if (!chartData.length) return

    let csvContent = ''
    const title =
      mode === 'group'
        ? `${group?.name || 'Group'}_Load_Historical_${dateFrom}_to_${dateTo}`
        : `${slave?.slaveName || 'Slave'}_Load_Historical_${dateFrom}_to_${dateTo}`

    if (mode === 'group') {
      const memberHeaders = allGroupMembers.map((m) => `"${m.name} (${m.isDirectDevice ? 'Direct Device' : 'Slave'}) (kW)"`).join(',')
      csvContent = `Timestamp,"Formatted Time",${memberHeaders ? memberHeaders + ',' : ''}"Combined Group Load (kW)"\n`

      chartData.forEach((row) => {
        const memberVals = allGroupMembers.map((m) => row[m.id] ?? 0).join(',')
        csvContent += `"${row.timestamp}","${row.time}",${memberVals ? memberVals + ',' : ''}${row.loadKw}\n`
      })
    } else {
      csvContent = `Timestamp,"Formatted Time","Slave Name","Parent Device","Load (kW)","Unit"\n`
      chartData.forEach((row) => {
        csvContent += `"${row.timestamp}","${row.time}","${slave?.slaveName || ''}","${slave?.deviceName || ''}",${row.loadKw},"kW"\n`
      })
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${title.replace(/[\s/\\?%*:|"<>]/g, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const titleText =
    mode === 'group'
      ? `${group?.name || 'Group'} — Combined Load Analytics`
      : `${slave?.slaveName || 'Slave'} — Load Analytics`

  return (
    <div className="space-y-4">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
            >
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <div>
            <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <Activity size={16} className="text-primary-500" />
              {titleText}
            </h4>
            <p className="text-[10px] text-surface-400">
              {mode === 'group'
                ? `Aggregating real load telemetry across ${memberSlaves.length} member slave${memberSlaves.length === 1 ? '' : 's'}`
                : `Real load telemetry from ${slave?.deviceName || 'Parent Device'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            title="Refresh Historical Data"
            disabled={loading}
            className="btn-ghost p-1.5 text-surface-500 hover:text-surface-800 dark:hover:text-surface-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-primary-500' : ''} />
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={!chartData.length || loading}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1 px-3"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI Cards - Est. Energy removed per user request */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
              {mode === 'group' ? 'Current Combined' : 'Current Load'}
            </span>
            <Zap size={13} className="text-amber-500" />
          </div>
          <p className="text-lg font-black text-surface-900 dark:text-surface-100 mt-1">
            {stats.current.toFixed(2)} <span className="text-xs font-semibold text-surface-400">kW</span>
          </p>
        </div>

        <div className="p-3 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Peak Load</span>
            <TrendingUp size={13} className="text-rose-500" />
          </div>
          <p className="text-lg font-black text-surface-900 dark:text-surface-100 mt-1">
            {stats.peak.toFixed(2)} <span className="text-xs font-semibold text-surface-400">kW</span>
          </p>
        </div>

        <div className="p-3 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Average Load</span>
            <BarChart3 size={13} className="text-primary-500" />
          </div>
          <p className="text-lg font-black text-surface-900 dark:text-surface-100 mt-1">
            {stats.avg.toFixed(2)} <span className="text-xs font-semibold text-surface-400">kW</span>
          </p>
        </div>

        <div className="p-3 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Minimum Load</span>
            <Activity size={13} className="text-emerald-500" />
          </div>
          <p className="text-lg font-black text-surface-900 dark:text-surface-100 mt-1">
            {stats.min.toFixed(2)} <span className="text-xs font-semibold text-surface-400">kW</span>
          </p>
        </div>
      </div>

      {/* Date Range Controls Bar */}
      <div className="p-3 bg-surface-50 dark:bg-surface-950 rounded-xl border border-surface-200 dark:border-surface-800 space-y-2.5">
        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-surface-400 mr-1 flex items-center gap-1">
            <Calendar size={12} /> Range:
          </span>
          {PRESETS.map((p) => {
            const active = selectedPreset === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetSelect(p.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  active
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Custom date range picker inputs */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-surface-200/60 dark:border-surface-800/60 text-xs">
          <span className="text-[10px] font-bold uppercase text-surface-400">Custom Dates:</span>
          <div className="flex items-center gap-1.5">
            <label className="text-surface-400 text-[11px]">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => handleCustomDateChange(e.target.value, undefined)}
              className="px-2 py-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg text-xs font-medium text-surface-800 dark:text-surface-200"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-surface-400 text-[11px]">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => handleCustomDateChange(undefined, e.target.value)}
              className="px-2 py-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg text-xs font-medium text-surface-800 dark:text-surface-200"
            />
          </div>
        </div>
      </div>

      {/* Main Historical Chart */}
      <div className="p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
            <h5 className="text-xs font-bold text-surface-800 dark:text-surface-200">
              {mode === 'group' ? 'Combined Load Profile (kW)' : 'Active Power Load Profile (kW)'}
            </h5>
          </div>
          <span className="text-[11px] text-surface-400">
            {chartData.length} data point{chartData.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        {loading && chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-surface-400">
            <RefreshCw size={24} className="animate-spin text-primary-500" />
            <p className="text-xs">Loading historical telemetry...</p>
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center gap-1 text-danger-500 text-xs text-center">
            <p className="font-bold">Error loading telemetry</p>
            <p className="text-surface-400">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-1 text-surface-400 text-xs text-center border border-dashed border-surface-200 dark:border-surface-800 rounded-xl">
            <Activity size={24} className="opacity-40 mb-1" />
            <p className="font-bold text-surface-600 dark:text-surface-300">No load data recorded</p>
            <p className="text-[11px]">No active telemetry found for the selected date window ({dateFrom} to {dateTo}).</p>
          </div>
        ) : (
          <div className="h-64 w-full relative">
            {loading && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 text-[10px] text-primary-500 font-semibold bg-white/80 dark:bg-surface-900/80 px-2 py-0.5 rounded-md backdrop-blur-sm border border-primary-500/20 shadow-sm">
                <RefreshCw size={10} className="animate-spin" /> Updating...
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  dataKey="time"
                  stroke="#9CA3AF"
                  fontSize={10}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={10}
                  tickLine={false}
                  unit=" kW"
                  domain={[0, 'auto']}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0].payload
                    return (
                      <div className="p-2.5 bg-surface-900 text-white rounded-lg shadow-xl border border-surface-700 text-xs space-y-1 max-w-xs">
                        <p className="text-[10px] text-surface-400 font-mono">{label} ({formatTooltipDate(row.timestamp)})</p>
                        <p className="text-sm font-bold text-primary-400">
                          {mode === 'group' ? 'Combined Load: ' : 'Load: '}
                          {row.loadKw} kW
                        </p>
                        {mode === 'group' && allGroupMembers.length > 1 && (
                          <div className="pt-1 border-t border-surface-800 space-y-0.5 text-[10px]">
                            {allGroupMembers.map((m) => (
                              <div key={m.id} className="flex items-center justify-between gap-3 text-surface-300">
                                <span className="truncate">{m.name}:</span>
                                <span className="font-mono font-bold text-white">{row[m.id] ?? 0} kW</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="loadKw"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#loadGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Group Mode: Member Breakdown Table */}
      {mode === 'group' && allGroupMembers.length > 0 && (
        <div className="p-4 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-primary-500" />
              <h5 className="text-xs font-bold text-surface-800 dark:text-surface-200 uppercase tracking-wider">
                Group Member Breakdown ({allGroupMembers.length})
              </h5>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-800">
            <table className="w-full text-xs">
              <thead className="bg-surface-50 dark:bg-surface-950 text-surface-500">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold">Node Name</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Type / Parent</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Min (kW)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Avg (kW)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Peak (kW)</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Share of Group</th>
                </tr>
              </thead>
              <tbody>
                {allGroupMembers.map((m) => {
                  const mVals = slaveStats[m.id]?.values || []
                  const mMin = mVals.length ? Math.min(...mVals).toFixed(2) : '—'
                  const mMax = mVals.length ? Math.max(...mVals).toFixed(2) : '—'
                  const mAvg = mVals.length
                    ? (mVals.reduce((a, b) => a + b, 0) / mVals.length).toFixed(2)
                    : '—'
                  const sharePct =
                    stats.avg > 0 && mAvg !== '—'
                      ? Math.min(100, Math.round((Number(mAvg) / stats.avg) * 100))
                      : '—'

                  return (
                    <tr key={m.id} className="border-t border-surface-100 dark:border-surface-800">
                      <td className="px-3 py-2 font-bold text-surface-800 dark:text-surface-100">
                        {m.name}
                      </td>
                      <td className="px-3 py-2 text-surface-400">
                        {m.isDirectDevice ? 'Direct Device' : (m.deviceName || 'Device')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-surface-600 dark:text-surface-300">
                        {mMin}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-surface-800 dark:text-surface-100">
                        {mAvg}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-rose-500 font-bold">
                        {mMax}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {sharePct !== '—' ? (
                          <span className="inline-flex items-center gap-1.5 font-bold text-primary-600 dark:text-primary-400">
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block"
                            />
                            {sharePct}%
                          </span>
                        ) : (
                          <span className="text-surface-400 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
