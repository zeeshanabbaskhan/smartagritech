import { useEffect, useState, useRef, useCallback } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PolarAngleAxis, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, Bell, Info, Loader2 } from 'lucide-react'
import { METRICS } from '../../data/facilitiesHierarchy'
import { COLOR_THEMES } from '../../data/widgetCatalog'
import { fetchWidgetLiveBundle, mergeMultiSeries, resolveDeviceId } from '../../utils/widgetLiveData'
import { onSocketEvent, subscribeDevice, isSocketEnabled } from '../../services/socketService'

const POLL_MS = 30_000

function themeHex(color) {
  return COLOR_THEMES.find(c => c.value === color)?.hex || '#F5A623'
}

function renderMarkdown(raw) {
  if (!raw) return ''
  return raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-surface-800 mt-2 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-base font-bold text-surface-900 mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-lg font-extrabold text-surface-900 mt-3 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/`(.+?)`/g,      '<code class="bg-surface-100 text-danger-700 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-xs text-surface-700">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="space-y-0.5 my-1">$1</ul>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-info-600 underline hover:text-info-800">$1</a>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

function resolveThresholdColor(value, thresholds, fallbackColor) {
  if (!thresholds || thresholds.length === 0) return fallbackColor
  const sorted = [...thresholds].sort((a, b) => a.value - b.value)
  let activeColor = fallbackColor
  for (const t of sorted) {
    if (value >= t.value) activeColor = t.color
  }
  return activeColor
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!(active && payload && payload.length)) return null
  return (
    <div className="bg-white border border-surface-200 p-2.5 rounded-lg shadow-floating text-xs font-semibold text-surface-800">
      {label && <p className="text-surface-400 mb-1 font-bold">{label}</p>}
      {payload.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
          <span>{item.name}:</span>
          <span className="text-surface-900 font-bold">{item.value} {unit || ''}</span>
        </div>
      ))}
    </div>
  )
}

export function resolveWidgetContext(widget, dashboardContext) {
  const scope = widget.scopeOverride ? { ...widget.scopeOverride } : {
    level: dashboardContext.level,
    buildingId: dashboardContext.buildingId,
    floorId: dashboardContext.floorId,
    departmentId: dashboardContext.departmentId,
  }
  scope.targetDevice = widget.targetDevice || dashboardContext.targetDevice || null
  scope.targetDeviceId = resolveDeviceId(widget, dashboardContext)

  const timeRange = widget.timeRange === 'inherit' || !widget.timeRange
    ? dashboardContext.timeRange
    : widget.timeRange
  return { scope, timeRange }
}

function LoadingCell() {
  return (
    <div className="h-full flex items-center justify-center text-surface-400">
      <Loader2 size={18} className="animate-spin" />
    </div>
  )
}

function EmptyCell({ message = 'No live data — select a device' }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-surface-400 text-center px-3">
      {message}
    </div>
  )
}

function useLiveBundle(widget, orgName, hierarchy, dashboardContext) {
  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const deviceId = resolveDeviceId(widget, dashboardContext)
  const tickRef = useRef(0)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await fetchWidgetLiveBundle({ widget, dashboardContext, hierarchy, orgName })
      setBundle(data)
    } catch (_) {
      if (!silent) setBundle(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [
    widget.id,
    widget.type,
    widget.metric,
    widget.groupBy,
    widget.timeRange,
    widget.targetDeviceId,
    JSON.stringify(widget.scopeOverride || null),
    JSON.stringify(widget.metrics || []),
    dashboardContext?.timeRange,
    dashboardContext?.targetDeviceId,
    dashboardContext?.buildingId,
    dashboardContext?.floorId,
    dashboardContext?.departmentId,
    dashboardContext?.level,
    orgName,
    hierarchy,
  ])

  useEffect(() => {
    load(false)
  }, [load])

  // Poll for near-realtime updates
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1
      load(true)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  // Socket push when readings arrive for the widget's device
  useEffect(() => {
    if (!isSocketEnabled() || !deviceId) return undefined
    subscribeDevice(deviceId)
    const off = onSocketEvent((event, data) => {
      if (event === 'reading:new' && data?.deviceId === deviceId) load(true)
      if (event === 'alarm:new') load(true)
    })
    return off
  }, [deviceId, load])

  return { bundle, loading }
}

export default function WidgetRenderer({ widget, orgName, hierarchy, dashboardContext }) {
  const cfg = METRICS[widget.metric] || METRICS.energyConsumption
  const color = themeHex(widget.color)
  const { bundle, loading } = useLiveBundle(widget, orgName, hierarchy, dashboardContext)

  if (widget.type === 'text') {
    return (
      <div
        className="h-full overflow-auto prose prose-sm text-surface-700 dark:text-surface-300 text-xs leading-relaxed px-1 text-left"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(widget.content || '_No content — click the settings gear to add markdown._') }}
      />
    )
  }

  if (loading) return <LoadingCell />
  if (!bundle) return <EmptyCell message="Failed to load live data" />

  const series = bundle.series || []
  const comparison = bundle.comparison || []
  const value = bundle.current ?? 0
  const previous = bundle.previous ?? value

  if (widget.groupBy && widget.groupBy !== 'none' && ['bar', 'pie', 'table'].includes(widget.type)) {
    const data = comparison
    if (!data.length) return <EmptyCell message="No devices to compare" />

    if (widget.type === 'table') {
      return (
        <div className="overflow-auto h-full">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-surface-400 uppercase tracking-wide border-b border-surface-100">
                <th className="py-1.5 pr-2 font-bold">Name</th>
                <th className="py-1.5 font-bold">{cfg.label}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data.map((row, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-2 font-semibold text-surface-700">{row.name}</td>
                  <td className="py-1.5 text-surface-900 font-bold">{row.value} <span className="text-surface-400 font-normal">{row.unit}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (widget.type === 'pie') {
      const palette = ['#F5A623', '#2563EB', '#16A34A', '#DC2626', '#8C510A', '#6B7280']
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
            </Pie>
            <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" interval={0} angle={-15} textAnchor="end" height={45} />
          <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
          <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
          <Bar dataKey="value" name={cfg.label} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (widget.type === 'stat') {
    const trend = previous ? Math.round(((value - previous) / Math.abs(previous || 1)) * 1000) / 10 : 0
    const isUp = trend >= 0
    const TrendIcon = isUp ? TrendingUp : TrendingDown
    const activeColor = resolveThresholdColor(value, widget.thresholds, color)

    return (
      <div className="h-full flex flex-col justify-between">
        <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest truncate">{widget.title}</p>
        <h3 className="text-3xl font-bold leading-none tracking-tight" style={{ color: activeColor }}>
          {value} <span className="text-sm font-semibold text-surface-400">{cfg.unit}</span>
        </h3>
        {widget.thresholds?.length > 0 && (
          <div className="w-full h-1.5 rounded-full overflow-hidden flex my-1 bg-surface-100 dark:bg-surface-800">
            {[...widget.thresholds].sort((a, b) => a.value - b.value).map((t, i, arr) => (
              <div
                key={i}
                className="h-full"
                style={{
                  backgroundColor: t.color,
                  flex: i < arr.length - 1 ? arr[i + 1].value - t.value : 1,
                  opacity: value >= t.value ? 1 : 0.25,
                }}
              />
            ))}
          </div>
        )}
        <div className="inline-flex items-center gap-1 text-xs font-semibold w-fit" style={{ color: isUp ? '#16A34A' : '#DC2626' }}>
          <TrendIcon size={12} /> {Math.abs(trend)}% vs prior bucket
        </div>
      </div>
    )
  }

  if (widget.type === 'gauge') {
    const max = widget.metric === 'powerFactor' ? 1 : Math.max(cfg.base + cfg.variance, value * 1.2, 1)
    const pct = Math.min(100, Math.round((value / max) * 100))
    const activeColor = resolveThresholdColor(value, widget.thresholds, color)
    const data = [{ name: cfg.label, value: pct, fill: activeColor }]
    return (
      <div className="h-full flex flex-col items-center justify-center relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="65%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={8} angleAxisId={0} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold" style={{ color: activeColor }}>{value}</span>
          <span className="text-[10px] text-surface-400 font-semibold">{cfg.unit || cfg.label}</span>
        </div>
      </div>
    )
  }

  if (widget.type === 'table') {
    const rows = bundle.tableRows || []
    if (!rows.length) return <EmptyCell message="No devices" />
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-surface-400 uppercase tracking-wide border-b border-surface-100">
              <th className="py-1.5 pr-2 font-bold">Device</th>
              <th className="py-1.5 pr-2 font-bold">{cfg.label}</th>
              <th className="py-1.5 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="py-1.5 pr-2 font-semibold text-surface-700">{row.device}</td>
                <td className="py-1.5 pr-2 text-surface-900 font-bold">{row.value} <span className="text-surface-400 font-normal">{row.unit}</span></td>
                <td className="py-1.5">
                  <span className={`badge ${row.status === 'Online' ? 'badge-success' : 'badge-danger'}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (widget.type === 'alarms') {
    const alarms = bundle.alarms || []
    const severityStyle = {
      danger: 'border-l-danger-600 bg-danger-100/40 text-danger-700 border-danger-600/20',
      warning: 'border-l-primary-500 bg-primary-100/40 text-primary-700 border-primary-500/20',
      info: 'border-l-info-600 bg-info-100/40 text-info-700 border-info-600/20',
    }
    const IconFor = (sev) => sev === 'danger' ? AlertTriangle : sev === 'info' ? Info : Bell
    return (
      <div className="h-full overflow-auto divide-y divide-surface-100">
        {alarms.map(a => {
          const Icon = IconFor(a.severity)
          return (
            <div key={a.id} className={`flex items-center gap-3 py-2 pl-2 border-l-4 ${severityStyle[a.severity] || severityStyle.info}`}>
              <Icon size={14} className="flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-surface-800 truncate">{a.name}</p>
              </div>
              <span className="text-[10px] font-bold text-surface-400 flex-shrink-0">{a.time}</span>
            </div>
          )
        })}
        {alarms.length === 0 && <p className="text-xs text-surface-400 py-4 text-center">No active alarms</p>}
      </div>
    )
  }

  if (widget.type === 'pie') {
    const palette = ['#F5A623', '#2563EB', '#16A34A', '#DC2626', '#8C510A', '#6B7280']
    const sample = series.length
      ? series.filter((_, i) => i % Math.max(1, Math.ceil(series.length / 6)) === 0).slice(0, 6)
      : comparison.slice(0, 6).map((c) => ({ label: c.name, value: c.value }))
    if (!sample.length) return <EmptyCell />
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={sample} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
            {sample.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (widget.type === 'heatmap') {
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const HOURS = Array.from({ length: 24 }, (_, i) => i)
    const matrix = bundle.heatmap
    if (!matrix) {
      return <EmptyCell message="Select a device for heatmap" />
    }
    const allValues = matrix.flat()
    const minV = Math.min(...allValues)
    const maxV = Math.max(...allValues)

    function cellColor(v) {
      const t = maxV === minV ? 0 : (v - minV) / (maxV - minV)
      if (t < 0.5) {
        const u = t * 2
        return `rgb(${Math.round(22 + (245 - 22) * u)},${Math.round(163 + (166 - 163) * u)},${Math.round(74 + (35 - 74) * u)})`
      }
      const u = (t - 0.5) * 2
      return `rgb(${Math.round(245 + (220 - 245) * u)},${Math.round(166 + (38 - 166) * u)},${Math.round(35 + (38 - 35) * u)})`
    }

    return (
      <div className="h-full flex flex-col gap-1 overflow-auto select-none">
        <div className="flex gap-px pl-7">
          {HOURS.filter(h => h % 3 === 0).map(h => (
            <div key={h} className="flex-1 text-center text-[9px] text-surface-400 font-bold" style={{ minWidth: 0 }}>
              {h}h
            </div>
          ))}
        </div>
        {DAYS.map((day, d) => (
          <div key={day} className="flex gap-px items-center flex-1">
            <span className="text-[9px] font-bold text-surface-400 w-6 flex-shrink-0">{day}</span>
            {HOURS.map(h => {
              const v = matrix[d]?.[h] ?? 0
              return (
                <div
                  key={h}
                  className="flex-1 h-full rounded-sm cursor-default relative group"
                  style={{ backgroundColor: cellColor(v), minWidth: 0, minHeight: 8 }}
                >
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block
                    bg-surface-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg pointer-events-none">
                    {day} {h}:00 — {v} {cfg.unit}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-surface-100">
          <span className="text-[9px] text-surface-400 font-bold">Low</span>
          <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right, #16A34A, #F5A623, #DC2626)' }} />
          <span className="text-[9px] text-surface-400 font-bold">High</span>
        </div>
      </div>
    )
  }

  if (widget.type === 'multiseries') {
    const seriesList = (widget.metrics || [
      { key: widget.metric || 'energyConsumption', label: cfg.label, color },
    ])
    const primary = bundle.multiSeries?.[seriesList[0].key]?.length
      ? bundle.multiSeries[seriesList[0].key]
      : series
    const merged = mergeMultiSeries(primary, bundle.multiSeries || {}, seriesList)
    const fallbackPalette = ['#2563EB', '#F5A623', '#16A34A', '#DC2626']
    if (!merged.length) return <EmptyCell />

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
          <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
          {seriesList.length > 1 && (
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
          )}
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="bg-white border border-surface-200 p-2.5 rounded-lg shadow-floating text-xs text-left">
                <p className="text-surface-400 mb-1 font-bold">{label}</p>
                {payload.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-surface-700">{item.name}:</span>
                    <span className="font-bold text-surface-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )
          }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          {seriesList.map((s, i) => (
            <Line
              key={s.key}
              yAxisId={i === 1 ? 'right' : 'left'}
              type="monotone"
              dataKey={s.key}
              name={s.label || METRICS[s.key]?.label || s.key}
              stroke={s.color || fallbackPalette[i % fallbackPalette.length]}
              dot={false}
              strokeWidth={2}
              strokeDasharray={i > 0 ? (i === 1 ? '5 3' : '2 2') : undefined}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (!series.length) return <EmptyCell />

  if (widget.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series}>
          <defs>
            <linearGradient id={`grad-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
          <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
          <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
          <Area type="monotone" dataKey="value" name={cfg.label} stroke={color} fill={`url(#grad-${widget.id})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
  if (widget.type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
          <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
          <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
          <Bar dataKey="value" name={cfg.label} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
        <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
        <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
        <Line type="monotone" dataKey="value" name={cfg.label} stroke={color} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
