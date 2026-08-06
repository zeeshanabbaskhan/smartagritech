import { useState } from 'react'
import { DollarSign, Calendar, Globe, Battery, Recycle, Zap, Radio, TrendingUp } from 'lucide-react'
import {
  C, Spark, EvCard, SL, Toggle, Kpi, Bar, RangeInput, v2gEarnings,
} from './evShared'

export default function EvV2G() {
  const [v2gLimit, setV2gLimit] = useState(30)
  const [v2gEnabled, setV2gEnabled] = useState(true)
  const [demandResp, setDemandResp] = useState(true)

  return (
    <div className="space-y-4">
      <div className="page-header !mb-0">
        <h2 className="page-title">V2G / Exports</h2>
        <p className="text-xs text-surface-500 mt-0.5">Vehicle-to-grid earnings, reserve limits, and revenue breakdown.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={<DollarSign size={18} />} label="V2G Earnings Today" value="$3.40" color={C.purple} delta="+18%" sub="2.1 kWh exported" />
        <Kpi icon={<Calendar size={18} />} label="This Month" value="$42.80" color={C.green} delta="+31%" sub="68.4 kWh exported" />
        <Kpi icon={<Globe size={18} />} label="Grid Services" value="Active" color={C.teal} sub="Frequency reg." />
        <Kpi icon={<Battery size={18} />} label="Available V2G" value="14 kWh" color={C.accent} sub="Battery reserve: 30%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <EvCard className="lg:col-span-2">
          <SL right="Last 12 hours">V2G Export Earnings</SL>
          <Spark data={v2gEarnings} color={C.purple} w={580} h={72} fill />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-surface-500">12am</span>
            <span className="text-[11px] font-bold text-violet-600">Peak export 4–6am · $2.40</span>
            <span className="text-[10px] text-surface-500">12pm</span>
          </div>
        </EvCard>

        <EvCard>
          <SL>V2G Settings</SL>
          <div className="mb-3.5">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold text-surface-800 dark:text-surface-200">Battery Reserve Limit</span>
              <span className="text-[13px] font-bold text-violet-600">{v2gLimit}%</span>
            </div>
            <RangeInput min={10} max={80} value={v2gLimit} onChange={(e) => setV2gLimit(+e.target.value)} />
            <div className="text-[11px] text-surface-500 mt-1">V2G will never discharge below this level</div>
          </div>
          {[
            { label: 'V2G Export', state: v2gEnabled, toggle: () => setV2gEnabled((v) => !v), Icon: Recycle, sub: 'Sell back to grid' },
            { label: 'Demand Response', state: demandResp, toggle: () => setDemandResp((v) => !v), Icon: Zap, sub: 'Auto-respond to grid signals' },
            { label: 'Frequency Regulation', state: true, toggle: () => {}, Icon: Radio, sub: 'Ancillary services' },
          ].map((s, i, arr) => (
            <div key={s.label} className={`flex justify-between items-center py-2 ${i < arr.length - 1 ? 'border-b border-surface-100 dark:border-surface-800' : ''}`}>
              <div className="flex gap-2 items-center">
                <s.Icon size={16} style={{ color: C.purple }} />
                <div>
                  <div className="text-xs font-semibold text-surface-900 dark:text-surface-100">{s.label}</div>
                  <div className="text-[10px] text-surface-500">{s.sub}</div>
                </div>
              </div>
              <Toggle on={s.state} onToggle={s.toggle} />
            </div>
          ))}
        </EvCard>
      </div>

      <EvCard>
        <SL right="Last 30 days">V2G Revenue Breakdown</SL>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
          {[
            { label: 'Peak Shaving', val: '$18.40', pct: 43, color: C.purple, Icon: Zap },
            { label: 'Freq. Regulation', val: '$12.20', pct: 29, color: C.accent, Icon: Radio },
            { label: 'Demand Response', val: '$8.80', pct: 21, color: C.teal, Icon: Battery },
            { label: 'Spot Market', val: '$3.40', pct: 8, color: C.amber, Icon: TrendingUp },
          ].map((b) => (
            <div key={b.label} className="p-3.5 rounded-xl border" style={{ background: `${b.color}08`, borderColor: `${b.color}25` }}>
              <b.Icon size={22} style={{ color: b.color }} />
              <div className="text-lg font-extrabold mt-2" style={{ color: b.color }}>{b.val}</div>
              <div className="text-xs text-surface-600 dark:text-surface-300 mt-0.5">{b.label}</div>
              <div className="mt-2">
                <Bar value={b.pct} color={b.color} height={4} />
                <div className="text-[10px] text-surface-500 mt-1">{b.pct}% of earnings</div>
              </div>
            </div>
          ))}
        </div>
      </EvCard>
    </div>
  )
}
