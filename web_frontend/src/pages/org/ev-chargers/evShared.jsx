import { useState } from 'react'

/* ─── Design tokens (accent colors for SVG / status) ─────────────────────── */
export const C = {
  accent: '#1D6FEB',
  accentLight: '#EBF2FF',
  green: '#16A34A',
  greenLight: '#DCFCE7',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  red: '#DC2626',
  redLight: '#FEE2E2',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  cyan: '#0891B2',
  teal: '#0D9488',
  textMuted: '#64748B',
  border: '#E8ECF0',
}

export const fmt = (s) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sc = s % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m ${sc}s`
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const statColor = (v) => (v >= 65 ? C.green : v >= 30 ? C.amber : C.red)

export const scheduleReason = (schedHour) => {
  if (schedHour >= 22 || schedHour <= 5) {
    return `Charging at ${schedHour}:00 saves $1.42 vs now — super off-peak rate ($0.08/kWh) active until 6am.`
  }
  if (schedHour <= 9) {
    return `Charging at ${schedHour}:00 saves $0.62 vs now — off-peak rate ($0.14/kWh).`
  }
  return `Charging at ${schedHour}:00 uses peak-adjacent rate ($0.18/kWh). Consider shifting to 11pm for $1.20 savings.`
}

export const GOAL_DESC = {
  cost: 'Minimise electricity cost — AI prioritises off-peak windows and V2G earnings.',
  green: 'Maximise renewable energy — AI prioritises solar availability and BESS over grid.',
  battery: 'Protect battery lifespan — AI limits peak charge to 80%, avoids fast-charge heat.',
}

/* ─── Dummy data ─────────────────────────────────────────────────────────── */
export const powerCurve = [12, 28, 68, 118, 164, 182, 190, 186, 174, 158, 139, 121, 106, 91, 78, 67, 58]
export const weekEnergy = [34, 51, 18, 66, 41, 58, 44]
export const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const monthCost = [42, 38, 55, 61, 49, 58, 44, 52, 66, 47, 53, 60]
export const gridPriceData = [8, 9, 11, 14, 13, 10, 8, 7, 9, 12, 18, 22, 24, 20, 17, 14, 16, 21, 25, 23, 18, 14, 11, 9]
export const v2gEarnings = [0, 0, 1.2, 2.4, 1.8, 0.9, 2.1, 3.4, 2.7, 1.5, 0, 0]

export const sessions = [
  { date: 'Today, 9:14am', name: 'Tesla SC · Downtown', addr: '123 Main St', dur: '47m', kwh: 42.3, cost: 9.82, icon: '⚡', type: 'DC Fast 250kW', solar: 22, bess: 18, grid: 60 },
  { date: 'Yesterday', name: 'ChargePoint · Westfield', addr: 'Mall of America', dur: '1h 11m', kwh: 31.0, cost: 7.44, icon: '🏢', type: 'Level 2 50kW', solar: 0, bess: 0, grid: 100 },
  { date: 'Jun 28', name: 'Home Charger', addr: 'My Home', dur: '6h 08m', kwh: 58.9, cost: 5.20, icon: '🏠', type: 'Level 2 11kW', solar: 41, bess: 31, grid: 28 },
  { date: 'Jun 26', name: 'Electrify America · I-95', addr: 'Hwy 1 Stop', dur: '22m', kwh: 38.5, cost: 11.23, icon: '🛣', type: 'DC Fast 350kW', solar: 8, bess: 0, grid: 92 },
  { date: 'Jun 24', name: 'EVgo · City Center', addr: '456 Oak Ave', dur: '35m', kwh: 28.1, cost: 8.91, icon: '🌆', type: 'DC Fast 100kW', solar: 0, bess: 12, grid: 88 },
]

export const badges = [
  { icon: '🌱', label: 'Eco Warrior', sub: '500kg CO₂ saved', earned: true, color: C.green },
  { icon: '⚡', label: 'Speed Charger', sub: '10 DC fast sessions', earned: true, color: C.amber },
  { icon: '🌙', label: 'Night Owl', sub: '20 off-peak charges', earned: true, color: C.purple },
  { icon: '🗺', label: 'Road Tripper', sub: '500+ miles planned', earned: false, color: C.accent },
  { icon: '🔋', label: 'Battery Guru', sub: 'Maintain 80% SoH', earned: false, color: C.cyan },
  { icon: '💎', label: 'Diamond Driver', sub: '1000 sessions total', earned: false, color: C.cyan },
]

export const aiLog = [
  { time: '09:41', action: 'Shifted charge start to 11:00 PM', reason: 'Current rate $0.24/kWh vs $0.08/kWh off-peak. Delaying saves $1.42 tonight.', type: 'savings' },
  { time: '08:17', action: 'Activated demand response signal', reason: 'Grid operator requested 10% load reduction 6–8 PM. Pausing charge earns $0.18 credit.', type: 'grid' },
  { time: '07:52', action: 'Switched to solar input priority', reason: 'Solar generation (7.2 kW) exceeds home load. Routing surplus directly to vehicle.', type: 'schedule' },
  { time: '06:30', action: 'Pre-conditioned battery to 21°C', reason: 'Forecast: 10°C at departure. Pre-heating adds ~12% charging efficiency at station.', type: 'schedule' },
  { time: 'Yesterday 23:04', action: 'V2G export: 2.1 kWh @ $0.32/kWh', reason: 'Spot price spike detected. Battery at 88% — exported above reserve floor (30%). Earned $0.67.', type: 'export' },
  { time: 'Yesterday 17:22', action: 'Fault alert: Charger Temp 58°C', reason: 'Charger temperature exceeded warning threshold. Session rate reduced to 60 kW to protect hardware.', type: 'fault' },
  { time: 'Yesterday 14:10', action: 'Recommended off-peak schedule', reason: 'Pattern analysis: you typically charge Wed evening. Off-peak window 11 PM–6 AM saves avg $1.20/session.', type: 'savings' },
]

export const energyTariffs = [
  { hour: '12am–6am', rate: '$0.08', label: 'Super Off-Peak', color: C.green },
  { hour: '6am–9am', rate: '$0.14', label: 'Off-Peak', color: C.accent },
  { hour: '9am–5pm', rate: '$0.18', label: 'Mid-Peak', color: C.amber },
  { hour: '5pm–9pm', rate: '$0.28', label: 'Peak', color: C.red },
  { hour: '9pm–12am', rate: '$0.14', label: 'Off-Peak', color: C.accent },
]

export const fleetVehicles = [
  { id: 'V-001', name: 'Tesla Model 3 LR', plate: 'EV·3201', soc: 78, status: 'charging', location: 'Depot A', driver: 'Alex J.' },
  { id: 'V-002', name: 'Chevy Bolt EUV', plate: 'EV·5512', soc: 45, status: 'driving', location: 'En route', driver: 'Maria S.' },
  { id: 'V-003', name: 'Ford F-150 Lightning', plate: 'EV·7723', soc: 91, status: 'ready', location: 'Depot B', driver: 'James K.' },
  { id: 'V-004', name: 'Rivian R1T', plate: 'EV·4490', soc: 22, status: 'idle', location: 'Site 3', driver: 'Sarah M.' },
]

export const operatorBays = [
  { id: 'Bay 1', vehicle: 'Tesla Model 3', soc: 78, power: 98, status: 'charging', source: 'solar', alert: null },
  { id: 'Bay 2', vehicle: 'BMW iX', soc: 44, power: 50, status: 'charging', source: 'grid', alert: null },
  { id: 'Bay 3', vehicle: 'Hyundai IONIQ 6', soc: 91, power: 0, status: 'complete', source: null, alert: 'idle fee in 4m' },
  { id: 'Bay 4', vehicle: '—', soc: 0, power: 0, status: 'fault', source: null, alert: 'hardware fault — cable' },
]

export const EMS_AI_LOG = [
  { time: '09:41', action: 'Shifted charge window → 11 PM', reason: 'Saved $1.42 by avoiding peak rate ($0.28/kWh).', type: 'savings' },
  { time: '08:17', action: 'Activated demand response', reason: 'Grid operator signal received. Earns $0.18 credit.', type: 'grid' },
  { time: '07:52', action: 'Switched to solar priority', reason: 'Solar surplus (7.2 kW) routed directly to vehicles.', type: 'schedule' },
]

/* ─── Shared UI ──────────────────────────────────────────────────────────── */
export function ChargeArc({ pct, size = 180, thick = 14 }) {
  const r = (size - thick) / 2
  const circ = 2 * Math.PI * r
  const p = clamp(pct, 0, 100)
  const color = p > 65 ? C.green : p > 30 ? C.amber : C.red
  const offset = circ * (1 - p / 100)
  return (
    <svg width={size} height={size} className="block mx-auto">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-surface-200 dark:text-surface-700" strokeWidth={thick} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1),stroke 0.5s', filter: `drop-shadow(0 0 6px ${color}55)` }}
      />
      <text x={size / 2} y={size / 2 - 10} textAnchor="middle" fill={color} fontSize={size > 120 ? 38 : 22} fontWeight="800">{Math.round(p)}</text>
      <text x={size / 2} y={size / 2 + 10} textAnchor="middle" className="fill-surface-500" fontSize={12}>%</text>
      {size > 120 && (
        <text x={size / 2} y={size / 2 + 28} textAnchor="middle" className="fill-surface-500" fontSize={9} letterSpacing="1.5">STATE OF CHARGE</text>
      )}
    </svg>
  )
}

export function Spark({ data, color = C.accent, w = 100, h = 32, fill = false }) {
  if (!data?.length) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const rng = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / rng) * (h - 8)])
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block overflow-visible">
      {fill && <path d={`${path} L${w},${h} L0,${h} Z`} fill={`${color}18`} />}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r={3} fill={color} />
    </svg>
  )
}

export function Pill({ label, color, small }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap font-bold tracking-wide rounded-full border ${small ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-0.5'}`}
      style={{ background: `${color}15`, color, borderColor: `${color}30` }}
    >
      {label}
    </span>
  )
}

export function AlertDot({ type }) {
  const map = { fault: C.red, demand: C.amber, ai: C.accent, success: C.green, info: C.cyan }
  const labels = { fault: 'FAULT', demand: 'DEMAND', ai: 'AI', success: 'OK', info: 'INFO' }
  const c = map[type] || C.textMuted
  return (
    <span className="text-[9px] font-bold tracking-wide rounded-full border px-1.5 py-0.5" style={{ background: `${c}18`, color: c, borderColor: `${c}40` }}>
      {labels[type] || type.toUpperCase()}
    </span>
  )
}

export function EvCard({ children, className = '', accent, style }) {
  return (
    <div
      className={`bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-card p-[18px] ${className}`}
      style={accent ? { borderColor: `${accent}40`, ...style } : style}
    >
      {children}
    </div>
  )
}

export function SL({ children, right }) {
  return (
    <div className="flex justify-between items-center mb-3">
      <span className="text-[10px] font-bold tracking-[1.5px] uppercase text-surface-500">{children}</span>
      {right && <span className="text-[11px] font-semibold text-primary-600 cursor-pointer">{right}</span>}
    </div>
  )
}

export function Toggle({ on, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-[38px] h-[21px] rounded-full shrink-0 transition-colors ${on ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'}`}
      aria-pressed={on}
    >
      <span className={`absolute top-[2.5px] w-4 h-4 rounded-full bg-white shadow transition-[left] ${on ? 'left-[19px]' : 'left-[2.5px]'}`} />
    </button>
  )
}

export function Bar({ value, max = 100, color = C.accent, height = 6 }) {
  return (
    <div className="bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${(value / max) * 100}%`, background: color }}
      />
    </div>
  )
}

export function Kpi({ icon, label, value, color, delta, sub }) {
  return (
    <EvCard className="!p-4">
      <div className="flex justify-between items-start">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg"
          style={{ background: `${color}15` }}
        >
          {icon}
        </div>
        {delta && (
          <span className={`text-[11px] font-semibold ${delta.startsWith('+') ? 'text-success-600' : 'text-danger-600'}`}>
            {delta}
          </span>
        )}
      </div>
      <div className="text-[22px] font-extrabold text-surface-900 dark:text-surface-100 mt-2.5">{value}</div>
      <div className="text-[11px] text-surface-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-surface-400 mt-0.5">{sub}</div>}
    </EvCard>
  )
}

export function IdleFeeBanner({ seconds }) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const urgent = seconds < 120
  return (
    <div
      className={`rounded-xl px-3.5 py-2.5 flex justify-between items-center mt-2.5 border ${
        urgent
          ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      }`}
    >
      <div>
        <div className={`text-xs font-bold ${urgent ? 'text-danger-600' : 'text-amber-700'}`}>
          Idle fee starts in {mins}:{String(secs).padStart(2, '0')}
        </div>
        <div className="text-[11px] text-surface-500 mt-0.5">$0.10/min after grace period — please move your vehicle</div>
      </div>
      <div className={`text-lg font-extrabold ${urgent ? 'text-danger-600' : 'text-amber-700'}`}>🚗</div>
    </div>
  )
}

export function EnergySourceBar({ solar = 0, bess = 0, grid = 100 }) {
  return (
    <div className="mt-1.5">
      <div className="flex h-1.5 rounded-full overflow-hidden">
        {solar > 0 && <div style={{ width: `${solar}%`, background: C.amber }} />}
        {bess > 0 && <div style={{ width: `${bess}%`, background: C.green }} />}
        {grid > 0 && <div style={{ width: `${grid}%`, background: C.accent }} />}
      </div>
      <div className="flex gap-2.5 mt-1">
        {solar > 0 && <span className="text-[9px]" style={{ color: C.amber }}>☀ {solar}% solar</span>}
        {bess > 0 && <span className="text-[9px]" style={{ color: C.green }}>🔋 {bess}% battery</span>}
        {grid > 0 && <span className="text-[9px]" style={{ color: C.accent }}>⚡ {grid}% grid</span>}
      </div>
    </div>
  )
}

export function AiLogEntry({ time, action, reason, type }) {
  const typeColor = { schedule: C.accent, savings: C.green, grid: C.amber, fault: C.red, export: C.purple }[type] || C.cyan
  const typeIcon = { schedule: '🕐', savings: '💡', grid: '⚡', fault: '⚠️', export: '♻️' }[type] || '🤖'
  return (
    <div className="flex gap-3 py-2.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
      <div
        className="w-8 h-8 rounded-[9px] border flex items-center justify-center text-[15px] shrink-0"
        style={{ background: `${typeColor}15`, borderColor: `${typeColor}25` }}
      >
        {typeIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="text-xs font-semibold text-surface-900 dark:text-surface-100">{action}</div>
          <div className="flex gap-1.5 items-center shrink-0">
            <AlertDot type={type === 'fault' ? 'fault' : type === 'grid' ? 'demand' : 'ai'} />
            <span className="text-[10px] text-surface-500 whitespace-nowrap">{time}</span>
          </div>
        </div>
        <div className="text-[11px] text-surface-500 mt-1 leading-relaxed">💬 {reason}</div>
      </div>
    </div>
  )
}

export function PeriodTabs({ value, onChange, options = ['week', 'month', 'year'] }) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      {options.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border ${
            value === p
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white dark:bg-surface-900 text-surface-600 border-surface-200 dark:border-surface-700 hover:border-surface-400'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

export function RangeInput(props) {
  return (
    <input
      type="range"
      className="w-full h-1 rounded appearance-none bg-surface-200 dark:bg-surface-700 accent-primary-500 cursor-pointer"
      {...props}
    />
  )
}

/** Local hover state for KPI-style cards that need lift on hover */
export function useHoverLift() {
  const [hov, setHov] = useState(false)
  return {
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    hov,
  }
}
