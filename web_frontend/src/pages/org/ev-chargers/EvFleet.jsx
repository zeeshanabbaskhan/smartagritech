import { Car, Zap, Battery, DollarSign, MapPin, AlertTriangle, Wrench, CheckCircle2, Calendar } from 'lucide-react'
import { C, Pill, EvCard, SL, Kpi, Bar, fleetVehicles, statColor } from './evShared'

export default function EvFleet() {
  return (
    <div className="space-y-4">
      <div className="page-header !mb-0">
        <h2 className="page-title">Fleet</h2>
        <p className="text-xs text-surface-500 mt-0.5">Fleet vehicles, SoC, charging schedule, and health alerts.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={<Car size={18} />} label="Total Vehicles" value="4" color={C.accent} sub="3 active · 1 idle" />
        <Kpi icon={<Zap size={18} />} label="Currently Charging" value="1" color={C.green} sub="At depot A" />
        <Kpi icon={<Battery size={18} />} label="Fleet Avg SoC" value="59%" color={C.amber} sub="Across all vehicles" />
        <Kpi icon={<DollarSign size={18} />} label="Fleet Energy Cost" value="$124/mo" color={C.teal} delta="-12%" sub="vs. last month" />
      </div>

      <EvCard>
        <SL right="Manage Fleet">Fleet Vehicles</SL>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fleetVehicles.map((v) => (
            <div key={v.id} className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-100 dark:border-surface-800">
              <div className="flex justify-between items-start mb-2.5 gap-2">
                <div className="flex gap-2.5 items-center min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center shrink-0">
                    <Car size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-surface-900 dark:text-surface-100 truncate">{v.name}</div>
                    <div className="text-[11px] text-surface-500">{v.plate} · Driver: {v.driver}</div>
                  </div>
                </div>
                <Pill
                  label={v.status.toUpperCase()}
                  small
                  color={v.status === 'charging' ? C.green : v.status === 'driving' ? C.accent : v.status === 'ready' ? C.teal : C.amber}
                />
              </div>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-surface-500">
                  SoC: <strong style={{ color: statColor(v.soc) }}>{v.soc}%</strong>
                </span>
                <span className="text-xs text-surface-500 inline-flex items-center gap-1">
                  <MapPin size={11} /> {v.location}
                </span>
              </div>
              <Bar value={v.soc} color={statColor(v.soc)} height={6} />
            </div>
          ))}
        </div>
      </EvCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <EvCard>
          <SL>Fleet Charging Schedule</SL>
          {fleetVehicles.map((v, i) => (
            <div
              key={v.id}
              className={`flex justify-between items-center py-2 ${i < fleetVehicles.length - 1 ? 'border-b border-surface-100 dark:border-surface-800' : ''}`}
            >
              <div className="text-xs font-semibold text-surface-800 dark:text-surface-200">
                {v.id} · {v.name.split(' ').slice(-2).join(' ')}
              </div>
              <div className="flex gap-2 items-center">
                <div className="text-[11px] text-surface-500">{v.status === 'charging' ? 'Now → 100%' : 'Sched. 11pm'}</div>
                <Pill label={`${v.soc}%`} color={statColor(v.soc)} small />
              </div>
            </div>
          ))}
        </EvCard>
        <EvCard>
          <SL>Fleet Health Alerts</SL>
          {[
            { Icon: AlertTriangle, text: 'V-004 Rivian R1T — low SoC (22%), needs charge soon', color: C.red },
            { Icon: Wrench, text: 'V-002 Bolt EUV — battery check recommended at 50k mi', color: C.amber },
            { Icon: CheckCircle2, text: 'V-001 Model 3 — charging complete at 100%', color: C.green },
            { Icon: Calendar, text: 'V-003 F-150 — scheduled maintenance Jun 15', color: C.accent },
          ].map((a, i) => (
            <div key={i} className={`flex gap-2.5 py-2 items-start ${i < 3 ? 'border-b border-surface-100 dark:border-surface-800' : ''}`}>
              <a.Icon size={16} style={{ color: a.color }} className="shrink-0 mt-0.5" />
              <div className="text-xs text-surface-600 dark:text-surface-300 flex-1 leading-relaxed">{a.text}</div>
            </div>
          ))}
        </EvCard>
      </div>
    </div>
  )
}
