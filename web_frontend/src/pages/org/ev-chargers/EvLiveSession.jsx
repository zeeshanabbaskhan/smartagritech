import { useState, useEffect } from 'react'
import {
  Zap, Clock, Battery, DollarSign, Gauge, Leaf, Target,
  CalendarClock, Thermometer, Sun, Recycle, Car, Bot,
  Play, Square, CheckCircle2, AlertTriangle, User, Building2,
} from 'lucide-react'
import {
  C, fmt, ChargeArc, Spark, Pill, EvCard, SL, Toggle, Kpi, IdleFeeBanner,
  RangeInput, powerCurve, operatorBays, scheduleReason,
} from './evShared'

const SMART_ICONS = {
  'Off-Peak Scheduling': CalendarClock,
  'Demand Response': Battery,
  'Battery Preconditioning': Thermometer,
  'Solar Sync': Sun,
  'V2G Export': Recycle,
}

const HEALTH = [
  { label: 'Battery Temp', val: '28°C', Icon: Thermometer, color: C.green, sub: 'Optimal' },
  { label: 'Charger Temp', val: '42°C', Icon: Zap, color: C.amber, sub: 'Warm' },
  { label: 'Battery SoH', val: '97%', Icon: Battery, color: C.green, sub: 'Excellent' },
  { label: 'Cell Balance', val: '±12mV', Icon: Gauge, color: C.accent, sub: 'Good' },
  { label: 'Input Voltage', val: '800V', Icon: Zap, color: C.accent, sub: 'Nominal' },
  { label: 'Efficiency', val: '94.1%', Icon: Leaf, color: C.teal, sub: 'This session' },
]

export default function EvLiveSession() {
  const [driverMode, setDriverMode] = useState(true)
  const [charging, setCharging] = useState(true)
  const [soc, setSoc] = useState(78.0)
  const [powerKw] = useState(98)
  const [elapsed, setElapsed] = useState(2820)
  const [sessionKwh, setSessionKwh] = useState(42.3)
  const [chargeLimit, setChargeLimit] = useState(90)
  const [smartSched, setSmartSched] = useState(true)
  const [demandResp, setDemandResp] = useState(true)
  const [precond, setPrecond] = useState(false)
  const [v2gEnabled, setV2gEnabled] = useState(true)
  const [solarSync, setSolarSync] = useState(true)
  const [schedHour, setSchedHour] = useState(23)
  const [deptTime, setDeptTime] = useState('07:30')
  const [deptTarget, setDeptTarget] = useState(80)
  const [idleCountdown, setIdleCountdown] = useState(null)
  const [activeAlert, setActiveAlert] = useState(null)

  useEffect(() => {
    if (!charging) return undefined
    const t = setInterval(() => {
      setSoc((s) => Math.min(chargeLimit, +(s + 0.018).toFixed(3)))
      setElapsed((e) => e + 1)
      setSessionKwh((k) => +(k + 0.003).toFixed(3))
    }, 1000)
    return () => clearInterval(t)
  }, [charging, chargeLimit])

  useEffect(() => {
    if (soc >= chargeLimit && charging) {
      setCharging(false)
      setActiveAlert(`Reached ${chargeLimit}% charge limit!`)
      setIdleCountdown(600)
      const t = setTimeout(() => setActiveAlert(null), 4000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [soc, chargeLimit, charging])

  useEffect(() => {
    if (idleCountdown === null || idleCountdown <= 0) return undefined
    const t = setInterval(() => setIdleCountdown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [idleCountdown])

  const estMins = charging ? Math.max(0, Math.ceil((chargeLimit - soc) / 0.018 / 60)) : 0
  const costNow = (sessionKwh * 0.232).toFixed(2)
  const co2Saved = (sessionKwh * 0.386).toFixed(1)
  const milesAdded = Math.round(sessionKwh * 3.8)

  const metrics = [
    { label: 'Power Now', val: `${powerKw} kW`, color: C.accent, Icon: Zap },
    { label: 'Elapsed', val: fmt(elapsed), color: undefined, Icon: Clock },
    { label: 'Energy', val: `${sessionKwh.toFixed(1)} kWh`, color: undefined, Icon: Battery },
    { label: 'Cost So Far', val: `$${costNow}`, color: C.amber, Icon: DollarSign },
    { label: 'Miles Added', val: `+${milesAdded} mi`, color: C.green, Icon: Gauge },
    { label: 'CO₂ Saved', val: `${co2Saved} kg`, color: C.teal, Icon: Leaf },
  ]

  const smartControls = [
    { label: 'Off-Peak Scheduling', sub: '~38% avg savings', state: smartSched, toggle: () => setSmartSched((v) => !v) },
    { label: 'Demand Response', sub: 'Grid-aware charging', state: demandResp, toggle: () => setDemandResp((v) => !v) },
    { label: 'Battery Preconditioning', sub: 'Pre-warm for DC fast', state: precond, toggle: () => setPrecond((v) => !v) },
    { label: 'Solar Sync', sub: 'Charge from solar first', state: solarSync, toggle: () => setSolarSync((v) => !v) },
    { label: 'V2G Export', sub: 'Sell back to grid at peak', state: v2gEnabled, toggle: () => setV2gEnabled((v) => !v) },
  ]

  const peakHint =
    schedHour >= 22 || schedHour <= 5
      ? { bg: 'bg-success-50 dark:bg-success-900/20', text: 'text-success-700 dark:text-success-400', border: 'border-success-200 dark:border-success-800' }
      : schedHour <= 9
        ? { bg: 'bg-primary-50 dark:bg-primary-900/20', text: 'text-primary-700 dark:text-primary-400', border: 'border-primary-200 dark:border-primary-800' }
        : { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' }

  return (
    <div className="space-y-4">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 !mb-0">
        <div>
          <h2 className="page-title">Live Session</h2>
          <p className="text-xs text-surface-500 mt-0.5">
            Live EV session SoC, power curve, smart controls, and operator bay telemetry.
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { id: true, label: 'Driver View', Icon: User },
            { id: false, label: 'Operator View', Icon: Building2 },
          ].map(({ id, label, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => setDriverMode(id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                driverMode === id
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-700 hover:border-surface-400'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {activeAlert && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2 border bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800 text-success-700 dark:text-success-400 text-sm font-semibold">
          <CheckCircle2 size={16} /> {activeAlert}
        </div>
      )}

      {driverMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Session card — spans 2 rows on large screens */}
          <EvCard className="lg:row-span-2 !p-6" accent={charging ? C.green : null}>
            <div className="flex justify-between items-start mb-4 gap-2">
              <div>
                <Pill
                  label={charging ? `● CHARGING ${powerKw}kW` : '● IDLE'}
                  color={charging ? C.green : C.textMuted}
                />
                <div className="text-base font-bold text-surface-900 dark:text-surface-100 mt-2">
                  Tesla SC · Downtown Plaza
                </div>
                <div className="text-xs text-surface-500 mt-0.5">Stall #7 · NACS · 250kW Max</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-surface-500">Est. done</div>
                <div className="text-[22px] font-extrabold text-success-600">
                  {charging ? `${estMins}m` : '—'}
                </div>
              </div>
            </div>

            <ChargeArc pct={soc} size={180} thick={14} />

            <div className="grid grid-cols-2 gap-2 my-4">
              {metrics.map((r) => (
                <div
                  key={r.label}
                  className="px-2.5 py-2 rounded-[10px] bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800"
                >
                  <div className="flex items-center gap-1 text-[11px] text-surface-500">
                    <r.Icon size={11} /> {r.label}
                  </div>
                  <div
                    className="text-sm font-bold mt-0.5 text-surface-900 dark:text-surface-100"
                    style={r.color ? { color: r.color } : undefined}
                  >
                    {r.val}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800 mb-3.5">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 inline-flex items-center gap-1.5">
                  <Target size={13} className="text-primary-500" /> Charge Limit
                </span>
                <span className="text-[13px] font-bold text-primary-600">{chargeLimit}%</span>
              </div>
              <RangeInput
                min={50}
                max={100}
                value={chargeLimit}
                onChange={(e) => setChargeLimit(+e.target.value)}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-surface-500">50% daily</span>
                <span className="text-[10px] text-surface-500">100% road trip</span>
              </div>
            </div>

            {!charging && idleCountdown !== null && idleCountdown > 0 && (
              <IdleFeeBanner seconds={idleCountdown} />
            )}

            <button
              type="button"
              onClick={() => {
                setCharging((c) => !c)
                if (!charging) setIdleCountdown(null)
              }}
              className={`w-full mt-3.5 py-3 rounded-xl text-sm font-bold border inline-flex items-center justify-center gap-2 ${
                charging
                  ? 'bg-danger-50 text-danger-600 border-danger-200 dark:bg-danger-900/20 dark:border-danger-800'
                  : 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:border-success-800'
              }`}
            >
              {charging ? <><Square size={14} /> Stop Charging</> : <><Play size={14} /> Resume Charging</>}
            </button>
          </EvCard>

          {/* Power curve */}
          <EvCard className="lg:col-span-2">
            <SL>Power Delivery Curve (kW)</SL>
            <Spark data={powerCurve} color={C.accent} w={580} h={72} fill />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-surface-500">Session start</span>
              <span className="text-[11px] font-bold text-primary-600">Peak: 190 kW</span>
              <span className="text-[10px] text-surface-500">Now</span>
            </div>
          </EvCard>

          {/* Smart controls */}
          <EvCard>
            <SL>Smart Charging Controls</SL>
            {smartControls.map((s, i, arr) => {
              const Icon = SMART_ICONS[s.label]
              return (
                <div
                  key={s.label}
                  className={`flex justify-between items-center py-2.5 ${
                    i < arr.length - 1 ? 'border-b border-surface-100 dark:border-surface-800' : ''
                  }`}
                >
                  <div className="flex gap-2.5 items-center min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${C.accent}12`, color: C.accent }}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-surface-900 dark:text-surface-100">{s.label}</div>
                      <div className="text-[11px] text-surface-500">{s.sub}</div>
                    </div>
                  </div>
                  <Toggle on={s.state} onToggle={s.toggle} />
                </div>
              )
            })}

            <div className="mt-3.5 p-3 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-surface-600 dark:text-surface-300">Schedule Start</span>
                <span className="text-xs font-bold text-primary-600">
                  {schedHour}:00 {schedHour < 12 ? 'AM' : 'PM'}
                </span>
              </div>
              <RangeInput
                min={0}
                max={23}
                value={schedHour}
                onChange={(e) => setSchedHour(+e.target.value)}
              />
              <div className={`mt-2 px-2.5 py-2 rounded-[9px] text-[11px] font-semibold border ${peakHint.bg} ${peakHint.text} ${peakHint.border}`}>
                {scheduleReason(schedHour)}
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl border bg-violet-50/60 dark:bg-violet-950/30 border-violet-200/60 dark:border-violet-800/50">
              <div className="text-[11px] font-bold text-violet-700 dark:text-violet-300 mb-2 inline-flex items-center gap-1.5">
                <Car size={13} /> Ready By (departure target)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-surface-500 mb-1">Departure time</div>
                  <input
                    type="time"
                    value={deptTime}
                    onChange={(e) => setDeptTime(e.target.value)}
                    className="input-field !py-1.5 text-xs"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-surface-500 mb-1">Target charge %</div>
                  <div className="flex items-center gap-1.5">
                    <RangeInput
                      min={50}
                      max={100}
                      value={deptTarget}
                      onChange={(e) => setDeptTarget(+e.target.value)}
                    />
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-300 min-w-[32px]">
                      {deptTarget}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-violet-700 dark:text-violet-300">
                AI will start charging at{' '}
                {deptTarget <= 60 ? '11:02 PM' : deptTarget <= 80 ? '10:18 PM' : '09:41 PM'} to reach{' '}
                {deptTarget}% by {deptTime}.
              </div>
            </div>
          </EvCard>

          {/* Vehicle health */}
          <EvCard>
            <SL>Vehicle Health</SL>
            <div className="grid grid-cols-2 gap-2">
              {HEALTH.map((v) => (
                <div
                  key={v.label}
                  className="rounded-[10px] px-2.5 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800"
                >
                  <div className="flex justify-between items-center">
                    <v.Icon size={15} style={{ color: v.color }} />
                    <span className="text-[11px] font-bold" style={{ color: v.color }}>{v.val}</span>
                  </div>
                  <div className="text-[11px] font-semibold mt-1 text-surface-800 dark:text-surface-200">{v.label}</div>
                  <div className="text-[10px] text-surface-500">{v.sub}</div>
                </div>
              ))}
            </div>
          </EvCard>
        </div>
      ) : (
        /* ── Operator view ── */
        <div className="space-y-4">
          <div className="rounded-xl px-4 py-3 flex gap-3 items-start border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <Bot size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-bold text-amber-700 dark:text-amber-400">
                AI Forecast Alert — Peak demand window 5–9 PM today
              </div>
              <div className="text-xs text-surface-600 dark:text-surface-300 mt-0.5">
                Grid operator signal received. AI recommends shifting all bay charging to after 9 PM.
                Estimated savings: $4.80. Demand response credit: $0.18.{' '}
                <button type="button" className="text-primary-600 font-semibold hover:underline">
                  Accept AI recommendation →
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {operatorBays.map((bay) => {
              const statusColor =
                bay.status === 'charging' ? C.green
                  : bay.status === 'complete' ? C.accent
                    : bay.status === 'fault' ? C.red
                      : C.textMuted
              const sourceColor =
                bay.source === 'solar' ? C.amber
                  : bay.source === 'grid' ? C.accent
                    : C.green
              return (
                <EvCard key={bay.id} accent={statusColor} className="!p-[18px]">
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-sm font-bold text-surface-900 dark:text-surface-100">{bay.id}</div>
                    <Pill label={bay.status.toUpperCase()} color={statusColor} small />
                  </div>
                  <div className="text-xs text-surface-600 dark:text-surface-300 mb-3">{bay.vehicle}</div>
                  {bay.status === 'charging' && (
                    <>
                      <ChargeArc pct={bay.soc} size={100} thick={9} />
                      <div className="text-[11px] text-surface-500 mt-1.5 text-center">
                        {bay.power} kW
                        {bay.source && (
                          <> · <span style={{ color: sourceColor }} className="font-semibold">via {bay.source}</span></>
                        )}
                      </div>
                    </>
                  )}
                  {bay.status === 'complete' && (
                    <div className="flex justify-center my-3 text-success-600"><CheckCircle2 size={32} /></div>
                  )}
                  {bay.status === 'fault' && (
                    <div className="flex justify-center my-3 text-danger-600"><AlertTriangle size={32} /></div>
                  )}
                  {bay.alert && (
                    <div
                      className={`mt-2.5 px-2.5 py-1.5 rounded-[9px] text-[11px] font-semibold border ${
                        bay.status === 'fault'
                          ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 text-danger-600'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-700'
                      }`}
                    >
                      ⚠ {bay.alert}
                    </div>
                  )}
                </EvCard>
              )
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Kpi icon={<Zap size={18} />} label="Active Sessions" value="2" color={C.green} sub="2 bays charging" />
            <Kpi icon={<Battery size={18} />} label="Total Power" value="148 kW" color={C.accent} sub="Bay 1+2 combined" />
            <Kpi icon={<DollarSign size={18} />} label="Revenue Today" value="$38.40" color={C.amber} delta="+18%" />
            <Kpi icon={<AlertTriangle size={18} />} label="Faults Active" value="1" color={C.red} sub="Bay 4 — cable" />
          </div>
        </div>
      )}
    </div>
  )
}
