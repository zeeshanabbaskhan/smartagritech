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
  const bg  = gaugePath(cx, cy, r, 1)
  const fg  = pct > 0 ? gaugePath(cx, cy, r, pct) : null
  const displayVal = unit === '' ? value.toFixed(2) : value.toFixed(1)

  return (
    <svg viewBox="0 0 80 80" className="w-16 h-16 mx-auto">
      <path d={bg} fill="none" stroke="#E2E8F0" strokeWidth={sw} strokeLinecap="round" />
      {fg && (
        <path d={fg} fill="none" stroke={isOffline ? '#CBD5E1' : color} strokeWidth={sw} strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 1} textAnchor="middle" fontSize="11" fontWeight="900" fill={isOffline ? '#94A3B8' : '#1E293B'}>
        {displayVal}
      </text>
      {unit && (
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fontWeight="700" fill="#94A3B8">
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
  devices,
  getDeviceValue,
  gaugeMax,
  gaugeColor,
}) {
  if (!open) return null

  const sorted = [...devices].sort((a, b) => {
    const aOff = a.status === 'Offline' || !a.switchOn
    const bOff = b.status === 'Offline' || !b.switchOn
    return Number(aOff) - Number(bOff)
  })

  const onlineCount = devices.filter(d => !(d.status === 'Offline' || !d.switchOn)).length
  const aggDisplay  = unit === '' ? aggregate.toFixed(2) : aggregate.toFixed(1)

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
            <span className="text-surface-800 font-black">{aggDisplay}{unit ? ` ${unit}` : ''}</span>
          </span>
        </div>
      }
    >
      {/* Aggregate hero row */}
      <div className="flex items-baseline gap-3 mb-5 pb-4 border-b border-surface-100 dark:border-surface-800">
        <span className="text-4xl font-black text-surface-900 dark:text-surface-100">
          {aggDisplay}
        </span>
        {unit && <span className="text-xl font-bold text-surface-400">{unit}</span>}
        <span className="text-xs font-bold text-surface-400 uppercase tracking-wider ml-auto">
          {aggregateLabel} of {onlineCount} online device{onlineCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Device grid */}
      {devices.length === 0 ? (
        <p className="text-center text-sm text-surface-400 py-8">No devices in this scope.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map(d => {
            const isOff = d.status === 'Offline' || !d.switchOn
            const val   = isOff ? 0 : getDeviceValue(d)
            const pct   = gaugeMax > 0 ? Math.min(1, Math.max(0, val / gaugeMax)) : 0

            return (
              <div
                key={d.id}
                className={`p-3 rounded-xl border text-center space-y-1.5 transition-opacity ${
                  isOff
                    ? 'bg-surface-50 dark:bg-surface-900 border-surface-200 dark:border-surface-800 opacity-50'
                    : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700'
                }`}
              >
                <RadialGauge pct={pct} color={gaugeColor} value={val} unit={unit} isOffline={isOff} />
                <p className="text-xs font-black text-surface-800 dark:text-surface-100 leading-tight truncate" title={d.name}>
                  {d.name}
                </p>
                <p className="text-[10px] text-surface-400 truncate">{d.org}</p>
                <span className={`badge text-[9px] font-black ${isOff ? 'badge-neutral' : 'badge-success'}`}>
                  {isOff ? 'Offline' : 'Online'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
