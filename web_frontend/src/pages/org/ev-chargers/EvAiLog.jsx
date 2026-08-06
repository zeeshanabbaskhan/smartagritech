import { useState } from 'react'
import {
  Bot, DollarSign, Leaf, Battery, Zap, AlertTriangle, Lock, Plug, Thermometer,
} from 'lucide-react'
import { C, EvCard, SL, AiLogEntry, aiLog, GOAL_DESC } from './evShared'

export default function EvAiLog() {
  const [aiLogFilter, setAiLogFilter] = useState('all')
  const [aiGoal, setAiGoal] = useState('cost')
  const filtered = aiLog.filter((e) => aiLogFilter === 'all' || e.type === aiLogFilter)

  return (
    <div className="space-y-4">
      <div className="page-header !mb-0">
        <h2 className="page-title">AI Decision Log</h2>
        <p className="text-xs text-surface-500 mt-0.5">Every AI action with full reasoning — no black box.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
        <EvCard>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <div className="text-base font-bold text-surface-900 dark:text-surface-100 inline-flex items-center gap-2">
                <Bot size={18} className="text-primary-500" /> AI Decision Log
              </div>
              <div className="text-xs text-surface-500 mt-0.5">Every action the AI has taken — with full reasoning. No black box.</div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'savings', 'schedule', 'grid', 'export', 'fault'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAiLogFilter(f)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize border transition-colors ${
                    aiLogFilter === f
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-surface-50 dark:bg-surface-950 text-surface-600 border-surface-200 dark:border-surface-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {filtered.map((e, i) => (
            <AiLogEntry key={i} time={e.time} action={e.action} reason={e.reason} type={e.type} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-6 text-surface-500 text-[13px]">No log entries for this filter.</div>
          )}
        </EvCard>

        <div className="space-y-3.5">
          <EvCard accent={C.accent}>
            <SL>AI Optimisation Goal</SL>
            <div className="text-[11px] text-surface-500 mb-3">What should the AI prioritise when making charging decisions?</div>
            {[
              { id: 'cost', Icon: DollarSign, label: 'Minimise Cost', sub: 'Off-peak, demand response, V2G' },
              { id: 'green', Icon: Leaf, label: 'Maximise Green Energy', sub: 'Solar first, avoid grid peak' },
              { id: 'battery', Icon: Battery, label: 'Protect Battery Life', sub: '80% cap, slow charge, no heat' },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setAiGoal(g.id)}
                className={`w-full flex gap-3 p-3 rounded-xl text-left mb-2 border transition-colors ${
                  aiGoal === g.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-400'
                }`}
              >
                <g.Icon size={20} className={aiGoal === g.id ? 'text-primary-600' : 'text-surface-500'} />
                <div className="flex-1">
                  <div className={`text-[13px] font-bold ${aiGoal === g.id ? 'text-primary-600' : 'text-surface-900 dark:text-surface-100'}`}>{g.label}</div>
                  <div className="text-[11px] text-surface-500 mt-0.5">{g.sub}</div>
                </div>
                {aiGoal === g.id && (
                  <div className="w-[18px] h-[18px] rounded-full bg-primary-500 flex items-center justify-center text-[11px] text-white shrink-0 mt-0.5">✓</div>
                )}
              </button>
            ))}
            <div className="px-3 py-2.5 rounded-[10px] text-[11px] font-semibold border bg-success-50 dark:bg-success-900/20 border-success-200 text-success-700 dark:text-success-400">
              Active: {GOAL_DESC[aiGoal]}
            </div>
          </EvCard>

          <EvCard>
            <SL>AI Performance This Month</SL>
            {[
              { label: 'Decisions Made', val: '247', Icon: Bot },
              { label: 'Cost Saved', val: '$152', Icon: DollarSign, color: C.green },
              { label: 'CO₂ Avoided', val: '58 kg', Icon: Leaf, color: C.teal },
              { label: 'Grid Signals Acted On', val: '12', Icon: Zap, color: C.amber },
              { label: 'Faults Detected Early', val: '2', Icon: AlertTriangle, color: C.red },
            ].map((m, i, arr) => (
              <div key={m.label} className={`flex justify-between items-center py-2 ${i < arr.length - 1 ? 'border-b border-surface-100 dark:border-surface-800' : ''}`}>
                <div className="flex gap-2 items-center">
                  <m.Icon size={15} className="text-surface-500" />
                  <span className="text-xs text-surface-600 dark:text-surface-300">{m.label}</span>
                </div>
                <span className="text-sm font-bold text-surface-900 dark:text-surface-100" style={m.color ? { color: m.color } : undefined}>{m.val}</span>
              </div>
            ))}
          </EvCard>

          <EvCard>
            <SL>Static Safety Limits</SL>
            <div className="text-[11px] text-surface-500 mb-2.5">These limits are locked — the AI cannot override them regardless of goal.</div>
            {[
              { label: 'Max charge voltage', val: '410 V', Icon: Plug },
              { label: 'Max battery temp', val: '45°C', Icon: Thermometer },
              { label: 'Min reserve (V2G)', val: '20%', Icon: Battery },
              { label: 'Max session power', val: '250 kW', Icon: Zap },
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
