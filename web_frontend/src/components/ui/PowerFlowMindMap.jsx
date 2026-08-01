import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Zap, Sun, Fuel, Building2, Boxes, Plus, ChevronDown, PiggyBank, ChevronRight,
  UtensilsCrossed, Flame, Car, Shirt, Snowflake, Refrigerator, Download,
  Edit3, X, Wind, Droplets, Atom, Clock3, Cpu,
} from 'lucide-react'
import Modal from './Modal'
import { TextInput, SelectInput } from './FormFields'

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
  return `Rs${Math.round(Number(n) || 0).toLocaleString()}`
}

const TARIFF_PKR_PER_KWH = 28
const EMPTY_SOURCE_FORM = { name: '', type: 'custom', deviceIds: [] }

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
 * Power Flow mind map — Sources (linked to real devices) → Total Load → Device Groups.
 */
export default function PowerFlowMindMap({
  sources = [],
  savings,
  orgName,
  groups = [],
  devices = [],
  totalLoadKw = null,
  onGroupClick,
  onGroupEdit,
  onGroupDelete,
  onSourcesChange,
  editable = true,
  groupsPath = '/org/device-groups',
  devicesPath = '/org/devices',
}) {
  const navigate = useNavigate()
  const [savingsOpen, setSavingsOpen] = useState(false)
  const [localSources, setLocalSources] = useState(sources)
  const [sourceModal, setSourceModal] = useState(null) // 'create' | source object
  const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE_FORM)

  useEffect(() => { setLocalSources(sources) }, [sources])

  function commitSources(next) {
    setLocalSources(next)
    onSourcesChange?.(next)
  }

  function openCreateSource() {
    setSourceForm({ ...EMPTY_SOURCE_FORM })
    setSourceModal('create')
  }

  function openEditSource(source) {
    setSourceForm({
      name: source.name || BUILTIN_META[source.type]?.label || '',
      type: source.type || 'custom',
      deviceIds: [...(source.deviceIds || [])],
    })
    setSourceModal(source)
  }

  function closeSourceModal() {
    setSourceModal(null)
    setSourceForm(EMPTY_SOURCE_FORM)
  }

  function toggleSourceDevice(id) {
    setSourceForm((prev) => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(id)
        ? prev.deviceIds.filter((x) => x !== id)
        : [...prev.deviceIds, id],
    }))
  }

  function saveSourceForm() {
    if (!sourceForm.name.trim()) return
    const isBuiltin = ['grid', 'solar', 'generator'].includes(sourceForm.type)
    // Custom sources must link at least one device; grid may stay derived (no devices)
    if (sourceForm.type !== 'grid' && !sourceForm.deviceIds.length) return

    if (sourceModal === 'create') {
      const idx = localSources.filter((s) => !['grid', 'solar', 'generator'].includes(s.type || s.id)).length
      const grad = CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length]
      const type = sourceForm.type
      // Don't create a second builtin — update existing if type is builtin
      if (isBuiltin) {
        const existing = localSources.find((s) => s.type === type || s.id === type)
        if (existing) {
          commitSources(localSources.map((s) => (
            s.id === existing.id || s.type === type
              ? { ...s, name: sourceForm.name.trim(), deviceIds: [...sourceForm.deviceIds] }
              : s
          )))
          closeSourceModal()
          return
        }
      }
      commitSources([
        ...localSources,
        {
          id: isBuiltin ? type : `custom_${Date.now()}`,
          name: sourceForm.name.trim(),
          type,
          deviceIds: [...sourceForm.deviceIds],
          valueKw: 0,
          from: isBuiltin ? undefined : grad.from,
          to: isBuiltin ? undefined : grad.to,
          iconIdx: isBuiltin ? undefined : idx % CUSTOM_ICONS.length,
        },
      ])
    } else {
      const target = sourceModal
      commitSources(localSources.map((s) => (
        s.id === target.id || (target.type && s.type === target.type && ['grid', 'solar', 'generator'].includes(target.type))
          ? {
              ...s,
              name: sourceForm.name.trim(),
              type: ['grid', 'solar', 'generator'].includes(s.type) ? s.type : sourceForm.type,
              deviceIds: [...sourceForm.deviceIds],
            }
          : s
      )))
    }
    closeSourceModal()
  }

  function deleteCustomSource(key) {
    commitSources(localSources.filter((s) => s.id !== key))
  }

  const load = totalLoadKw != null && Number.isFinite(Number(totalLoadKw))
    ? Number(totalLoadKw)
    : localSources.reduce((sum, s) => sum + (Number(s.valueKw) || 0), 0)

  const builtin = ['grid', 'solar', 'generator'].map((type) => {
    const found = localSources.find((s) => s.type === type || s.id === type)
    const meta = BUILTIN_META[type]
    const deviceIds = found?.deviceIds || []
    return {
      key: type,
      source: found || { id: type, type, name: meta.label, deviceIds: [], valueKw: 0 },
      label: found?.name || meta.label,
      rawVal: found?.valueKw ?? 0,
      Icon: meta.Icon,
      from: meta.from,
      to: meta.to,
      deviceIds,
      derived: type === 'grid' && !deviceIds.length,
    }
  })

  const customs = localSources.filter((s) => !['grid', 'solar', 'generator'].includes(s.type || s.id))

  const solarKw = Number(
    localSources.find((s) => s.type === 'solar' || s.id === 'solar')?.valueKw,
  ) || 0
  const fallbackDailyKWh = +(solarKw * 24).toFixed(1)
  const savingsView = {
    daily: Number(savings?.daily) || Math.round(fallbackDailyKWh * TARIFF_PKR_PER_KWH),
    weekly: Number(savings?.weekly) || Math.round(fallbackDailyKWh * 7 * TARIFF_PKR_PER_KWH),
    monthly: Number(savings?.monthly) || Math.round(fallbackDailyKWh * 30 * TARIFF_PKR_PER_KWH),
    dailyKWh: Number(savings?.dailyKWh) || fallbackDailyKWh,
  }
  const weeklyKWh = +(savingsView.dailyKWh * 7).toFixed(1)
  const monthlyKWh = +(savingsView.dailyKWh * 30).toFixed(1)

  const editingBuiltin = sourceModal && sourceModal !== 'create'
    && ['grid', 'solar', 'generator'].includes(sourceModal.type || sourceModal.id)
  const formRequiresDevice = sourceForm.type !== 'grid'
  const canSaveSource = sourceForm.name.trim()
    && (!formRequiresDevice || sourceForm.deviceIds.length > 0)

  return (
    <div className="w-full select-none space-y-4">
      <div className="flex justify-between items-start w-full relative pb-2 gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-surface-400 pt-2">
          <Clock3 size={14} />
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse ml-1" />
        </div>

        <div className="relative w-full max-w-[220px] z-[99] ml-auto">
          <button
            type="button"
            onClick={() => setSavingsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl text-white transition-all hover:opacity-95 text-left shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 50%, #9333EA 100%)' }}
            aria-expanded={savingsOpen}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <PiggyBank size={16} className="flex-shrink-0 opacity-95" />
              <div className="leading-tight min-w-0">
                <p className="text-[9px] font-bold opacity-80 uppercase tracking-wider">Today&apos;s Savings</p>
                <p className="text-sm font-black truncate">{formatPKR(savingsView.daily)}</p>
              </div>
            </div>
            <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${savingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {savingsOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[998] cursor-default"
                aria-label="Close savings"
                onClick={() => setSavingsOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-floating rounded-2xl overflow-hidden z-[999]">
                <div className="px-4 py-2.5 bg-primary-50 dark:bg-primary-950/40 border-b border-primary-100 dark:border-primary-900">
                  <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest">Savings Reports</p>
                </div>
                <div className="flex flex-col divide-y divide-surface-100 dark:divide-surface-800">
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-surface-400 uppercase tracking-wider">Weekly Savings</p>
                        <p className="text-lg font-black text-primary-600 leading-tight">{formatPKR(savingsView.weekly)}</p>
                        <p className="text-[10px] text-surface-400 font-semibold mt-0.5">{weeklyKWh} kWh offset / week</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadCSV(`${orgName || 'org'}_weekly_savings.csv`, [
                          ['Period', 'Offset kWh', 'Savings PKR'],
                          ['Weekly', weeklyKWh, savingsView.weekly],
                        ])}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 flex-shrink-0"
                      >
                        <Download size={11} /> CSV
                      </button>
                    </div>
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-surface-400 uppercase tracking-wider">Monthly Savings</p>
                        <p className="text-lg font-black text-primary-700 leading-tight">{formatPKR(savingsView.monthly)}</p>
                        <p className="text-[10px] text-surface-400 font-semibold mt-0.5">{monthlyKWh} kWh offset / month</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadCSV(`${orgName || 'org'}_monthly_savings.csv`, [
                          ['Period', 'Offset kWh', 'Savings PKR'],
                          ['Monthly', monthlyKWh, savingsView.monthly],
                        ])}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 flex-shrink-0"
                      >
                        <Download size={11} /> CSV
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2.5 border-t border-surface-100 dark:border-surface-800 bg-surface-50/80 dark:bg-surface-950/40">
                  <p className="text-[10px] font-semibold text-surface-400">
                    ~{Number(savingsView.dailyKWh || 0).toFixed(1)} kWh/day offset at PKR {TARIFF_PKR_PER_KWH}/kWh
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
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
                <p className="text-sm font-black leading-tight">{Number(s.rawVal).toFixed(1)} kW</p>
                <p className="text-[9px] opacity-70 font-semibold mt-0.5">
                  {s.derived
                    ? 'Auto (fleet − other sources)'
                    : s.deviceIds.length
                      ? `${s.deviceIds.length} device${s.deviceIds.length !== 1 ? 's' : ''}`
                      : 'No device linked'}
                </p>
              </div>
              {editable && (
                <button
                  type="button"
                  title="Link devices"
                  onClick={() => openEditSource(s.source)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white/90 text-primary-700 opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-sm"
                >
                  <Edit3 size={9} strokeWidth={2.5} />
                </button>
              )}
            </div>
          ))}

          {customs.map((s, idx) => {
            const Icon = CUSTOM_ICONS[s.iconIdx ?? idx % CUSTOM_ICONS.length]
            const from = s.from || CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length].from
            const to = s.to || CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length].to
            const nDev = (s.deviceIds || []).length
            return (
              <div
                key={s.id}
                className="relative group flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white shadow-lg"
                style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
              >
                <Icon size={18} />
                <div className="leading-tight">
                  <p className="text-[11px] font-bold opacity-90">{s.name}</p>
                  <p className="text-sm font-black">{Number(s.valueKw || 0).toFixed(1)} kW</p>
                  <p className="text-[9px] opacity-70 font-semibold mt-0.5">
                    {nDev ? `${nDev} device${nDev !== 1 ? 's' : ''}` : 'No device linked'}
                  </p>
                </div>
                {editable && (
                  <div className="absolute -top-1.5 -right-1.5 z-[2] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Edit source"
                      onClick={() => openEditSource(s)}
                      className="w-5 h-5 rounded-full bg-white/90 text-primary-700 flex items-center justify-center shadow-sm"
                    >
                      <Edit3 size={9} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      title="Remove source"
                      onClick={() => deleteCustomSource(s.id)}
                      className="w-5 h-5 rounded-full bg-danger-500 border-2 border-white text-white flex items-center justify-center"
                    >
                      <X size={9} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {editable && (
            <button
              type="button"
              onClick={openCreateSource}
              className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 text-surface-400 hover:text-primary-600 hover:border-primary-400"
            >
              <Plus size={14} />
              <span className="text-xs font-bold">Add Source</span>
            </button>
          )}
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
              <p className="text-[9px] font-semibold opacity-75 mt-0.5">Live from device ActivePower</p>
            </div>
          </div>
        </div>

        {savingsView.dailyKWh > 0 && (
          <p className="text-center text-[10px] font-bold text-surface-400 mt-2">
            ~{Number(savingsView.dailyKWh).toFixed(1)} kWh/day offset by clean sources · saving {formatPKR(savingsView.daily)} at PKR {TARIFF_PKR_PER_KWH}/unit
          </p>
        )}

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
                  <div
                    key={g.id}
                    className="group relative flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-md min-w-[9.5rem] text-left hover:border-primary-300 hover:shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => onGroupClick?.(g.id)}
                      className="absolute inset-0 rounded-2xl z-0"
                      aria-label={`Open ${g.name}`}
                    />
                    <span
                      className={`absolute top-2 right-2 w-2 h-2 rounded-full z-[1] ${g.active ? 'bg-success-500 animate-pulse' : 'bg-surface-300 dark:bg-surface-600'} ${(editable && (onGroupEdit || onGroupDelete)) ? 'group-hover:opacity-0' : ''}`}
                      title={g.active ? 'Active' : 'Idle'}
                    />
                    {editable && (onGroupEdit || onGroupDelete) && (
                      <div className="absolute -top-1.5 -right-1.5 z-[2] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onGroupEdit && (
                          <button
                            type="button"
                            title="Edit group"
                            onClick={(e) => { e.stopPropagation(); onGroupEdit(g.id) }}
                            className="w-5 h-5 rounded-full bg-primary-500 border-2 border-white dark:border-surface-900 text-white flex items-center justify-center shadow-sm hover:bg-primary-600"
                          >
                            <Edit3 size={9} strokeWidth={2.5} />
                          </button>
                        )}
                        {onGroupDelete && (
                          <button
                            type="button"
                            title="Delete group"
                            onClick={(e) => { e.stopPropagation(); onGroupDelete(g.id) }}
                            className="w-5 h-5 rounded-full bg-danger-500 border-2 border-white dark:border-surface-900 text-white flex items-center justify-center shadow-sm hover:bg-danger-600"
                          >
                            <X size={9} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-600 flex items-center justify-center relative z-[1] pointer-events-none">
                      <Icon size={15} />
                    </div>
                    <div className="leading-tight flex-1 min-w-0 relative z-[1] pointer-events-none">
                      <p className="text-xs font-bold text-surface-800 dark:text-surface-100 truncate max-w-[7rem]">{g.name}</p>
                      <p className="text-[11px] font-black text-primary-600">{(g.load ?? 0).toFixed?.(2) ?? g.load ?? '0.00'} kW</p>
                      <p className="text-[9px] text-surface-400 font-semibold">
                        {g.deviceCount ?? g.deviceIds?.length ?? 0} device{(g.deviceCount ?? g.deviceIds?.length ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight size={12} className="text-surface-300 group-hover:text-primary-500 relative z-[1] pointer-events-none" />
                  </div>
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

      <Modal
        open={sourceModal !== null}
        onClose={closeSourceModal}
        size="md"
        title={sourceModal === 'create' ? 'Add Power Source' : 'Edit Power Source'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeSourceModal}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!canSaveSource}
              onClick={saveSourceForm}
            >
              {sourceModal === 'create' ? 'Add Source' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Source Name"
            required
            placeholder="e.g. Rooftop Solar, Backup Generator…"
            value={sourceForm.name}
            onChange={(e) => setSourceForm((f) => ({ ...f, name: e.target.value }))}
          />
          <SelectInput
            label="Source Type"
            required
            value={sourceForm.type}
            disabled={editingBuiltin}
            onChange={(e) => setSourceForm((f) => ({ ...f, type: e.target.value }))}
            options={[
              { value: 'custom', label: 'Custom source' },
              { value: 'solar', label: 'Solar' },
              { value: 'generator', label: 'Generator' },
              { value: 'grid', label: 'Grid' },
            ]}
          />
          <div>
            <label className="label">
              Link Devices
              {formRequiresDevice && <span className="text-danger-600 font-bold ml-0.5">*</span>}
              <span className="ml-1 text-surface-400 font-normal">({sourceForm.deviceIds.length})</span>
            </label>
            <p className="text-[11px] text-surface-400 mb-2">
              {sourceForm.type === 'grid'
                ? 'Optional — leave empty to auto-calculate Grid as fleet load minus other sources. Or link grid meter device(s).'
                : 'Select the real device(s) that feed this source. Live kW comes from their ActivePower.'}
            </p>
            {devices.length === 0 ? (
              <div className="p-3 inset-panel space-y-3">
                <p className="text-xs text-surface-500">No devices available. Add a device first.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    closeSourceModal()
                    navigate(devicesPath)
                  }}
                >
                  <Cpu size={14} /> Go to Devices
                </button>
              </div>
            ) : (
              <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-56 overflow-y-auto">
                {devices.map((d) => (
                  <label key={d.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800">
                    <input
                      type="checkbox"
                      className="rounded border-surface-300 text-primary-600"
                      checked={sourceForm.deviceIds.includes(d.id)}
                      onChange={() => toggleSourceDevice(d.id)}
                    />
                    <Cpu size={13} className="text-surface-400 flex-shrink-0" />
                    <span className="text-sm text-surface-800 dark:text-surface-100 flex-1">{d.name}</span>
                    <span className={`badge text-[9px] ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                      {d.status}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {formRequiresDevice && devices.length > 0 && sourceForm.deviceIds.length === 0 && (
              <p className="text-[11px] text-danger-600 mt-1.5 font-semibold">Select at least one device</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export { iconForGroup }
