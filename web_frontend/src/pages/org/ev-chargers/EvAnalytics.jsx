import { useState } from 'react'
import {
  Zap, Battery, CreditCard, Leaf, DollarSign, Bot, MapPin, Home, Building2,
} from 'lucide-react'
import {
  C, Spark, EvCard, SL, Kpi, Bar, EnergySourceBar, PeriodTabs,
  weekEnergy, weekLabels, monthCost, sessions,
} from './evShared'

export default function EvAnalytics() {
  const [statPeriod, setStatPeriod] = useState('week')

  const kwhTotal = statPeriod === 'week' ? '277' : statPeriod === 'month' ? '1,104' : '2,841'

  return (
    <div className="space-y-4">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 !mb-0">
        <div>
          <h2 className="page-title">Analytics</h2>
          <p className="text-xs text-surface-500 mt-0.5">Sessions, energy, cost, CO₂, and charging location breakdown.</p>
        </div>
        <PeriodTabs value={statPeriod} onChange={setStatPeriod} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi icon={<Zap size={18} />} label="Sessions" value={statPeriod === 'week' ? '7' : statPeriod === 'month' ? '28' : '134'} color={C.accent} delta="+12%" sub="vs last period" />
        <Kpi icon={<Battery size={18} />} label="Energy (kWh)" value={kwhTotal} color={C.green} delta="+8%" />
        <Kpi icon={<CreditCard size={18} />} label="Total Cost" value={statPeriod === 'week' ? '$48' : statPeriod === 'month' ? '$189' : '$612'} color={C.amber} delta="-5%" />
        <Kpi icon={<Leaf size={18} />} label="CO₂ Saved" value={statPeriod === 'week' ? '107kg' : statPeriod === 'month' ? '426kg' : '1.1t'} color={C.teal} delta="+15%" />
        <Kpi icon={<DollarSign size={18} />} label="vs Gas Savings" value={statPeriod === 'week' ? '$68' : statPeriod === 'month' ? '$271' : '$987'} color={C.green} delta="+11%" />
      </div>

      <EvCard accent={C.purple}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot size={20} className="text-violet-600" />
              <span className="text-sm font-bold text-surface-900 dark:text-surface-100">AI Smart Charging Savings</span>
            </div>
            <div className="text-xs text-surface-500">What you paid vs what unmanaged charging would have cost</div>
          </div>
          <div className="flex gap-5 text-center">
            <div>
              <div className="text-[22px] font-extrabold text-success-600">{statPeriod === 'week' ? '$38' : statPeriod === 'month' ? '$152' : '$481'}</div>
              <div className="text-[11px] text-surface-500">AI saved you</div>
            </div>
            <div className="w-px bg-surface-200 dark:bg-surface-700" />
            <div>
              <div className="text-[22px] font-extrabold text-surface-400">{statPeriod === 'week' ? '$86' : statPeriod === 'month' ? '$341' : '$1,093'}</div>
              <div className="text-[11px] text-surface-500">unmanaged would cost</div>
            </div>
            <div className="w-px bg-surface-200 dark:bg-surface-700" />
            <div>
              <div className="text-[22px] font-extrabold text-violet-600">{statPeriod === 'week' ? '44%' : statPeriod === 'month' ? '45%' : '44%'}</div>
              <div className="text-[11px] text-surface-500">reduction</div>
            </div>
          </div>
        </div>
      </EvCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <EvCard className="lg:col-span-2">
          <SL right={`${kwhTotal} kWh total`}>Energy by Day</SL>
          <div className="flex gap-2 items-end h-[100px]">
            {weekEnergy.map((v, i) => {
              const today = i === 6
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`text-[10px] ${today ? 'text-primary-600 font-bold' : 'text-surface-500'}`}>{v}</div>
                  <div
                    className="w-full rounded-t-md border transition-[height] duration-500"
                    style={{
                      height: (v / 66) * 72,
                      background: today ? C.accent : C.accentLight,
                      borderColor: today ? C.accent : C.border,
                    }}
                  />
                  <div className={`text-[10px] ${today ? 'text-primary-600 font-bold' : 'text-surface-500'}`}>{weekLabels[i]}</div>
                </div>
              )
            })}
          </div>
        </EvCard>
        <EvCard>
          <SL>Where You Charge</SL>
          {[
            { label: 'Home', pct: 52, sessions: 70, color: C.accent, Icon: Home },
            { label: 'Workplace', pct: 22, sessions: 29, color: C.purple, Icon: Building2 },
            { label: 'Public DC Fast', pct: 18, sessions: 24, color: C.green, Icon: Zap },
            { label: 'Public Level 2', pct: 8, sessions: 11, color: C.amber, Icon: MapPin },
          ].map((b) => (
            <div key={b.label} className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-semibold text-surface-800 dark:text-surface-200 inline-flex items-center gap-1.5">
                  <b.Icon size={12} style={{ color: b.color }} /> {b.label}
                </span>
                <span className="text-[11px] font-bold" style={{ color: b.color }}>{b.pct}%</span>
              </div>
              <Bar value={b.pct} color={b.color} />
              <div className="text-[10px] text-surface-500 mt-0.5">{b.sessions} sessions</div>
            </div>
          ))}
        </EvCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <EvCard>
          <div className="flex justify-between items-center mb-3.5 gap-3">
            <div className="flex-1 min-w-0"><SL>Monthly Cost Trend</SL></div>
            <div className="w-20 shrink-0"><Spark data={monthCost} color={C.amber} w={80} h={28} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{ label: 'Avg/Session', val: '$8.40' }, { label: 'Cheapest', val: '$2.10' }, { label: 'vs Gas', val: '-$312' }].map((m) => (
              <div key={m.label} className="rounded-[10px] p-2.5 text-center bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800">
                <div className="text-base font-extrabold" style={{ color: C.amber }}>{m.val}</div>
                <div className="text-[10px] text-surface-500 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        </EvCard>
        <EvCard>
          <SL right="View All">Recent Sessions</SL>
          {sessions.slice(0, 4).map((s, i) => (
            <div key={i} className={`py-2 ${i < 3 ? 'border-b border-surface-100 dark:border-surface-800' : ''}`}>
              <div className="flex justify-between items-center gap-2">
                <div className="flex gap-2.5 items-center min-w-0">
                  <div className="w-8 h-8 rounded-[9px] flex items-center justify-center text-base shrink-0" style={{ background: C.accentLight }}>{s.icon}</div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-surface-900 dark:text-surface-100 truncate">{s.name}</div>
                    <div className="text-[10px] text-surface-500">{s.date} · {s.dur} · {s.type}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-primary-600">${s.cost.toFixed(2)}</div>
                  <div className="text-[10px] text-surface-500">{s.kwh} kWh</div>
                </div>
              </div>
              <EnergySourceBar solar={s.solar} bess={s.bess} grid={s.grid} />
            </div>
          ))}
        </EvCard>
      </div>
    </div>
  )
}
