import { useState } from 'react'
import {
  Bot, SlidersHorizontal, Shuffle, Sun, Battery, Zap, Target, Clock, Recycle,
  Lock, Plug, Thermometer, Check, Leaf,
} from 'lucide-react'
import { C, EvCard, SL, Toggle, RangeInput, EMS_AI_LOG } from './evShared'

export default function EvControl() {
  const [emsControlMode, setEmsControlMode] = useState('hybrid')
  const [emsChargeRate, setEmsChargeRate] = useState(80)
  const [emsChargeCurrent, setEmsChargeCurrent] = useState(80)
  const [emsSourcePriority, setEmsSourcePriority] = useState('solar')
  const [emsScheduleStart, setEmsScheduleStart] = useState(23)
  const [emsTargetSoc, setEmsTargetSoc] = useState(85)
  const [emsAiGoalControl, setEmsAiGoalControl] = useState('cost')
  const [emsV2gOverride, setEmsV2gOverride] = useState(true)

  const isManual = emsControlMode === 'manual'
  const isAi = emsControlMode === 'ai'
  const isHybrid = emsControlMode === 'hybrid'
  const modeColor = isManual ? C.amber : isAi ? C.purple : C.accent
  const modeDesc = {
    manual: 'You are in full control. Set charge rates, source priority, and schedules manually. The AI is off.',
    ai: 'The AI manages all charging decisions automatically based on your goal. No manual input required.',
    hybrid: 'AI makes smart decisions, but you can override key parameters using the sliders below.',
  }[emsControlMode]

  const sourcePriorityOptions = [
    { id: 'solar', Icon: Sun, label: 'Solar First', sub: 'Use rooftop solar before anything else' },
    { id: 'battery', Icon: Battery, label: 'Battery First', sub: 'Drain stored BESS before touching the grid' },
    { id: 'grid', Icon: Zap, label: 'Grid Only', sub: 'Draw directly from the grid at current rate' },
  ]
  const aiGoals = [
    { id: 'cost', Icon: Target, label: 'Minimise Cost', sub: 'Off-peak windows, V2G, demand response' },
    { id: 'green', Icon: Leaf, label: 'Maximise Renewables', sub: 'Solar first, avoid carbon-heavy grid hours' },
    { id: 'battery', Icon: Battery, label: 'Protect Battery', sub: '80% cap, slow charge, avoid heat stress' },
  ]

  const offPeak = emsScheduleStart >= 22 || emsScheduleStart <= 5

  return (
    <div className="space-y-4">
      <div className="page-header !mb-0">
        <h2 className="page-title">Control System</h2>
        <p className="text-xs text-surface-500 mt-0.5">Manual, Full AI, or Hybrid EMS control for EV charging.</p>
      </div>

      <EvCard
        className="!p-5"
        style={{
          background: `linear-gradient(135deg, ${modeColor}10, transparent)`,
          borderColor: `${modeColor}30`,
          borderWidth: 1.5,
        }}
      >
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="text-[11px] font-bold tracking-widest uppercase mb-1.5" style={{ color: modeColor }}>
              EV Charging (EMS) — Control Mode
            </div>
            <div className="text-lg font-extrabold text-surface-900 dark:text-surface-100 inline-flex items-center gap-2">
              {isManual && <><SlidersHorizontal size={18} /> Manual Control</>}
              {isAi && <><Bot size={18} /> Full AI Control</>}
              {isHybrid && <><Shuffle size={18} /> Hybrid Control</>}
            </div>
            <div className="text-xs text-surface-500 mt-1 max-w-xl">{modeDesc}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'manual', label: 'Manual', Icon: SlidersHorizontal, color: C.amber },
              { id: 'ai', label: 'Full AI', Icon: Bot, color: C.purple },
              { id: 'hybrid', label: 'Hybrid', Icon: Shuffle, color: C.accent },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setEmsControlMode(m.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-xs font-bold border transition-colors"
                style={{
                  borderColor: emsControlMode === m.id ? m.color : undefined,
                  background: emsControlMode === m.id ? `${m.color}15` : undefined,
                  color: emsControlMode === m.id ? m.color : undefined,
                }}
              >
                <m.Icon size={14} /> {m.label}
              </button>
            ))}
          </div>
        </div>
      </EvCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3.5">
          {!isManual && (
            <EvCard>
              <SL>AI Optimisation Goal</SL>
              <div className="text-[11px] text-surface-500 mb-3">What should the AI prioritise when making EV charging decisions?</div>
              {aiGoals.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setEmsAiGoalControl(g.id)}
                  className={`w-full flex gap-3 p-3 rounded-xl text-left mb-2 border transition-colors ${
                    emsAiGoalControl === g.id
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                      : 'border-surface-200 dark:border-surface-700'
                  }`}
                >
                  <g.Icon size={20} className={emsAiGoalControl === g.id ? 'text-violet-600' : 'text-surface-500'} />
                  <div className="flex-1">
                    <div className={`text-[13px] font-bold ${emsAiGoalControl === g.id ? 'text-violet-600' : 'text-surface-900 dark:text-surface-100'}`}>{g.label}</div>
                    <div className="text-[11px] text-surface-500 mt-0.5">{g.sub}</div>
                  </div>
                  {emsAiGoalControl === g.id && (
                    <div className="w-[18px] h-[18px] rounded-full bg-violet-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                      <Check size={11} />
                    </div>
                  )}
                </button>
              ))}
            </EvCard>
          )}

          <EvCard>
            <SL>Energy Source Priority</SL>
            <div className="text-[11px] text-surface-500 mb-3">
              {isAi
                ? 'AI is managing source selection automatically based on your goal.'
                : 'Choose which energy source powers your EV chargers first.'}
            </div>
            {sourcePriorityOptions.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={isAi}
                onClick={() => !isAi && setEmsSourcePriority(s.id)}
                className={`w-full flex gap-3 p-3 rounded-xl text-left mb-2 border transition-colors ${
                  isAi ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  emsSourcePriority === s.id
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-surface-200 dark:border-surface-700'
                }`}
              >
                <s.Icon size={20} className={emsSourcePriority === s.id ? 'text-amber-600' : 'text-surface-500'} />
                <div className="flex-1">
                  <div className={`text-[13px] font-bold ${emsSourcePriority === s.id ? 'text-amber-600' : 'text-surface-900 dark:text-surface-100'}`}>{s.label}</div>
                  <div className="text-[11px] text-surface-500 mt-0.5">{s.sub}</div>
                </div>
                {emsSourcePriority === s.id && (
                  <div className="w-[18px] h-[18px] rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Check size={11} />
                  </div>
                )}
              </button>
            ))}
          </EvCard>

          {!isAi && (
            <EvCard>
              <SL>{isHybrid ? 'Hybrid Overrides' : 'Manual Controls'}</SL>
              {isHybrid && (
                <div className="text-[11px] text-surface-500 mb-3.5 px-2.5 py-2 rounded-[9px] bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                  AI handles scheduling and grid signals. Use the sliders below to override specific parameters.
                </div>
              )}

              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs font-semibold text-surface-800 dark:text-surface-200 inline-flex items-center gap-1.5">
                    <Zap size={13} /> Max Charge Rate
                  </span>
                  <span className="text-[13px] font-extrabold text-primary-600">{emsChargeRate} kW</span>
                </div>
                <RangeInput min={7} max={350} value={emsChargeRate} onChange={(e) => setEmsChargeRate(+e.target.value)} />
                <div className="flex justify-between mt-1 text-[10px] text-surface-500">
                  <span>7 kW (Level 2)</span><span>350 kW (Ultra-fast DC)</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs font-semibold text-surface-800 dark:text-surface-200 inline-flex items-center gap-1.5">
                    <Plug size={13} /> Charging Current
                  </span>
                  <span className="text-[13px] font-extrabold text-amber-600">{emsChargeCurrent} A</span>
                </div>
                <RangeInput min={8} max={400} value={emsChargeCurrent} onChange={(e) => setEmsChargeCurrent(+e.target.value)} />
                <div className="flex justify-between mt-1 text-[10px] text-surface-500">
                  <span>8 A (Min)</span><span>400 A (Max)</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs font-semibold text-surface-800 dark:text-surface-200 inline-flex items-center gap-1.5">
                    <Target size={13} /> Target State of Charge
                  </span>
                  <span className="text-[13px] font-extrabold text-success-600">{emsTargetSoc}%</span>
                </div>
                <RangeInput min={50} max={100} value={emsTargetSoc} onChange={(e) => setEmsTargetSoc(+e.target.value)} />
                <div className="flex justify-between mt-1 text-[10px] text-surface-500">
                  <span>50% (daily use)</span><span>100% (road trip)</span>
                </div>
              </div>

              {isManual && (
                <div className="mb-4">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-semibold text-surface-800 dark:text-surface-200 inline-flex items-center gap-1.5">
                      <Clock size={13} /> Charge Start Time
                    </span>
                    <span className="text-[13px] font-extrabold text-primary-600">
                      {emsScheduleStart}:00 {emsScheduleStart < 12 ? 'AM' : 'PM'}
                    </span>
                  </div>
                  <RangeInput min={0} max={23} value={emsScheduleStart} onChange={(e) => setEmsScheduleStart(+e.target.value)} />
                  <div
                    className={`mt-2 px-2.5 py-2 rounded-[9px] text-[11px] font-semibold border ${
                      offPeak
                        ? 'bg-success-50 dark:bg-success-900/20 border-success-200 text-success-700'
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-700'
                    }`}
                  >
                    {offPeak
                      ? '✅ Super off-peak rate active — excellent timing ($0.08/kWh)'
                      : '⚠ Near-peak or peak rate. Consider shifting to 11 PM for max savings.'}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center py-2.5 border-t border-surface-100 dark:border-surface-800">
                <div>
                  <span className="text-xs font-semibold text-surface-800 dark:text-surface-200 inline-flex items-center gap-1.5">
                    <Recycle size={13} /> V2G Export Override
                  </span>
                  <div className="text-[10px] text-surface-500">Allow vehicle-to-grid export during peak hours</div>
                </div>
                <Toggle on={emsV2gOverride} onToggle={() => setEmsV2gOverride((v) => !v)} />
              </div>
            </EvCard>
          )}
        </div>

        <div className="space-y-3.5">
          <EvCard>
            <SL>Live EMS Status</SL>
            {[
              { label: 'Control Mode', val: isManual ? 'Manual' : isAi ? 'Full AI' : 'Hybrid', color: modeColor },
              {
                label: 'Active Source',
                val: emsSourcePriority === 'solar' ? '☀️ Solar' : emsSourcePriority === 'battery' ? '🔋 Battery' : '⚡ Grid',
                color: emsSourcePriority === 'solar' ? C.amber : emsSourcePriority === 'battery' ? C.green : C.accent,
              },
              { label: 'Max Charge Rate', val: isAi ? 'AI-managed' : `${emsChargeRate} kW`, color: C.accent },
              { label: 'Charging Current', val: isAi ? 'AI-managed' : `${emsChargeCurrent} A`, color: C.amber },
              { label: 'Target SoC', val: isAi ? 'AI-managed' : `${emsTargetSoc}%`, color: C.green },
              { label: 'V2G Export', val: (isAi || emsV2gOverride) ? 'Enabled' : 'Disabled', color: (isAi || emsV2gOverride) ? C.purple : C.textMuted },
              { label: 'AI Optimising For', val: isManual ? 'Off' : aiGoals.find((g) => g.id === emsAiGoalControl)?.label, color: isManual ? C.textMuted : C.purple },
            ].map((r, i, arr) => (
              <div
                key={r.label}
                className={`flex justify-between items-center py-2 ${i < arr.length - 1 ? 'border-b border-surface-100 dark:border-surface-800' : ''}`}
              >
                <span className="text-xs text-surface-600 dark:text-surface-300">{r.label}</span>
                <span className="text-xs font-bold" style={{ color: r.color }}>{r.val}</span>
              </div>
            ))}
          </EvCard>

          {!isManual && (
            <EvCard>
              <SL>Recent AI Actions</SL>
              <div className="text-[11px] text-surface-500 mb-2.5">Every automated decision with full reasoning.</div>
              {EMS_AI_LOG.map((e, i) => (
                <div
                  key={i}
                  className={`py-2.5 ${i < EMS_AI_LOG.length - 1 ? 'border-b border-surface-100 dark:border-surface-800' : ''}`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-xs font-bold text-surface-900 dark:text-surface-100">{e.action}</span>
                    <span className="text-[10px] text-surface-500 whitespace-nowrap">{e.time}</span>
                  </div>
                  <div className="text-[11px] text-surface-500 mt-1">💬 {e.reason}</div>
                </div>
              ))}
            </EvCard>
          )}

          {isManual && (
            <EvCard className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <div className="text-[13px] font-bold text-amber-700 dark:text-amber-400 mb-1.5 inline-flex items-center gap-1.5">
                <SlidersHorizontal size={14} /> Full Manual Active
              </div>
              <div className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
                AI optimisation is completely off. All charging decisions use only the parameters you set above. No automatic schedule shifting, demand response, or V2G decisions will be made.
              </div>
              <div className="mt-3 text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                Tip: Switch to Hybrid mode to let AI handle grid signals while you keep control of rate and source priority.
              </div>
            </EvCard>
          )}

          <EvCard>
            <SL>Safety Limits (Locked)</SL>
            <div className="text-[11px] text-surface-500 mb-2.5">These cannot be changed in any mode — they protect hardware and warranties.</div>
            {[
              { label: 'Max charge voltage', val: '410 V', Icon: Plug },
              { label: 'Max battery temp', val: '45°C', Icon: Thermometer },
              { label: 'Min V2G reserve', val: '20%', Icon: Battery },
              { label: 'Max session power', val: '350 kW', Icon: Zap },
            ].map((l, i, arr) => (
              <div
                key={l.label}
                className="flex justify-between px-2.5 py-2 rounded-[9px] border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                style={{ marginBottom: i < arr.length - 1 ? 6 : 0 }}
              >
                <span className="text-xs text-surface-600 dark:text-surface-300 flex gap-1.5 items-center">
                  <l.Icon size={13} /> {l.label}
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                  {l.val} <Lock size={11} />
                </span>
              </div>
            ))}
          </EvCard>
        </div>
      </div>
    </div>
  )
}
