import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
]

function pad(n) {
  return String(n).padStart(2, '0')
}

export function toYmd(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatMdY(ymd) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${m}/${d}/${y}`
}

function normalizeOption(opt) {
  if (opt == null) return { value: '', label: '' }
  if (typeof opt === 'object') {
    return {
      value: String(opt.value ?? opt.id ?? ''),
      label: String(opt.label ?? opt.name ?? opt.value ?? opt.id ?? ''),
    }
  }
  return { value: String(opt), label: String(opt) }
}

function parseYmd(ymd) {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function resolvePresetRange(presetId, now = new Date()) {
  const today = startOfDay(now)
  switch (presetId) {
    case 'today':
      return { from: toYmd(today), to: toYmd(today) }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { from: toYmd(y), to: toYmd(y) }
    }
    case 'last7':
      return { from: toYmd(addDays(today, -6)), to: toYmd(today) }
    case 'last30':
      return { from: toYmd(addDays(today, -29)), to: toYmd(today) }
    case 'thisMonth':
      return { from: toYmd(new Date(today.getFullYear(), today.getMonth(), 1)), to: toYmd(today) }
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toYmd(first), to: toYmd(last) }
    }
    default:
      return null
  }
}

function detectPreset(from, to) {
  if (!from || !to) return 'custom'
  for (const p of PRESETS) {
    if (p.id === 'custom') continue
    const range = resolvePresetRange(p.id)
    if (range && range.from === from && range.to === to) return p.id
  }
  return 'custom'
}

function formatDisplayRange(from, to) {
  if (!from && !to) return 'Select date range'
  const a = from ? formatMdY(from) : '…'
  const b = to ? formatMdY(to) : '…'
  return `${a} - ${b}`
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function useClickOutside(anchorRef, panelRef, open, onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (anchorRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      onCloseRef.current()
    }
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, anchorRef, panelRef])
}

function ClearableSelect({ label, value, displayValue, options, placeholder, onChange, emptyLabel }) {
  if (value) {
    return (
      <div className="w-44">
        <label className="label">{label}</label>
        <div className="input flex items-center justify-between text-xs gap-2">
          <span className="truncate">{displayValue || value}</span>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-surface-400 hover:text-surface-700 flex-shrink-0"
            aria-label={`Clear ${label}`}
          >
            <X size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-44">
      <label className="label">{label}</label>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder || emptyLabel || `Select ${label.toLowerCase()}`}</option>
        {options.map((opt) => {
          const v = typeof opt === 'object' ? opt.value : opt
          const l = typeof opt === 'object' ? opt.label : opt
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
    </div>
  )
}

/** Searchable single-select with clear + checkmark list (slave / category style). */
export function SearchableSelect({
  label,
  value,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  className = 'w-48',
  onChange,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const anchor = useRef(null)
  const panel = useRef(null)
  const searchRef = useRef(null)

  const normalized = useMemo(() => options.map(normalizeOption), [options])
  const selected = normalized.find((o) => o.value === String(value ?? ''))
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return normalized
    return normalized.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  }, [normalized, query])

  useClickOutside(anchor, panel, open, () => setOpen(false))

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  return (
    <div className={`relative ${className}`} ref={anchor}>
      {label && <label className="label">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        className="input flex items-center justify-between gap-2 text-xs text-left w-full disabled:opacity-50"
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className={`truncate ${selected ? 'text-surface-800 dark:text-surface-100' : 'text-surface-400'}`}>
          {selected?.label || placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange('') } }}
              className="text-surface-400 hover:text-surface-700 p-0.5"
              aria-label="Clear"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className="text-surface-400" />
        </span>
      </button>

      {open && (
        <div
          ref={panel}
          className="absolute z-40 mt-1 left-0 right-0 min-w-[220px] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-surface-200 dark:border-surface-700">
            <input
              ref={searchRef}
              type="text"
              className="input text-xs py-1.5"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-surface-400">No matches</li>
            ) : filtered.map((opt) => {
              const active = opt.value === String(value ?? '')
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                      active
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200 font-semibold'
                        : 'text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800'
                    }`}
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && <Check size={14} className="flex-shrink-0 text-primary-600" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Multi-select with removable chips and searchable checklist (variable picker). */
export function MultiSelectTags({
  label,
  values = [],
  options = [],
  placeholder = 'Select…',
  disabled = false,
  className = 'min-w-[220px] flex-1',
  onChange,
  allowAll = true,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const anchor = useRef(null)
  const panel = useRef(null)

  const normalized = useMemo(() => options.map(normalizeOption), [options])
  const selectedSet = useMemo(() => new Set(values.map(String)), [values])
  const selectedOpts = normalized.filter((o) => selectedSet.has(o.value))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return normalized
    return normalized.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  }, [normalized, query])

  useClickOutside(anchor, panel, open, () => setOpen(false))

  const toggle = (val) => {
    const next = selectedSet.has(val)
      ? values.filter((v) => String(v) !== val)
      : [...values, val]
    onChange(next)
  }

  const selectAll = () => onChange(normalized.map((o) => o.value))
  const clearAll = (e) => {
    e?.stopPropagation?.()
    onChange([])
  }

  return (
    <div className={`relative ${className}`} ref={anchor}>
      {label && <label className="label">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        className="input flex items-center gap-1.5 text-xs text-left w-full min-h-[38px] py-1 disabled:opacity-50"
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selectedOpts.length === 0 ? (
            <span className="text-surface-400 truncate py-0.5">{placeholder}</span>
          ) : selectedOpts.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200 max-w-full"
            >
              <span
                role="button"
                tabIndex={0}
                className="text-surface-400 hover:text-danger-600 flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); toggle(opt.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggle(opt.value) } }}
                aria-label={`Remove ${opt.label}`}
              >
                <X size={10} />
              </span>
              <span className="truncate">{opt.label}</span>
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1 flex-shrink-0 ml-1">
          {selectedOpts.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={clearAll}
              onKeyDown={(e) => { if (e.key === 'Enter') clearAll(e) }}
              className="text-surface-400 hover:text-surface-700 p-0.5"
              aria-label="Clear all"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className="text-surface-400" />
        </span>
      </button>

      {open && (
        <div
          ref={panel}
          className="absolute z-40 mt-1 left-0 right-0 min-w-[240px] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-surface-200 dark:border-surface-700">
            <input
              type="text"
              className="input text-xs py-1.5"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {allowAll && (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-xs text-left text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800"
                  onClick={selectAll}
                >
                  All
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-surface-400">No matches</li>
            ) : filtered.map((opt) => {
              const active = selectedSet.has(opt.value)
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                      active
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200 font-semibold'
                        : 'text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800'
                    }`}
                    onClick={() => toggle(opt.value)}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && <Check size={14} className="flex-shrink-0 text-primary-600" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export function DateRangePicker({ dateFrom, dateTo, onApply, className = 'w-56', label = 'Date Range' }) {
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState(() => detectPreset(dateFrom, dateTo))
  const [draftFrom, setDraftFrom] = useState(dateFrom || '')
  const [draftTo, setDraftTo] = useState(dateTo || '')
  const [picking, setPicking] = useState('from')
  const anchor = useRef(null)
  const panel = useRef(null)

  const initial = useMemo(() => {
    const base = parseYmd(dateFrom) || new Date()
    return { y: base.getFullYear(), m: base.getMonth() }
  }, [dateFrom])

  const [leftMonth, setLeftMonth] = useState(initial)

  useEffect(() => {
    if (!open) return
    setPreset(detectPreset(dateFrom, dateTo))
    setDraftFrom(dateFrom || '')
    setDraftTo(dateTo || '')
    setPicking('from')
    const base = parseYmd(dateFrom) || new Date()
    setLeftMonth({ y: base.getFullYear(), m: base.getMonth() })
  }, [open, dateFrom, dateTo])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (anchor.current?.contains(e.target) || panel.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const rightMonth = useMemo(() => {
    const d = new Date(leftMonth.y, leftMonth.m + 1, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  }, [leftMonth])

  const applyPreset = (id) => {
    setPreset(id)
    if (id === 'custom') return
    const range = resolvePresetRange(id)
    if (!range) return
    setDraftFrom(range.from)
    setDraftTo(range.to)
    const base = parseYmd(range.from)
    if (base) setLeftMonth({ y: base.getFullYear(), m: base.getMonth() })
  }

  const onDayClick = (day) => {
    if (!day) return
    setPreset('custom')
    const ymd = toYmd(day)
    if (picking === 'from' || !draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(ymd)
      setDraftTo('')
      setPicking('to')
      return
    }
    if (ymd < draftFrom) {
      setDraftTo(draftFrom)
      setDraftFrom(ymd)
    } else {
      setDraftTo(ymd)
    }
    setPicking('from')
  }

  const inRange = (day) => {
    if (!day || !draftFrom) return false
    const ymd = toYmd(day)
    if (!draftTo) return ymd === draftFrom
    return ymd >= draftFrom && ymd <= draftTo
  }

  const isEndpoint = (day) => {
    if (!day) return false
    const ymd = toYmd(day)
    return ymd === draftFrom || ymd === draftTo
  }

  const handleApply = () => {
    if (preset !== 'custom') {
      const range = resolvePresetRange(preset)
      if (range) {
        onApply(range.from, range.to)
        setOpen(false)
        return
      }
    }
    if (!draftFrom || !draftTo) return
    onApply(draftFrom, draftTo)
    setOpen(false)
  }

  const renderMonth = (year, month) => {
    const cells = buildMonthGrid(year, month)
    return (
      <div className="w-[220px]">
        <div className="grid grid-cols-7 gap-0.5 mb-1 text-[10px] text-surface-400 text-center font-semibold uppercase">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="h-7" />
            const selected = isEndpoint(day)
            const ranged = inRange(day)
            return (
              <button
                key={toYmd(day)}
                type="button"
                onClick={() => onDayClick(day)}
                className={`h-7 text-xs rounded-md transition-colors ${
                  selected
                    ? 'bg-primary-500 text-surface-950 font-bold'
                    : ranged
                      ? 'bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200'
                      : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-200'
                }`}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} ref={anchor}>
      {label && <label className="label">{label}</label>}
      <button
        type="button"
        className="input flex items-center justify-between gap-2 text-xs text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{formatDisplayRange(dateFrom, dateTo)}</span>
        <Calendar size={14} className="text-surface-400 flex-shrink-0" />
      </button>

      {open && (
        <div
          ref={panel}
          className="absolute z-40 mt-1 left-0 sm:left-auto sm:right-0 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg overflow-hidden min-w-[560px]"
        >
          <div className="flex">
            <div className="w-40 border-r border-surface-200 dark:border-surface-700 p-2 space-y-0.5 bg-surface-50 dark:bg-surface-950/50">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    preset === p.id
                      ? 'bg-primary-500 text-surface-950'
                      : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="p-3 flex-1">
              <div className="flex items-center justify-between mb-3 gap-2">
                <button
                  type="button"
                  className="btn-ghost p-1"
                  onClick={() => setLeftMonth((m) => {
                    const d = new Date(m.y, m.m - 1, 1)
                    return { y: d.getFullYear(), m: d.getMonth() }
                  })}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex-1 flex justify-around text-xs font-semibold text-surface-700 dark:text-surface-200">
                  <span>{monthLabel(leftMonth.y, leftMonth.m)}</span>
                  <span>{monthLabel(rightMonth.y, rightMonth.m)}</span>
                </div>
                <button
                  type="button"
                  className="btn-ghost p-1"
                  onClick={() => setLeftMonth((m) => {
                    const d = new Date(m.y, m.m + 1, 1)
                    return { y: d.getFullYear(), m: d.getMonth() }
                  })}
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex gap-4">
                {renderMonth(leftMonth.y, leftMonth.m)}
                {renderMonth(rightMonth.y, rightMonth.m)}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                <p className="text-[11px] text-surface-400 font-mono">
                  {formatDisplayRange(draftFrom, draftTo)}
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-xs px-3 py-1.5"
                    onClick={handleApply}
                    disabled={preset === 'custom' && (!draftFrom || !draftTo)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Shared filter bar for Data Center style pages
 * (Variable Alarm Record, Linkage Record, Historical Data).
 */
export default function DataCenterFilterBar({
  organizations = [],
  organization = '',
  onOrganizationChange,
  showOrganization = false,

  devices = [],
  device = '',
  onDeviceChange,
  devicePlaceholder = 'Select device',

  triggerOptions = [],
  trigger = '',
  onTriggerChange,

  variableOptions = [],
  variable = '',
  onVariableChange,

  showStateFilters = false,
  alarmState = '',
  onAlarmStateChange,
  processState = '',
  onProcessStateChange,

  extraFilters,
  dateFrom = '',
  dateTo = '',
  onDateFromChange,
  onDateToChange,
  onDateRangeChange,
  onQuery,
}) {
  const deviceOptions = useMemo(() => devices.map((d) => (
    typeof d === 'object' ? { value: d.id ?? d.value, label: d.name ?? d.label } : { value: d, label: d }
  )), [devices])

  const deviceLabel = deviceOptions.find((d) => d.value === device)?.label || device

  const handleDateApply = (from, to) => {
    if (onDateRangeChange) onDateRangeChange(from, to)
    else {
      onDateFromChange?.(from)
      onDateToChange?.(to)
    }
  }

  return (
    <div className="card p-4 mb-5">
      <div className="flex flex-wrap items-end gap-3">
        {showOrganization && onOrganizationChange && (
          <div className="w-44">
            <label className="label">Organization</label>
            <select
              className="select"
              value={organization}
              onChange={(e) => onOrganizationChange(e.target.value)}
            >
              <option value="">All Organizations</option>
              {organizations.map((o) => {
                const id = o.id ?? o.value
                const name = o.name ?? o.label
                return <option key={id} value={id}>{name}</option>
              })}
            </select>
          </div>
        )}

        {onDeviceChange && (
          <ClearableSelect
            label="Device"
            value={device}
            displayValue={deviceLabel}
            options={deviceOptions}
            placeholder={devicePlaceholder}
            onChange={onDeviceChange}
          />
        )}

        {onTriggerChange && (
          <ClearableSelect
            label="Trigger Name"
            value={trigger}
            options={triggerOptions}
            placeholder="Select trigger"
            onChange={onTriggerChange}
          />
        )}

        {onVariableChange && (
          <ClearableSelect
            label="Variable"
            value={variable}
            options={variableOptions}
            placeholder="Select variable"
            onChange={onVariableChange}
          />
        )}

        {showStateFilters && onAlarmStateChange && (
          <div className="w-36">
            <label className="label">Alarm State</label>
            <select className="select" value={alarmState} onChange={(e) => onAlarmStateChange(e.target.value)}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        )}

        {showStateFilters && onProcessStateChange && (
          <div className="w-36">
            <label className="label">Process State</label>
            <select className="select" value={processState} onChange={(e) => onProcessStateChange(e.target.value)}>
              <option value="">All</option>
              <option value="UNPROCESSED">Unprocessed</option>
              <option value="PROCESSED">Processed</option>
            </select>
          </div>
        )}

        {extraFilters}

        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onApply={handleDateApply}
        />

        <button type="button" className="btn-primary" onClick={onQuery}>Query</button>
      </div>
    </div>
  )
}
