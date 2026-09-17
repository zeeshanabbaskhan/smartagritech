import { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Zap, Sun, Fuel, Building2, Boxes, Plus, ChevronDown, PiggyBank, ChevronRight,
  UtensilsCrossed, Flame, Car, Shirt, Snowflake, Refrigerator, Download,
  Edit3, X, Wind, Droplets, Atom, Clock3, Cpu,
} from 'lucide-react'
import Modal from './Modal'
import { TextInput, SelectInput } from './FormFields'
import { readDeviceMetric } from '../../utils/deviceMetrics'

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
const BUILTIN_TYPES = ['grid', 'solar', 'generator']
const DEFAULT_SITES = [
  { id: 'site-1', name: 'Site 1', isDefault: true },
]
const EMPTY_SOURCE_FORM = { name: '', type: '', deviceIds: [], slaveIds: [], siteId: 'site-1' }

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

function formatLinkedSummary(devIds = [], slvIds = []) {
  const nDev = (devIds || []).length
  const nSlv = (slvIds || []).length
  if (nSlv && nDev) return `${nSlv} slave${nSlv !== 1 ? 's' : ''}, ${nDev} device${nDev !== 1 ? 's' : ''}`
  if (nSlv) return `${nSlv} slave${nSlv !== 1 ? 's' : ''}`
  if (nDev) return `${nDev} device${nDev !== 1 ? 's' : ''}`
  return 'No slave/device linked'
}

function titleCase(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Visual identity (gradient + icon) for a source card or a cross-site type roll-up. */
function metaForType(type, idx = 0) {
  if (BUILTIN_META[type]) return BUILTIN_META[type]
  const grad = CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length]
  return { label: titleCase(type || 'Custom'), Icon: CUSTOM_ICONS[idx % CUSTOM_ICONS.length], ...grad }
}

/** Orthogonal "circuit board" path from (x1,y1) down to (x2,y2) with rounded elbows. */
function circuitPath(x1, y1, x2, y2) {
  if (Math.abs(x2 - x1) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`
  const my = (y1 + y2) / 2
  const r = Math.min(8, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2)
  const dir = x2 > x1 ? 1 : -1
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${my - r}`,
    `Q ${x1} ${my} ${x1 + dir * r} ${my}`,
    `L ${x2 - dir * r} ${my}`,
    `Q ${x2} ${my} ${x2} ${my + r}`,
    `L ${x2} ${y2}`,
  ].join(' ')
}

/**
 * Power Flow mind map — Sites → site sources → cross-site type totals →
 * Total Organization Load → Device Groups.
 */
export default function PowerFlowMindMap({
  sources = [],
  sites = [],
  savings,
  orgName,
  groups = [],
  devices = [],
  totalLoadKw = null,
  onGroupClick,
  onGroupEdit,
  onGroupDelete,
  onSourcesChange,
  onSitesChange,
  onSavePowerFlow,
  editable = true,
  groupsPath = '/org/device-groups',
  devicesPath = '/org/devices',
}) {
  const navigate = useNavigate()
  const [savingsOpen, setSavingsOpen] = useState(false)
  const [localSources, setLocalSources] = useState(sources)
  const [localSites, setLocalSites] = useState(sites.length ? sites : DEFAULT_SITES)
  const [sourceModal, setSourceModal] = useState(null) // 'create' | source object
  const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE_FORM)
  const [renamingSiteId, setRenamingSiteId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Tracks only the source-modal submit, so a background site save can't leave
  // the modal button stuck in its "Saving..." state.
  const [sourceSaving, setSourceSaving] = useState(false)

  // While a save is in flight, keep the optimistic local state — an intermediate
  // poll of the parent's props would otherwise flash the pre-save values back in.
  useEffect(() => { if (!isSaving) setLocalSources(sources) }, [sources, isSaving])
  // Sites only ever come back from the server; an empty prop means the poll
  // hasn't resolved yet, so never let it wipe an already configured site list.
  useEffect(() => {
    if (isSaving || !sites.length) return
    setLocalSites(sites)
  }, [sites, isSaving])

  const defaultSiteId = (localSites.find((s) => s.isDefault) || localSites[0] || DEFAULT_SITES[0]).id

  /** Sources with a guaranteed, resolvable siteId. */
  const scopedSources = useMemo(() => {
    const ids = new Set(localSites.map((s) => s.id))
    return (localSources || []).map((s) => ({
      ...s,
      siteId: s.siteId && ids.has(s.siteId) ? s.siteId : defaultSiteId,
    }))
  }, [localSources, localSites, defaultSiteId])

  const siteTotals = useMemo(() => {
    const totals = {}
    for (const site of localSites) totals[site.id] = 0
    for (const s of scopedSources) totals[s.siteId] = (totals[s.siteId] || 0) + (Number(s.valueKw) || 0)
    return totals
  }, [scopedSources, localSites])

  /** Cross-site roll-ups, builtins first then any custom types actually present. */
  const typeTotals = useMemo(() => {
    const totals = new Map()
    for (const t of BUILTIN_TYPES) totals.set(t, 0)
    for (const s of scopedSources) {
      const t = s.type || s.id || 'custom'
      totals.set(t, (totals.get(t) || 0) + (Number(s.valueKw) || 0))
    }
    return [...totals.entries()].map(([type, kw], idx) => ({
      type,
      kw,
      ...metaForType(type, idx),
      label: BUILTIN_META[type] ? `Total ${BUILTIN_META[type].label}` : `Total ${titleCase(type)}`,
    }))
  }, [scopedSources])

  /**
   * Persist sites and sources together in a single call, so a change that
   * touches both (deleting a site and re-homing its sources) can never land
   * half-applied. Falls back to the legacy split callbacks when the parent
   * doesn't provide an atomic handler.
   */
  async function commitPowerFlow({ sources: nextSources, sites: nextSites }) {
    setIsSaving(true)
    try {
      if (onSavePowerFlow) {
        await onSavePowerFlow({ sources: nextSources, sites: nextSites })
      } else {
        await onSitesChange?.(nextSites)
        await onSourcesChange?.(nextSources)
      }
      setLocalSites(nextSites)
      setLocalSources(nextSources)
    } catch {
      // parent surfaces the error; keep the last confirmed state
      throw new Error('save-failed')
    } finally {
      setIsSaving(false)
    }
  }

  function commitSources(next) {
    return commitPowerFlow({ sources: next, sites: localSites }).catch(() => {})
  }

  // ---- Sites -------------------------------------------------------------
  function addSite() {
    if (isSaving) return
    const nextSites = [
      ...localSites,
      { id: `site_${Date.now()}`, name: `Site ${localSites.length + 1}`, isDefault: false },
    ]
    setLocalSites(nextSites)
    commitPowerFlow({ sites: nextSites, sources: localSources }).catch(() => {})
  }

  function startRename(site) {
    if (!editable) return
    setRenamingSiteId(site.id)
    setRenameValue(site.name || '')
  }

  function commitRename() {
    const name = renameValue.trim()
    if (name) {
      const nextSites = localSites.map((s) => (s.id === renamingSiteId ? { ...s, name } : s))
      setLocalSites(nextSites)
      commitPowerFlow({ sites: nextSites, sources: localSources }).catch(() => {})
    }
    setRenamingSiteId(null)
    setRenameValue('')
  }

  function deleteSite(site) {
    if (isSaving || localSites.length <= 1) return
    const remaining = localSites.filter((s) => s.id !== site.id)
    // Deleting the default site promotes the first survivor, so exactly one
    // site always stays default.
    if (site.isDefault) remaining[0] = { ...remaining[0], isDefault: true }
    const fallback = (remaining.find((s) => s.isDefault) || remaining[0]).id
    // Re-home the deleted site's sources so no kW is lost from the org total
    const rehomedSources = localSources.map((s) => (
      s.siteId === site.id ? { ...s, siteId: fallback } : s
    ))
    setLocalSites(remaining)
    setLocalSources(rehomedSources)
    commitPowerFlow({ sites: remaining, sources: rehomedSources }).catch(() => {})
  }

  // ---- Sources -----------------------------------------------------------
  function openCreateSource(siteId) {
    setSourceForm({ ...EMPTY_SOURCE_FORM, type: '', siteId: siteId || defaultSiteId })
    setSourceSaving(false)
    setSourceModal('create')
  }

  function openEditSource(source) {
    setSourceForm({
      name: source.name || BUILTIN_META[source.type]?.label || '',
      type: source.type || 'custom',
      deviceIds: [...(source.deviceIds || [])],
      slaveIds: [...(source.slaveIds || [])],
      siteId: source.siteId || defaultSiteId,
    })
    setSourceSaving(false)
    setSourceModal(source)
  }

  function closeSourceModal() {
    setSourceModal(null)
    setSourceForm(EMPTY_SOURCE_FORM)
    setSourceSaving(false)
  }

  function toggleSourceDevice(id) {
    setSourceForm((prev) => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(id)
        ? prev.deviceIds.filter((x) => x !== id)
        : [...prev.deviceIds, id],
    }))
  }

  function toggleSourceSlave(slaveId) {
    setSourceForm((prev) => ({
      ...prev,
      slaveIds: (prev.slaveIds || []).includes(slaveId)
        ? prev.slaveIds.filter((x) => x !== slaveId)
        : [...(prev.slaveIds || []), slaveId],
    }))
  }

  async function saveSourceForm() {
    if (!sourceForm.name.trim()) return
    if (!sourceForm.type) return
    const hasLinked = sourceForm.deviceIds.length > 0 || (sourceForm.slaveIds && sourceForm.slaveIds.length > 0)
    if (!hasLinked) return

    const type = sourceForm.type
    const isBuiltin = BUILTIN_TYPES.includes(type)
    const siteId = sourceForm.siteId || defaultSiteId

    let next
    if (sourceModal === 'create') {
      const idx = localSources.filter((s) => !BUILTIN_TYPES.includes(s.type || s.id)).length
      const grad = CUSTOM_GRADIENTS[idx % CUSTOM_GRADIENTS.length]
      // A type may now exist once per site, so only the first builtin keeps the bare id
      const idTaken = localSources.some((s) => s.id === type)
      next = [
        ...localSources,
        {
          id: isBuiltin && !idTaken ? type : `${isBuiltin ? type : 'custom'}_${Date.now()}`,
          name: sourceForm.name.trim(),
          type,
          siteId,
          deviceIds: [...sourceForm.deviceIds],
          slaveIds: [...(sourceForm.slaveIds || [])],
          valueKw: 0,
          // Builtin types keep their own identity gradient; only custom sources
          // get a rotating palette entry and icon.
          from: isBuiltin ? BUILTIN_META[type].from : grad.from,
          to: isBuiltin ? BUILTIN_META[type].to : grad.to,
          iconIdx: isBuiltin ? undefined : idx % CUSTOM_ICONS.length,
        },
      ]
    } else {
      const target = sourceModal
      next = localSources.map((s) => (
        s.id === target.id
          ? {
              ...s,
              name: sourceForm.name.trim(),
              type: BUILTIN_TYPES.includes(s.type) ? s.type : type,
              siteId,
              deviceIds: [...sourceForm.deviceIds],
              slaveIds: [...(sourceForm.slaveIds || [])],
            }
          : s
      ))
    }

    try {
      setSourceSaving(true)
      await commitPowerFlow({ sources: next, sites: localSites })
      closeSourceModal()
    } catch {
      // parent surfaces the error; leave the modal open so the edit isn't lost
    } finally {
      setSourceSaving(false)
    }
  }

  function deleteSource(id) {
    const next = localSources.filter((s) => s.id !== id)
    setLocalSources(next)
    commitSources(next)
  }

  function deleteSourceFromModal() {
    if (!sourceModal || sourceModal === 'create') return
    deleteSource(sourceModal.id)
    closeSourceModal()
  }

  // ---- Connector geometry ------------------------------------------------
  const flowRef = useRef(null)
  const sourceRefs = useRef(new Map())
  const typeRefs = useRef(new Map())
  const orgRef = useRef(null)
  const [links, setLinks] = useState([])

  const registerRef = useCallback((map, key) => (el) => {
    if (el) map.current.set(key, el)
    else map.current.delete(key)
  }, [])

  const measureLinks = useCallback(() => {
    const host = flowRef.current
    if (!host) return
    const base = host.getBoundingClientRect()
    const next = []
    const bottomOf = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - base.left + r.width / 2, y: r.bottom - base.top }
    }
    const topOf = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - base.left + r.width / 2, y: r.top - base.top }
    }

    for (const s of scopedSources) {
      const from = sourceRefs.current.get(s.id)
      const to = typeRefs.current.get(s.type || s.id || 'custom')
      if (!from || !to) continue
      const a = bottomOf(from)
      const b = topOf(to)
      if (b.y <= a.y) continue
      next.push({ key: `src-${s.id}`, d: circuitPath(a.x, a.y, b.x, b.y) })
    }

    if (orgRef.current) {
      const b = topOf(orgRef.current)
      for (const t of typeTotals) {
        const from = typeRefs.current.get(t.type)
        if (!from) continue
        const a = bottomOf(from)
        if (b.y <= a.y) continue
        next.push({ key: `type-${t.type}`, d: circuitPath(a.x, a.y, b.x, b.y) })
      }
    }

    setLinks((prev) => (
      prev.length === next.length && prev.every((p, i) => p.key === next[i].key && p.d === next[i].d)
        ? prev
        : next
    ))
  }, [scopedSources, typeTotals])

  useLayoutEffect(() => { measureLinks() }, [measureLinks])

  useEffect(() => {
    const host = flowRef.current
    if (!host || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => measureLinks())
    ro.observe(host)
    window.addEventListener('resize', measureLinks)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measureLinks)
    }
  }, [measureLinks])

  // ---- Derived numbers ---------------------------------------------------
  const sourcesSum = scopedSources.reduce((acc, s) => acc + (Number(s.valueKw) || 0), 0)
  const load = totalLoadKw != null && Number.isFinite(Number(totalLoadKw)) && Number(totalLoadKw) >= 0
    ? Number(totalLoadKw)
    : sourcesSum

  const solarKw = scopedSources
    .filter((s) => s.type === 'solar' || s.id === 'solar')
    .reduce((acc, s) => acc + (Number(s.valueKw) || 0), 0)
  const SOLAR_PEAK_SUN_HOURS = 5.5
  const fallbackDailyKWh = +(solarKw * SOLAR_PEAK_SUN_HOURS).toFixed(1)
  const dailyKWh = Number(savings?.dailyKWh) > 0 ? Number(savings.dailyKWh) : fallbackDailyKWh
  const dailySavings = Number(savings?.daily) > 0 ? Number(savings.daily) : Math.round(dailyKWh * TARIFF_PKR_PER_KWH)
  const weeklySavings = Number(savings?.weekly) > 0 ? Number(savings.weekly) : Math.round(dailyKWh * 7 * TARIFF_PKR_PER_KWH)
  const monthlySavings = Number(savings?.monthly) > 0 ? Number(savings.monthly) : Math.round(dailyKWh * 30 * TARIFF_PKR_PER_KWH)

  const savingsView = {
    daily: dailySavings,
    weekly: weeklySavings,
    monthly: monthlySavings,
    dailyKWh,
  }
  const weeklyKWh = +(dailyKWh * 7).toFixed(1)
  const monthlyKWh = +(dailyKWh * 30).toFixed(1)

  const editingBuiltin = sourceModal && sourceModal !== 'create'
    && BUILTIN_TYPES.includes(sourceModal.type || sourceModal.id)
  const canSaveSource = sourceForm.name.trim()
    && Boolean(sourceForm.type)
    && ((sourceForm.deviceIds?.length || 0) + (sourceForm.slaveIds?.length || 0) > 0)

  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  /** One source card — identical styling to the pre-site layout. */
  function renderSourceCard(s, idx) {
    const type = s.type || s.id
    const meta = metaForType(type, s.iconIdx ?? idx)
    const Icon = meta.Icon
    const from = BUILTIN_META[type] ? meta.from : (s.from || meta.from)
    const to = BUILTIN_META[type] ? meta.to : (s.to || meta.to)
    return (
      <div
        key={s.id}
        ref={registerRef(sourceRefs, s.id)}
        className="relative group flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white shadow-lg"
        style={{ background: `linear-gradient(145deg, ${from}, ${to})`, boxShadow: `0 6px 16px -4px ${to}66` }}
      >
        <Icon size={18} strokeWidth={2.25} />
        <div className="leading-tight">
          <p className="text-[11px] font-bold opacity-90">{s.name || meta.label}</p>
          <p className="text-sm font-black leading-tight">{Number(s.valueKw || 0).toFixed(1)} kW</p>
          <p className="text-[9px] opacity-70 font-semibold mt-0.5">
            {formatLinkedSummary(s.deviceIds, s.slaveIds)}
          </p>
        </div>
        {editable && (
          <div className="absolute -top-1.5 -right-1.5 z-[2] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title="Link slaves or devices"
              onClick={() => openEditSource(s)}
              className="w-5 h-5 rounded-full bg-white/90 text-primary-700 flex items-center justify-center shadow-sm"
            >
              <Edit3 size={9} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              title="Remove source"
              onClick={() => deleteSource(s.id)}
              className="w-5 h-5 rounded-full bg-danger-500 border-2 border-white text-white flex items-center justify-center"
            >
              <X size={9} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full select-none space-y-4">
      <div className="flex justify-between items-start w-full relative pb-2 gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-surface-400 pt-2">
          <Clock3 size={14} className="text-primary-400" />
          <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
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

      <div ref={flowRef} className="relative">
        {/* Connectors: sources → type totals → organization load. Measured, so they reflow. */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0 text-surface-300 dark:text-surface-700"
          aria-hidden="true"
        >
          {links.map((l) => (
            <path
              key={l.key}
              d={l.d}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div className="relative z-[1]">
          {/* LAYER 1 — site groupings: a plain outlined panel per site */}
          <div className="flex justify-center items-start gap-4 flex-wrap">
            {localSites.map((site) => {
              const siteSources = scopedSources.filter((s) => s.siteId === site.id)
              const canDelete = editable && localSites.length > 1
              return (
                <div
                  key={site.id}
                  className="group/site relative flex flex-col items-center gap-2 rounded-2xl p-3 border border-surface-200 dark:border-surface-800 min-w-[340px]"
                >
                  {/* TOP — site name card + total site load */}
                  <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center px-1 pb-1">
                  <div className="justify-self-start rounded-2xl px-3.5 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm flex items-center gap-2">
                    {renamingSiteId === site.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setRenamingSiteId(null)
                        }}
                        className="text-xs font-bold text-center bg-transparent border-b border-primary-400 outline-none w-28 text-surface-700 dark:text-surface-200"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startRename(site)}
                          title={editable ? 'Rename site' : undefined}
                          className="text-xs font-bold text-surface-500 dark:text-surface-300 hover:text-primary-600"
                        >
                          {site.name}
                        </button>
                        <button
                          type="button"
                          title="Rename site"
                          onClick={() => startRename(site)}
                          className="w-5 h-5 rounded-full bg-surface-100 dark:bg-surface-800 text-primary-600 flex items-center justify-center"
                        >
                          <Edit3 size={9} strokeWidth={2.5} />
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        title="Remove site"
                        onClick={() => deleteSite(site)}
                        className="w-5 h-5 rounded-full bg-danger-500 border-2 border-white dark:border-surface-900 text-white flex items-center justify-center"
                      >
                        <X size={9} strokeWidth={3} />
                      </button>
                    )}
                  </div>

                    {/* Styled Total Site Load Card */}
                    <div
                      className="justify-self-center flex items-center gap-2.5 rounded-2xl px-3.5 py-2 text-white shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.45)',
                      }}
                    >
                      <Zap size={15} strokeWidth={2.5} className="text-indigo-200" />
                      <div className="leading-tight">
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Total Site Load</p>
                        <p className="text-sm font-black leading-tight text-white">
                          {Number(siteTotals[site.id] || 0).toFixed(1)} <span className="text-[11px] font-semibold opacity-90">kW</span>
                        </p>
                      </div>
                    </div>

                    {/* Right: empty spacer balancing the left column */}
                    <div className="justify-self-end" aria-hidden="true" />
                  </div>

                  {/* MIDDLE — this site's sources */}
                  <div className="flex justify-center gap-3 flex-wrap max-w-[34rem]">
                    {siteSources.map((s, idx) => renderSourceCard(s, idx))}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => openCreateSource(site.id)}
                        className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 text-surface-400 hover:text-primary-600 hover:border-primary-400"
                      >
                        <Plus size={14} />
                        <span className="text-xs font-bold">Add Source</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {editable && (
              <button
                type="button"
                onClick={addSite}
                className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 text-surface-400 hover:text-primary-600 hover:border-primary-400"
              >
                <Plus size={14} />
                <span className="text-xs font-bold">Add Site</span>
              </button>
            )}
          </div>

          {/* LAYER 2 — cross-site source-type totals, in the source-card style */}
          <div className="flex justify-center gap-3 sm:gap-4 flex-wrap mt-8">
            {typeTotals.map((t) => (
              <div
                key={t.type}
                ref={registerRef(typeRefs, t.type)}
                className="relative group flex items-center gap-2.5 rounded-2xl px-4 py-3 text-white shadow-lg"
                style={{ background: `linear-gradient(145deg, ${t.from}, ${t.to})`, boxShadow: `0 6px 16px -4px ${t.to}66` }}
              >
                <t.Icon size={18} strokeWidth={2.25} />
                <div className="leading-tight">
                  <p className="text-[11px] font-bold opacity-90">{t.label}</p>
                  <p className="text-sm font-black leading-tight">{Number(t.kw).toFixed(1)} kW</p>
                  <p className="text-[9px] opacity-70 font-semibold mt-0.5">All sites combined</p>
                </div>
              </div>
            ))}
          </div>

          {/* LAYER 3 — total organization load */}
          <div className="flex justify-center mt-8">
            <div
              ref={orgRef}
              className="flex items-center gap-3 rounded-2xl px-6 py-4 text-white shadow-xl"
              style={{ background: 'linear-gradient(145deg, #34D399, #0EA5E9)' }}
            >
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <Building2 size={22} />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-bold opacity-90">Total Organization Load</p>
                <p className="text-xl font-black">{load.toFixed(1)} kW</p>
                <p className="text-[9px] font-semibold opacity-75 mt-0.5">Total supply from all active energy sources</p>
              </div>
            </div>
          </div>

          {savingsView.dailyKWh > 0 && (
            <p className="text-center text-[10px] font-bold text-surface-400 mt-2">
              ~{Number(savingsView.dailyKWh).toFixed(1)} kWh/day offset by clean sources · saving {formatPKR(savingsView.daily)} at PKR {TARIFF_PKR_PER_KWH}/unit
            </p>
          )}

          <div className="flex justify-center my-1"><div className="w-px h-6 bg-surface-300" /></div>

          {/* LAYER 4 — groups */}
          <div className="flex justify-center gap-3 flex-wrap">
            {groups.length === 0 ? (
              <Link
                to={groupsPath}
                className="flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 border border-dashed border-surface-300 text-surface-400 hover:text-primary-600"
              >
                <Plus size={14} />
                <span className="text-xs font-bold">Create a Group</span>
              </Link>
            ) : (
              <>
                {groups.map((g) => {
                  const Icon = iconForGroup(g.name)
                  const nSlv = (g.slaveIds || g.slaves || []).length
                  const nDev = (g.deviceIds || g.devices || []).length
                  const groupCountSummary = nSlv && nDev
                    ? `${nSlv} slave${nSlv !== 1 ? 's' : ''}, ${nDev} device${nDev !== 1 ? 's' : ''}`
                    : nSlv
                      ? `${nSlv} slave${nSlv !== 1 ? 's' : ''}`
                      : `${nDev} device${nDev !== 1 ? 's' : ''}`

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
                        <p className="text-[9px] text-surface-400 font-semibold truncate max-w-[7.5rem]">
                          {groupCountSummary}
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
      </div>

      <Modal
        open={sourceModal !== null}
        onClose={closeSourceModal}
        size="md"
        title={sourceModal === 'create' ? 'Add Power Source' : 'Edit Power Source'}
        footer={
          <>
            {sourceModal !== 'create' && sourceModal && (
              <button
                type="button"
                className="btn-danger mr-auto"
                onClick={deleteSourceFromModal}
              >
                Delete Source
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={closeSourceModal}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!canSaveSource || sourceSaving}
              onClick={saveSourceForm}
            >
              {sourceSaving ? 'Saving...' : (sourceModal === 'create' ? 'Add Source' : 'Save')}
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
            label="Site"
            required
            value={sourceForm.siteId}
            onChange={(e) => setSourceForm((f) => ({ ...f, siteId: e.target.value }))}
            options={localSites.map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectInput
            label="Source Type"
            required
            value={sourceForm.type}
            disabled={editingBuiltin}
            onChange={(e) => setSourceForm((f) => ({ ...f, type: e.target.value }))}
            options={[
              { value: '', label: 'Select source type...' },
              { value: 'solar', label: 'Solar' },
              { value: 'grid', label: 'Grid / Wapda' },
              { value: 'generator', label: 'Generator' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">
                Link Slaves & Devices
                <span className="text-danger-600 font-bold ml-0.5">*</span>
              </label>
              <span className="text-xs text-primary-600 font-bold">
                {(sourceForm.slaveIds?.length || 0) + (sourceForm.deviceIds?.length || 0)} selected
              </span>
            </div>
            <p className="text-[11px] text-surface-400 mb-2">
              Select specific slaves (e.g. Solar, Generator, Compressors) or entire devices. Live kW comes from their active telemetry.
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
              <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-64 overflow-y-auto">
                {devices.map((d) => {
                  const dSlaves = d.slaves || d.configSlaves || d._raw?.configSlaves || []
                  return (
                    <div key={d.id} className="bg-white dark:bg-surface-900 divide-y divide-surface-50 dark:divide-surface-800/60">
                      {/* Device header */}
                      <div className="flex items-center gap-3 px-3 py-2 bg-surface-50/80 dark:bg-surface-800/40">
                        <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-surface-300 text-primary-600"
                            checked={sourceForm.deviceIds.includes(d.id)}
                            onChange={() => toggleSourceDevice(d.id)}
                          />
                          <Cpu size={13} className="text-primary-600 flex-shrink-0" />
                          <span className="text-xs font-bold text-surface-900 dark:text-surface-100">{d.name}</span>
                          <span className="text-[10px] text-surface-400">({dSlaves.length} slaves)</span>
                        </label>
                        <span className={`badge text-[9px] ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                          {d.status}
                        </span>
                      </div>

                      {/* Slaves under device */}
                      {dSlaves.length > 0 && (
                        <div className="pl-6 pr-3 py-1 space-y-1 bg-surface-50/30 dark:bg-surface-950/20">
                          {dSlaves.map((slv) => (
                            <label
                              key={slv.id}
                              className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-surface-100/60 dark:hover:bg-surface-800/60 transition-colors"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-surface-300 text-primary-600"
                                checked={(sourceForm.slaveIds || []).includes(slv.id)}
                                onChange={() => toggleSourceSlave(slv.id)}
                              />
                              <span className="text-xs text-surface-700 dark:text-surface-200 flex-1">
                                {slv.name}
                                {slv.isDefault && (
                                  <span className="ml-1.5 text-[9px] text-surface-400 font-normal">(Default)</span>
                                )}
                              </span>
                              <span className="badge badge-info text-[8px] py-0 px-1.5">Slave</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {devices.length > 0 && sourceForm.deviceIds.length === 0 && (!sourceForm.slaveIds || sourceForm.slaveIds.length === 0) && (
              <p className="text-[11px] text-danger-600 mt-1.5 font-semibold">Select at least one slave or device</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export { iconForGroup }
