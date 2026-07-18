import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PolarAngleAxis, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, Bell, Info } from 'lucide-react'
import {
  METRICS, generateSeries, generateComparison, generateCurrentValue, generateDeviceTable, generateAlarms,
  hashString, seededRandom,
} from '../../data/facilitiesHierarchy'
import { COLOR_THEMES } from '../../data/widgetCatalog'

function themeHex(color) {
  return COLOR_THEMES.find(c => c.value === color)?.hex || '#F5A623'
}

function renderMarkdown(raw) {
  if (!raw) return ''
  return raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')  // XSS escape
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

// Resolves the effective scope + time range a widget should read data from,
// honoring per-widget overrides and otherwise inheriting the dashboard's
// shared context filter (building / floor / department / time range).
export function resolveWidgetContext(widget, dashboardContext) {
  const scope = widget.scopeOverride ? { ...widget.scopeOverride } : {
    level: dashboardContext.level,
    buildingId: dashboardContext.buildingId,
    floorId: dashboardContext.floorId,
    departmentId: dashboardContext.departmentId,
  }
  
  // Widget-level device association overrides the dashboard-level default association
  scope.targetDevice = widget.targetDevice || dashboardContext.targetDevice || null

  const timeRange = widget.timeRange === 'inherit' || !widget.timeRange
    ? dashboardContext.timeRange
    : widget.timeRange
  return { scope, timeRange }
}

export default function WidgetRenderer({ widget, orgName, hierarchy, dashboardContext }) {
  const { scope, timeRange } = resolveWidgetContext(widget, dashboardContext)
  const cfg = METRICS[widget.metric] || METRICS.energyConsumption
  const color = themeHex(widget.color)

  if (widget.groupBy && widget.groupBy !== 'none' && ['bar', 'pie', 'table'].includes(widget.type)) {
    const data = generateComparison(orgName, hierarchy, scope, widget.metric, timeRange)

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

    // bar comparison
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
    const value = generateCurrentValue(orgName, scope, widget.metric)
    const trend = Math.round((Math.sin(value) * 12) * 10) / 10
    const isUp = trend >= 0
    const TrendIcon = isUp ? TrendingUp : TrendingDown
    
    // Resolve active threshold color
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

        <div className={`inline-flex items-center gap-1 text-xs font-semibold w-fit`} style={{ color: isUp ? '#16A34A' : '#DC2626' }}>
          <TrendIcon size={12} /> {Math.abs(trend)}% vs last period
        </div>
      </div>
    )
  }

  if (widget.type === 'gauge') {
    const value = generateCurrentValue(orgName, scope, widget.metric)
    const max = widget.metric === 'powerFactor' ? 1 : cfg.base + cfg.variance
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
    const rows = generateDeviceTable(orgName, scope, widget.metric)
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
    const alarms = generateAlarms(orgName, scope)
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
    const series = generateSeries(orgName, scope, widget.metric, timeRange)
    const palette = ['#F5A623', '#2563EB', '#16A34A', '#DC2626', '#8C510A', '#6B7280']
    const sample = series.filter((_, i) => i % Math.ceil(series.length / 6) === 0).slice(0, 6)
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

  // ── Heatmap ─────────────────────────────────────────────────────────────
  if (widget.type === 'heatmap') {
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const HOURS = Array.from({ length: 24 }, (_, i) => i)

    // Build a 7×24 matrix of seeded-random values that feel realistic
    function cellValue(day, hour) {
      const seed = hashString(`${widget.metric}-${scope.nodeId || 'org'}-${day}-${hour}`)
      const base = cfg.base ?? 50
      const variance = cfg.variance ?? 30
      // Business-hours peak shape: higher mid-day, lower nights + weekends
      const hourFactor = hour >= 8 && hour <= 18 ? 1.4 : hour >= 19 && hour <= 22 ? 0.9 : 0.4
      const dayFactor = day < 5 ? 1 : 0.55
      const rnd = seededRandom(seed)()
      return Math.round((base * hourFactor * dayFactor + rnd * variance) * 10) / 10
    }

    // Collect min/max for normalisation
    const allValues = DAYS.flatMap((_, d) => HOURS.map(h => cellValue(d, h)))
    const minV = Math.min(...allValues)
    const maxV = Math.max(...allValues)

    // Interpolate: low → green (#16A34A), mid → amber (#F5A623), high → red (#DC2626)
    function cellColor(v) {
      const t = maxV === minV ? 0 : (v - minV) / (maxV - minV)
      if (t < 0.5) {
        // green → amber
        const u = t * 2
        const r = Math.round(22 + (245 - 22) * u)
        const g = Math.round(163 + (166 - 163) * u)
        const b = Math.round(74 + (35 - 74) * u)
        return `rgb(${r},${g},${b})`
      } else {
        // amber → red
        const u = (t - 0.5) * 2
        const r = Math.round(245 + (220 - 245) * u)
        const g = Math.round(166 + (38 - 166) * u)
        const b = Math.round(35 + (38 - 35) * u)
        return `rgb(${r},${g},${b})`
      }
    }

    return (
      <div className="h-full flex flex-col gap-1 overflow-auto select-none">
        {/* Hour axis header */}
        <div className="flex gap-px pl-7">
          {HOURS.filter(h => h % 3 === 0).map(h => (
            <div key={h} className="flex-1 text-center text-[9px] text-surface-400 font-bold"
              style={{ minWidth: 0 }}>
              {h}h
            </div>
          ))}
        </div>
        {DAYS.map((day, d) => (
          <div key={day} className="flex gap-px items-center flex-1">
            <span className="text-[9px] font-bold text-surface-400 w-6 flex-shrink-0">{day}</span>
            {HOURS.map(h => {
              const v = cellValue(d, h)
              return (
                <div
                  key={h}
                  className="flex-1 h-full rounded-sm cursor-default relative group"
                  style={{ backgroundColor: cellColor(v), minWidth: 0, minHeight: 8 }}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block
                    bg-surface-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg pointer-events-none">
                    {day} {h}:00 — {v} {cfg.unit}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-surface-100">
          <span className="text-[9px] text-surface-400 font-bold">Low</span>
          <div className="flex-1 h-2 rounded" style={{
            background: 'linear-gradient(to right, #16A34A, #F5A623, #DC2626)'
          }} />
          <span className="text-[9px] text-surface-400 font-bold">High</span>
        </div>
      </div>
    )
  }

  // ── Text / Markdown ──────────────────────────────────────────────────────
  if (widget.type === 'text') {
    return (
      <div
        className="h-full overflow-auto prose prose-sm text-surface-700 dark:text-surface-300 text-xs leading-relaxed px-1 text-left"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(widget.content || '_No content — click the settings gear to add markdown._') }}
      />
    )
  }

  // ── Multi-Series Chart ───────────────────────────────────────────────────
  if (widget.type === 'multiseries') {
    const seriesList = (widget.metrics || [
      { key: widget.metric || 'energyConsumption', label: cfg.label, color },
    ])

    // Merge all series onto a common time axis
    const primary = generateSeries(orgName, scope, seriesList[0].key, timeRange)
    const merged = primary.map((pt, i) => {
      const entry = { label: pt.label }
      seriesList.forEach(s => {
        const pts = generateSeries(orgName, scope, s.key, timeRange)
        entry[s.key] = pts[i]?.value ?? null
      })
      return entry
    })

    // Palette fallback if colours not provided on each series entry
    const fallbackPalette = ['#2563EB', '#F5A623', '#16A34A', '#DC2626']

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

  // line / area / bar — plain time series
  const series = generateSeries(orgName, scope, widget.metric, timeRange)
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
