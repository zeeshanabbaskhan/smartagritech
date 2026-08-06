import Modal from './Modal'

// Compass-angle → SVG coordinate (0°=top, 90°=right, clockwise)
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

// Horseshoe arc path: pct 0→1 fills from 225° CW through 270° sweep
function gaugePath(cx, cy, r, pct) {
  const sweep = Math.max(0.001, Math.min(0.9999, pct)) * 270
  const s = polar(cx, cy, r, 225)
  const e = polar(cx, cy, r, 225 + sweep)
  const large = sweep > 180 ? 1 : 0
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`
}

function RadialGauge({ pct, color, value, unit, isOffline }) {
  const cx = 40, cy = 44, r = 28, sw = 6
  const bg = gaugePath(cx, cy, r, 1)
  const fg = pct > 0 ? gaugePath(cx, cy, r, pct) : null
  const hasVal = Number.isFinite(value)
  const displayVal = !hasVal ? '—' : unit === '' ? value.toFixed(2) : value.toFixed(1)

  return (
    <svg viewBox="0 0 80 80" className={`w-16 h-16 mx-auto ${isOffline ? 'text-surface-400' : 'device-metric-value'}`}>
      <path d={bg} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth={sw} strokeLinecap="round" />
      {fg && <path d={fg} fill="none" stroke={isOffline ? 'currentColor' : color} strokeWidth={sw} strokeLinecap="round" />}
      <text x={cx} y={cy - 1} textAnchor="middle" fontSize="11" fontWeight="900" fill="currentColor">
        {displayVal}
      </text>
      {unit && (
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" fillOpacity="0.55">
          {unit}
        </text>
      )}
    </svg>
  )
}

export default function DrillDownModal({
  open,
  onClose,
  metric,
  unit,
  aggregate,
  aggregateLabel,
  devices = [],
  getDeviceValue,
  gaugeMax,
  gaugeColor,
}) {
  if (!open) return null

  const isOff = (d) => d.status === 'Offline' || d.status === 'OFFLINE' || d.status === 'offline' || !d.switchOn
  const sorted = [...devices].sort((a, b) => Number(isOff(a)) - Number(isOff(b)))

  const onlineCount = devices.filter((d) => !isOff(d)).length
  const aggNum = Number(aggregate)
  const aggDisplay = Number.isFinite(aggNum) ? (unit === '' ? aggNum.toFixed(2) : aggNum.toFixed(1)) : '—'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`${metric} — Device Breakdown`}
      footer={
        <div className="flex items-center justify-between w-full text-xs text-surface-500 font-semibold">
          <span>{devices.length} device{devices.length !== 1 ? 's' : ''} in scope · {onlineCount} online</span>
          <span>
            {aggregateLabel}:{' '}
            <span className="text-surface-800 dark:text-surface-100 font-black">{aggDisplay}{unit ? ` ${unit}` : ''}</span>
          </span>
        </div>
      }
    >
      <div className="flex items-baseline gap-3 mb-5 pb-4 border-b border-surface-100 dark:border-surface-800">
        <span className="device-metric-value text-4xl font-black">{aggDisplay}</span>
        {unit && <span className="text-xl font-bold text-surface-400">{unit}</span>}
        <span className="text-xs font-bold text-surface-400 uppercase tracking-wider ml-auto">
          {aggregateLabel} of {onlineCount} online device{onlineCount !== 1 ? 's' : ''}
        </span>
      </div>

      {devices.length === 0 ? (
        <p className="text-center text-sm text-surface-400 py-8">No devices in this scope.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((d) => {
            const off = isOff(d)
            const raw = off ? 0 : getDeviceValue(d)
            const val = Number.isFinite(Number(raw)) ? Number(raw) : NaN
            const pct = gaugeMax > 0 && Number.isFinite(val) ? Math.min(1, Math.max(0, val / gaugeMax)) : 0
            return (
              <div
                key={d.id}
                className={`p-3 rounded-xl border text-center space-y-1.5 transition-opacity ${
                  off
                    ? 'bg-surface-50 dark:bg-surface-900 border-surface-200 dark:border-surface-800 opacity-50'
                    : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700'
                }`}
              >
                <RadialGauge pct={pct} color={gaugeColor} value={val} unit={unit} isOffline={off} />
                <p className="text-xs font-black text-surface-800 dark:text-surface-100 leading-tight truncate" title={d.name}>
                  {d.name}
                </p>
                <p className="text-[10px] text-surface-400 truncate">{d.org ?? '—'}</p>
                <span className={`badge text-[9px] font-black ${off ? 'badge-neutral' : 'badge-success'}`}>
                  {off ? 'Offline' : 'Online'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
