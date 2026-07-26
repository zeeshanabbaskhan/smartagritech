import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, Sun, Fuel, Building2, Boxes, Plus, ChevronDown, PiggyBank, ChevronRight,
  UtensilsCrossed, Flame, Car, Shirt, Snowflake, Refrigerator, Download,
  Edit3, Check, X, Wind, Droplets, Atom, Clock3,
} from 'lucide-react'

/**
 * Power Flow hierarchy — Sources → Total Load → Groups.
 *
 * Features:
 *  • Savings shown in top right of the card, taking <= 1/5 of the width.
 *  • Dropdown panel displays reports vertically and uses absolute positioning to float.
 *  • Savings bar uses indigo/violet theme.
 *  • Editable source values & custom source addition.
 */

function seedNum(str = '') {
  return String(str).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

function iconForGroup(name = '') {
  const n = name.toLowerCase()
  if (/(kitchen|cook|oven|stove)/.test(n)) return UtensilsCrossed
  if (/(boiler|heat|geyser|water)/.test(n)) return Flame
  if (/(ev|charg|car)/.test(n))             return Car
  if (/(wash|laundry)/.test(n))             return Shirt
  if (/(climate|hvac|ac\b|cool)/.test(n))   return Snowflake
  if (/(fridge|refriger|cold)/.test(n))     return Refrigerator
  return Boxes
}

function formatPKR(n = 0) {
  return `₨${Math.round(n).toLocaleString()}`
}

function downloadCSV(filename, rows) {
  const content = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const CUSTOM_GRADIENTS = [
  { from: '#C084FC', to: '#9333EA' },
  { from: '#FB7185', to: '#E11D48' },
  { from: '#2DD4BF', to: '#0D9488' },
  { from: '#60A5FA', to: '#1D4ED8' },
  { from: '#FDE047', to: '#B45309' },
  { from: '#A3E635', to: '#4D7C0F' },
]

const CUSTOM_ICONS = [Wind, Droplets, Atom, Flame, Snowflake, Zap]

export default function PowerFlowMindMap({ powerFlow, orgName, groups = [], onGroupClick, savings }) {
  const [savingsOpen, setSavingsOpen] = useState(false)

  const [sourceOverrides, setSourceOverrides] = useState(() => {
    try {
      const s = localStorage.getItem('cf-ems-source-overrides')
      return s ? JSON.parse(s) : {}
    } catch { return {} }
  })

  const [customSources, setCustomSources] = useState(() => {
    try {
      const s = localStorage.getItem('cf-ems-custom-sources')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })

  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue]   = useState('')

  const [addingSource, setAddingSource]   = useState(false)
  const [newLabel, setNewLabel]           = useState('')
  const [newValue, setNewValue]           = useState('0.0')

  function persistOverrides(next) {
    setSourceOverrides(next)
    localStorage.setItem('cf-ems-source-overrides', JSON.stringify(next))
  }

  function persistCustom(next) {
    setCustomSources(next)
    localStorage.setItem('cf-ems-custom-sources', JSON.stringify(next))
  }

  function startEdit(key, rawVal) {
    setEditingKey(key)
    setEditValue(String(rawVal).replace(/[^\d.]/g, ''))
  }

  function commitEdit(key) {
    const num = parseFloat(editValue)
    if (!isNaN(num)) persistOverrides({ ...sourceOverrides, [key]: num.toFixed(1) })
    setEditingKey(null)
    setEditValue('')
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditValue('')
  }

  function handleAddSource() {
    if (!newLabel.trim()) return
    const idx = customSources.length
    const grad = CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length]
    persistCustom([...customSources, {
      key:   `custom_${Date.now()}`,
      label: newLabel.trim(),
      value: parseFloat(newValue || '0').toFixed(1),
      from:  grad.from,
      to:    grad.to,
      iconIdx: idx % CUSTOM_ICONS.length,
    }])
    setNewLabel('')
    setNewValue('0.0')
    setAddingSource(false)
  }

  function deleteCustomSource(key) {
    persistCustom(customSources.filter(s => s.key !== key))
    if (editingKey === key) cancelEdit()
  }

  const builtInSources = [
    {
      key:   'grid',
      label: 'Grid',
      rawVal: sourceOverrides.grid      ?? powerFlow.grid,
      sub:    powerFlow.gridMode,
      Icon:   Zap,
      from:  '#60A5FA', to: '#2563EB',
    },
    {
      key:   'solar',
      label: 'Solar',
      rawVal: sourceOverrides.solar     ?? powerFlow.solar,
      Icon:   Sun,
      from:  '#FCD34D', to: '#D97706',
    },
    {
      key:   'generator',
      label: 'Generator',
      rawVal: sourceOverrides.generator ?? powerFlow.generator,
      Icon:   Fuel,
      from:  '#6EE7B7', to: '#059669',
    },
  ]

  return (
    <div className="w-full select-none space-y-4">
      {/* ── Top Header Row with Time (left) and Savings widget (right) ── */}
      <div className="flex justify-between items-center w-full relative pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-surface-400">
          <Clock3 size={14} className="text-surface-400" />
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse ml-1" />
        </div>

        {savings && (
          <div className="relative w-full max-w-[200px] z-[99]">
            {/* Savings Button (one-fifth width, contracted) */}
            <button
              type="button"
              onClick={() => setSavingsOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-white transition-all hover:opacity-95 text-left shadow-md"
              style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #9333EA 100%)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <PiggyBank size={14} className="flex-shrink-0" />
                <div className="leading-tight min-w-0">
                  <p className="text-[8px] font-bold opacity-75 uppercase tracking-wider">Today's Savings</p>
                  <p className="text-xs font-black truncate">{formatPKR(savings.daily)}</p>
                </div>
              </div>
              <ChevronDown
                size={12}
                className={`flex-shrink-0 transition-transform duration-200 ${savingsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Absolute Dropdown Panel showing reports in a vertical drop down */}
            {savingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-floating rounded-xl overflow-hidden z-[999] p-1">
                <div className="px-3 py-1.5 bg-indigo-50/60 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 rounded-t-lg">
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                    Savings Reports
                  </p>
                </div>

                <div className="flex flex-col divide-y divide-surface-100 dark:divide-surface-800">
                  {/* Weekly Report */}
                  <div className="p-3 space-y-2 hover:bg-surface-50/50 dark:hover:bg-surface-850/20">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-black text-surface-400 uppercase tracking-wider">Weekly Savings</p>
                        <p className="text-base font-black text-indigo-500">{formatPKR(savings.weekly)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadCSV(`${orgName}_weekly_savings.csv`, [
                          ['Period', 'Offset kWh', 'Savings PKR'],
                          ['Weekly', (savings.dailyKWh * 7).toFixed(1), savings.weekly],
                        ])}
                        className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-wide rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-colors flex-shrink-0"
                      >
                        <Download size={10} strokeWidth={2.5} /> CSV
                      </button>
                    </div>
                    <p className="text-[8px] text-surface-400 font-semibold">
                      {(savings.dailyKWh * 7).toFixed(1)} kWh offset / week
                    </p>
                  </div>

                  {/* Monthly Report */}
                  <div className="p-3 space-y-2 hover:bg-surface-50/50 dark:hover:bg-surface-850/20">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-black text-surface-400 uppercase tracking-wider">Monthly Savings</p>
                        <p className="text-base font-black text-purple-500">{formatPKR(savings.monthly)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadCSV(`${orgName}_monthly_savings.csv`, [
                          ['Period', 'Offset kWh', 'Savings PKR'],
                          ['Monthly', (savings.dailyKWh * 30).toFixed(1), savings.monthly],
                        ])}
                        className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-wide rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800/40 transition-colors flex-shrink-0"
                      >
                        <Download size={10} strokeWidth={2.5} /> CSV
                      </button>
                    </div>
                    <p className="text-[8px] text-surface-400 font-semibold">
                      {(savings.dailyKWh * 30).toFixed(1)} kWh offset / month
                    </p>
                  </div>
                </div>

                <div className="px-3 py-2 bg-surface-50 dark:bg-surface-850 border-t border-surface-100 dark:border-surface-800 text-[8px] text-surface-400 font-semibold rounded-b-lg">
                  ~{savings.dailyKWh} kWh/day offset at PKR 28/kWh
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mind Map Flow ── */}
      <div>
        {/* Level 1 — Sources */}
        <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
          {builtInSources.map(s => (
            <div
              key={s.key}
              className="relative group flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white shadow-lg"
              style={{
                background: `linear-gradient(145deg, ${s.from}, ${s.to})`,
                boxShadow:  `0 6px 16px -4px ${s.to}66`,
              }}
            >
              <s.Icon size={18} strokeWidth={2.25} />
              <div className="leading-tight">
                <p className="text-[11px] font-bold opacity-90">{s.label}</p>

                {editingKey === s.key ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  commitEdit(s.key)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="w-16 text-xs font-black bg-white/25 text-white rounded px-1.5 py-0.5 outline-none border border-white/50 [appearance:textfield]"
                    />
                    <span className="text-[10px] opacity-75">kW</span>
                    <button
                      type="button"
                      onClick={() => commitEdit(s.key)}
                      className="p-0.5 rounded hover:bg-white/20 transition-colors"
                    >
                      <Check size={11} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-0.5 rounded hover:bg-white/20 transition-colors"
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(s.key, s.rawVal)}
                    className="group/val flex items-center gap-1 text-sm font-black leading-tight"
                    title="Click to edit value"
                  >
                    {s.rawVal} kW
                    <Edit3 size={9} className="opacity-0 group-hover/val:opacity-60 transition-opacity" />
                  </button>
                )}

                {s.sub && (
                  <p className="text-[9px] opacity-65 font-semibold mt-0.5">{s.sub}</p>
                )}
              </div>
            </div>
          ))}

          {customSources.map((s, idx) => {
            const Icon = CUSTOM_ICONS[s.iconIdx ?? idx % CUSTOM_ICONS.length]
            return (
              <div
                key={s.key}
                className="relative group flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white shadow-lg"
                style={{
                  background: `linear-gradient(145deg, ${s.from}, ${s.to})`,
                  boxShadow:  `0 6px 16px -4px ${s.to}66`,
                }}
              >
                <Icon size={18} strokeWidth={2.25} />
                <div className="leading-tight">
                  <p className="text-[11px] font-bold opacity-90">{s.label}</p>

                  {editingKey === s.key ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const num = parseFloat(editValue)
                            if (!isNaN(num)) {
                              persistCustom(customSources.map(cs =>
                                cs.key === s.key ? { ...cs, value: num.toFixed(1) } : cs
                              ))
                            }
                            cancelEdit()
                          }
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="w-16 text-xs font-black bg-white/25 text-white rounded px-1.5 py-0.5 outline-none border border-white/50 [appearance:textfield]"
                      />
                      <span className="text-[10px] opacity-75">kW</span>
                      <button
                        type="button"
                        onClick={() => {
                          const num = parseFloat(editValue)
                          if (!isNaN(num)) {
                            persistCustom(customSources.map(cs =>
                              cs.key === s.key ? { ...cs, value: num.toFixed(1) } : cs
                            ))
                          }
                          cancelEdit()
                        }}
                        className="p-0.5 rounded hover:bg-white/20"
                      >
                        <Check size={11} strokeWidth={2.5} />
                      </button>
                      <button type="button" onClick={cancelEdit} className="p-0.5 rounded hover:bg-white/20">
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(s.key, s.value)}
                      className="group/val flex items-center gap-1 text-sm font-black leading-tight"
                    >
                      {s.value} kW
                      <Edit3 size={9} className="opacity-0 group-hover/val:opacity-60 transition-opacity" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => deleteCustomSource(s.key)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 border-2 border-white dark:border-surface-900 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Remove this source"
                >
                  <X size={9} strokeWidth={3} />
                </button>
              </div>
            )
          })}

          {addingSource ? (
            <div className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 shadow-md">
              <input
                type="text"
                autoFocus
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSource(); if (e.key === 'Escape') setAddingSource(false) }}
                placeholder="Source name"
                className="text-xs font-bold w-24 bg-transparent outline-none border-b border-surface-300 dark:border-surface-600 pb-0.5 text-surface-800 dark:text-surface-100"
              />
              <input
                type="number"
                step="0.1"
                min="0"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="kW"
                className="text-xs font-bold w-14 bg-transparent outline-none border-b border-surface-300 dark:border-surface-600 pb-0.5 text-surface-800 dark:text-surface-100 [appearance:textfield]"
              />
              <span className="text-[10px] text-surface-400 font-semibold">kW</span>
              <button
                type="button"
                onClick={handleAddSource}
                disabled={!newLabel.trim()}
                className="p-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-colors"
              >
                <Check size={11} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => { setAddingSource(false); setNewLabel(''); setNewValue('0.0') }}
                className="p-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSource(true)}
              className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 dark:border-surface-700 text-surface-400 hover:text-primary-600 hover:border-primary-400 dark:hover:border-primary-700 transition-colors"
            >
              <Plus size={14} />
              <span className="text-xs font-bold">Add Source</span>
            </button>
          )}
        </div>

        {/* connector */}
        <div className="flex justify-center my-1">
          <div className="w-px h-6 bg-surface-300 dark:bg-surface-700" />
        </div>

        {/* Level 2 — Total Organization Load hub */}
        <div className="flex justify-center">
          <div
            className="flex items-center gap-3 rounded-2xl px-6 py-4 text-white shadow-xl"
            style={{ background: 'linear-gradient(145deg, #34D399, #0EA5E9)', boxShadow: '0 10px 24px -6px rgba(14,165,233,0.45)' }}
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-bold opacity-90">Total Organization Load</p>
              <p className="text-xl font-black">{powerFlow.load.toFixed(1)} kW</p>
            </div>
          </div>
        </div>

        {/* connector */}
        <div className="flex justify-center my-1">
          <div className="w-px h-6 bg-surface-300 dark:bg-surface-700" />
        </div>

        {/* Level 3 — Device Groups (live) */}
        <div className="flex justify-center gap-3 flex-wrap">
          {groups.length === 0 ? (
            <Link
              to="/org/device-groups"
              className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 dark:border-surface-700 text-surface-400 hover:text-primary-600 hover:border-primary-300 transition-colors"
            >
              <Plus size={14} />
              <span className="text-xs font-bold">Create a Device Group</span>
            </Link>
          ) : (
            <>
              {groups.map(g => {
                const Icon = iconForGroup(g.name)
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => onGroupClick?.(g.id)}
                    className="group relative flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-md min-w-[9.5rem] text-left hover:border-violet-300 dark:hover:border-violet-800 hover:shadow-lg transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center flex-shrink-0">
                      <Icon size={15} strokeWidth={2.25} />
                    </div>
                    <div className="leading-tight flex-1 min-w-0">
                      <p className="text-xs font-bold text-surface-800 dark:text-surface-100 truncate max-w-[7rem]">{g.name}</p>
                      <p className="text-[11px] font-black text-violet-600">{g.load?.toFixed(2) ?? '0.00'} kW</p>
                      <p className="text-[9px] text-surface-400 font-semibold">{g.deviceCount} device{g.deviceCount !== 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight size={12} className="text-surface-300 group-hover:text-violet-500 flex-shrink-0 transition-colors" />
                    <span className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-surface-900 ${g.active ? 'bg-success-500' : 'bg-surface-300 dark:bg-surface-600'}`} />
                  </button>
                )
              })}

              <Link
                to="/org/device-groups"
                className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 dark:border-surface-700 text-surface-400 hover:text-primary-600 hover:border-primary-300 transition-colors"
              >
                <Plus size={14} />
                <span className="text-xs font-bold">Manage Groups</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export { seedNum, iconForGroup }
