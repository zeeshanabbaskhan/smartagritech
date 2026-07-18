import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, Sun, Fuel, Building2, Boxes, Plus, ChevronDown, PiggyBank, ChevronRight,
  UtensilsCrossed, Flame, Car, Shirt, Snowflake, Refrigerator, Download,
  Edit3, Check, X, Wind, Droplets, Atom, Clock3,
} from 'lucide-react'

function iconForGroup(name = '') {
  const n = name.toLowerCase()
  if (/(kitchen|cook|oven|stove)/.test(n)) return UtensilsCrossed
  if (/(boiler|heat|geyser|water)/.test(n)) return Flame
  if (/(ev|charg|car)/.test(n)) return Car
  if (/(wash|laundry)/.test(n)) return Shirt
  if (/(climate|hvac|ac\b|cool)/.test(n)) return Snowflake
  if (/(fridge|refriger|cold)/.test(n)) return Refrigerator
  return Boxes
}

function formatPKR(n = 0) {
  return `₨${Math.round(n).toLocaleString()}`
}

function downloadCSV(filename, rows) {
  const content = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
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

const BUILTIN_META = {
  grid: { label: 'Grid', Icon: Zap, from: '#60A5FA', to: '#2563EB' },
  solar: { label: 'Solar', Icon: Sun, from: '#FCD34D', to: '#D97706' },
  generator: { label: 'Generator', Icon: Fuel, from: '#6EE7B7', to: '#059669' },
}

/**
 * Power Flow mind map — Sources → Total Load → Device Groups.
 * Sources/savings come from emsApi (getPowerFlow / updatePowerFlow).
 */
export default function PowerFlowMindMap({
  sources = [],
  savings,
  orgName,
  groups = [],
  onGroupClick,
  onSourcesChange,
  editable = true,
  groupsPath = '/org/device-groups',
}) {
  const [savingsOpen, setSavingsOpen] = useState(false)
  const [localSources, setLocalSources] = useState(sources)
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [addingSource, setAddingSource] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('0.0')

  useEffect(() => { setLocalSources(sources) }, [sources])

  function commitSources(next) {
    setLocalSources(next)
    onSourcesChange?.(next)
  }

  function startEdit(key, rawVal) {
    if (!editable) return
    setEditingKey(key)
    setEditValue(String(rawVal).replace(/[^\d.]/g, ''))
  }

  function commitEdit(key) {
    const num = parseFloat(editValue)
    if (!isNaN(num)) {
      commitSources(localSources.map((s) => (
        s.id === key || s.type === key ? { ...s, valueKw: Number(num.toFixed(1)) } : s
      )))
    }
    setEditingKey(null)
    setEditValue('')
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditValue('')
  }

  function handleAddSource() {
    if (!newLabel.trim()) return
    const idx = localSources.filter((s) => !['grid', 'solar', 'generator'].includes(s.type || s.id)).length
    const grad = CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length]
    commitSources([
      ...localSources,
      {
        id: `custom_${Date.now()}`,
        name: newLabel.trim(),
        type: 'custom',
        valueKw: parseFloat(newValue || '0') || 0,
        from: grad.from,
        to: grad.to,
        iconIdx: idx % CUSTOM_ICONS.length,
      },
    ])
    setNewLabel('')
    setNewValue('0.0')
    setAddingSource(false)
  }

  function deleteCustomSource(key) {
    commitSources(localSources.filter((s) => s.id !== key))
    if (editingKey === key) cancelEdit()
  }

  const load = localSources.reduce((sum, s) => sum + (Number(s.valueKw) || 0), 0)

  const builtin = ['grid', 'solar', 'generator'].map((type) => {
    const found = localSources.find((s) => s.type === type || s.id === type)
    const meta = BUILTIN_META[type]
    return {
      key: type,
      label: found?.name || meta.label,
      rawVal: found?.valueKw ?? 0,
      Icon: meta.Icon,
      from: meta.from,
      to: meta.to,
      sub: type === 'grid' ? (found?.mode || null) : null,
    }
  })

  const customs = localSources.filter((s) => !['grid', 'solar', 'generator'].includes(s.type || s.id))

  const savingsView = savings && typeof savings === 'object' ? {
    daily: savings.daily ?? 0,
    weekly: savings.weekly ?? 0,
    monthly: savings.monthly ?? 0,
    dailyKWh: savings.dailyKWh ?? 0,
  } : null

  return (
    <div className="w-full select-none space-y-4">
      <div className="flex justify-between items-center w-full relative pb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-surface-400">
          <Clock3 size={14} />
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse ml-1" />
        </div>

        {savingsView && (
          <div className="relative w-full max-w-[200px] z-[99]">
            <button
              type="button"
              onClick={() => setSavingsOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-white transition-all hover:opacity-95 text-left shadow-md"
              style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #9333EA 100%)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <PiggyBank size={14} className="flex-shrink-0" />
                <div className="leading-tight min-w-0">
                  <p className="text-[8px] font-bold opacity-75 uppercase tracking-wider">Today&apos;s Savings</p>
                  <p className="text-xs font-black truncate">{formatPKR(savingsView.daily)}</p>
                </div>
              </div>
              <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${savingsOpen ? 'rotate-180' : ''}`} />
            </button>

            {savingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-surface-200 shadow-floating rounded-xl overflow-hidden z-[999] p-1">
                <div className="px-3 py-1.5 bg-primary-50 border-b border-primary-100 rounded-t-lg">
                  <p className="text-[9px] font-black text-primary-600 uppercase tracking-widest">Savings Reports</p>
                </div>
                <div className="flex flex-col divide-y divide-surface-100">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-black text-surface-400 uppercase tracking-wider">Weekly</p>
                        <p className="text-base font-black text-primary-600">{formatPKR(savingsView.weekly)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadCSV(`${orgName}_weekly_savings.csv`, [
                          ['Period', 'Offset kWh', 'Savings PKR'],
                          ['Weekly', (savingsView.dailyKWh * 7).toFixed(1), savingsView.weekly],
                        ])}
                        className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase rounded-lg bg-primary-50 text-primary-600"
                      >
                        <Download size={10} /> CSV
                      </button>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-black text-surface-400 uppercase tracking-wider">Monthly</p>
                        <p className="text-base font-black text-primary-700">{formatPKR(savingsView.monthly)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadCSV(`${orgName}_monthly_savings.csv`, [
                          ['Period', 'Offset kWh', 'Savings PKR'],
                          ['Monthly', (savingsView.dailyKWh * 30).toFixed(1), savingsView.monthly],
                        ])}
                        className="flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase rounded-lg bg-primary-50 text-primary-700"
                      >
                        <Download size={10} /> CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex justify-center gap-3 sm:gap-4 flex-wrap">
          {builtin.map((s) => (
            <div
              key={s.key}
              className="relative group flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white shadow-lg"
              style={{ background: `linear-gradient(145deg, ${s.from}, ${s.to})`, boxShadow: `0 6px 16px -4px ${s.to}66` }}
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
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(s.key)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="w-16 text-xs font-black bg-white/25 text-white rounded px-1.5 py-0.5 outline-none border border-white/50"
                    />
                    <span className="text-[10px] opacity-75">kW</span>
                    <button type="button" onClick={() => commitEdit(s.key)} className="p-0.5 rounded hover:bg-white/20">
                      <Check size={11} />
                    </button>
                    <button type="button" onClick={cancelEdit} className="p-0.5 rounded hover:bg-white/20">
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(s.key, s.rawVal)}
                    className="group/val flex items-center gap-1 text-sm font-black leading-tight"
                    title={editable ? 'Click to edit' : undefined}
                  >
                    {Number(s.rawVal).toFixed(1)} kW
                    {editable && <Edit3 size={9} className="opacity-0 group-hover/val:opacity-60" />}
                  </button>
                )}
                {s.sub && <p className="text-[9px] opacity-65 font-semibold mt-0.5">{s.sub}</p>}
              </div>
            </div>
          ))}

          {customs.map((s, idx) => {
            const Icon = CUSTOM_ICONS[s.iconIdx ?? idx % CUSTOM_ICONS.length]
            const from = s.from || CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length].from
            const to = s.to || CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length].to
            return (
              <div
                key={s.id}
                className="relative group flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white shadow-lg"
                style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
              >
                <Icon size={18} />
                <div className="leading-tight">
                  <p className="text-[11px] font-bold opacity-90">{s.name}</p>
                  {editingKey === s.id ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(s.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        className="w-16 text-xs font-black bg-white/25 text-white rounded px-1.5 py-0.5 outline-none border border-white/50"
                      />
                      <button type="button" onClick={() => commitEdit(s.id)} className="p-0.5"><Check size={11} /></button>
                      <button type="button" onClick={cancelEdit} className="p-0.5"><X size={11} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => startEdit(s.id, s.valueKw)} className="text-sm font-black">
                      {Number(s.valueKw || 0).toFixed(1)} kW
                    </button>
                  )}
                </div>
                {editable && (
                  <button
                    type="button"
                    onClick={() => deleteCustomSource(s.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger-500 border-2 border-white text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                  >
                    <X size={9} strokeWidth={3} />
                  </button>
                )}
              </div>
            )
          })}

          {editable && (addingSource ? (
            <div className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 bg-white border border-surface-300 shadow-md">
              <input
                type="text"
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); if (e.key === 'Escape') setAddingSource(false) }}
                placeholder="Source name"
                className="text-xs font-bold w-24 bg-transparent outline-none border-b border-surface-300 pb-0.5"
              />
              <input
                type="number"
                step="0.1"
                min="0"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="text-xs font-bold w-14 bg-transparent outline-none border-b border-surface-300 pb-0.5"
              />
              <button type="button" onClick={handleAddSource} disabled={!newLabel.trim()} className="p-1.5 rounded-lg bg-primary-500 text-white disabled:opacity-40">
                <Check size={11} />
              </button>
              <button type="button" onClick={() => setAddingSource(false)} className="p-1.5 rounded-lg bg-surface-200">
                <X size={11} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSource(true)}
              className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 text-surface-400 hover:text-primary-600 hover:border-primary-400"
            >
              <Plus size={14} />
              <span className="text-xs font-bold">Add Source</span>
            </button>
          ))}
        </div>

        <div className="flex justify-center my-1"><div className="w-px h-6 bg-surface-300" /></div>

        <div className="flex justify-center">
          <div
            className="flex items-center gap-3 rounded-2xl px-6 py-4 text-white shadow-xl"
            style={{ background: 'linear-gradient(145deg, #34D399, #0EA5E9)' }}
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Building2 size={22} />
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-bold opacity-90">Total Organization Load</p>
              <p className="text-xl font-black">{load.toFixed(1)} kW</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center my-1"><div className="w-px h-6 bg-surface-300" /></div>

        <div className="flex justify-center gap-3 flex-wrap">
          {groups.length === 0 ? (
            <Link
              to={groupsPath}
              className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 text-surface-400 hover:text-primary-600"
            >
              <Plus size={14} />
              <span className="text-xs font-bold">Create a Device Group</span>
            </Link>
          ) : (
            <>
              {groups.map((g) => {
                const Icon = iconForGroup(g.name)
                return (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => onGroupClick?.(g.id)}
                    className="group relative flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 bg-white border border-surface-200 shadow-md min-w-[9.5rem] text-left hover:border-primary-300 hover:shadow-lg"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                      <Icon size={15} />
                    </div>
                    <div className="leading-tight flex-1 min-w-0">
                      <p className="text-xs font-bold text-surface-800 truncate max-w-[7rem]">{g.name}</p>
                      <p className="text-[11px] font-black text-primary-600">{(g.load ?? 0).toFixed?.(2) ?? g.load ?? '0.00'} kW</p>
                      <p className="text-[9px] text-surface-400 font-semibold">
                        {g.deviceCount ?? g.deviceIds?.length ?? 0} device{(g.deviceCount ?? g.deviceIds?.length ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight size={12} className="text-surface-300 group-hover:text-primary-500" />
                  </button>
                )
              })}
              <Link
                to={groupsPath}
                className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 text-surface-400 hover:text-primary-600"
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

export { iconForGroup }
