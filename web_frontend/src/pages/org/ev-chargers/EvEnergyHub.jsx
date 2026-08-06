import { useState } from 'react'
import { Sun, Battery, Home, Zap, ArrowRight } from 'lucide-react'
import {
  C, Spark, Pill, EvCard, SL, Kpi, RangeInput, gridPriceData, energyTariffs, scheduleReason,
} from './evShared'

export default function EvEnergyHub() {
  const [solarSync] = useState(true)
  const [v2gEnabled] = useState(true)
  const [schedHour, setSchedHour] = useState(23)

  const offPeak = schedHour >= 22 || schedHour <= 5

  return (
    <div className="space-y-4">
      <div className="page-header !mb-0">
        <h2 className="page-title">Energy Hub</h2>
        <p className="text-xs text-surface-500 mt-0.5">Solar, battery, tariffs, live energy flow, and charge scheduling.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={<Sun size={18} />} label="Solar Today" value="18.4 kWh" color={C.amber} delta="+23%" sub="7.2 kW current" />
        <Kpi icon={<Battery size={18} />} label="Home Battery" value="82%" color={C.green} sub="Powerwall · 9.8 kWh" />
        <Kpi icon={<Home size={18} />} label="Home Usage" value="3.2 kW" color={C.accent} sub="4.1 kWh today" />
        <Kpi icon={<Zap size={18} />} label="Grid Import" value="$0.08/kWh" color={C.teal} sub="Off-peak now" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <EvCard className="lg:col-span-2">
          <SL right="Today's tariff">Electricity Price — 24hr</SL>
          <Spark data={gridPriceData} color={C.amber} w={600} h={72} fill />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-surface-500">12am</span>
            <span className="text-[10px] font-bold text-danger-600">⚠ Peak 5–9pm · $0.28</span>
            <span className="text-[10px] text-surface-500">11pm</span>
          </div>
          <div className="mt-3.5">
            <SL>Rate Schedule</SL>
            {energyTariffs.map((t, i) => (
              <div
                key={i}
                className="flex justify-between px-2.5 py-2 rounded-[9px] mb-1 border"
                style={{
                  background: t.color === C.red ? C.redLight : t.color === C.amber ? C.amberLight : C.greenLight,
                  borderColor: `${t.color}25`,
                }}
              >
                <span className="text-xs font-semibold" style={{ color: t.color }}>{t.label}</span>
                <span className="text-xs text-surface-600">{t.hour}</span>
                <span className="text-xs font-bold" style={{ color: t.color }}>{t.rate}</span>
              </div>
            ))}
          </div>
        </EvCard>

        <div className="space-y-3">
          <EvCard>
            <SL>Live Energy Flow</SL>
            {[
              { icon: '☀️', from: 'Solar', to: 'Car', kw: '3.2 kW', color: C.amber, active: solarSync },
              { icon: '🔋', from: 'Powerwall', to: 'Home', kw: '1.8 kW', color: C.green, active: true },
              { icon: '🔌', from: 'Grid', to: 'Powerwall', kw: '0.5 kW', color: C.accent, active: true },
              { icon: '♻️', from: 'Car', to: 'Grid', kw: '2.1 kW', color: C.purple, active: v2gEnabled },
            ].map((f, i) => (
              <div
                key={i}
                className="flex justify-between items-center px-2.5 py-2 rounded-[10px] mb-1.5 border bg-surface-50 dark:bg-surface-950"
                style={{
                  background: f.active ? `${f.color}10` : undefined,
                  borderColor: f.active ? `${f.color}30` : undefined,
                }}
              >
                <span className="text-base">{f.icon}</span>
                <div className="flex-1 px-2.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: f.active ? f.color : C.textMuted }}>
                  {f.from} <ArrowRight size={11} /> {f.to}
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold" style={{ color: f.active ? f.color : C.textMuted }}>{f.kw}</div>
                  <Pill label={f.active ? 'ACTIVE' : 'IDLE'} color={f.active ? f.color : C.textMuted} small />
                </div>
              </div>
            ))}
          </EvCard>

          <EvCard>
            <SL>Schedule Charging</SL>
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold text-surface-800 dark:text-surface-200">Start Time</span>
              <span className="text-[13px] font-bold text-primary-600">{schedHour}:00 {schedHour < 12 ? 'AM' : 'PM'}</span>
            </div>
            <RangeInput min={0} max={23} value={schedHour} onChange={(e) => setSchedHour(+e.target.value)} />
            <div
              className={`mt-2 px-2.5 py-2 rounded-[9px] text-[11px] font-semibold border ${
                offPeak
                  ? 'bg-success-50 dark:bg-success-900/20 border-success-200 text-success-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-700'
              }`}
            >
              {scheduleReason(schedHour)}
            </div>
            <button type="button" className="btn-primary w-full mt-2.5 justify-center text-xs">
              Set Schedule
            </button>
          </EvCard>
        </div>
      </div>
    </div>
  )
}
