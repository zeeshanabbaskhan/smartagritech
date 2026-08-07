import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'

/**
 * Searchable access-group / device-scope filter used on org dashboard & historical data.
 * Options: "All Organization Devices" + access groups (e.g. AG - Site A).
 */
export default function OrgDeviceScopeFilter({
  groups = [],
  value = 'all',
  onChange,
  allLabel = 'All Organization Devices',
  searchPlaceholder = 'Search groups...',
  emptyHint = 'No groups created yet. Go to Access Groups to create one.',
  className = '',
  label,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const activeLabel = useMemo(() => {
    if (value === 'all') return allLabel
    const g = groups.find((x) => x.id === value)
    return g?.name || allLabel
  }, [value, groups, allLabel])

  const searched = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return groups
    return groups.filter((g) =>
      (g.name || '').toLowerCase().includes(q)
      || (g.org || '').toLowerCase().includes(q)
    )
  }, [groups, search])

  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="input flex items-center gap-2 text-xs text-left w-full"
        >
          <Search size={12} className="text-surface-400 flex-shrink-0" />
          <span className="truncate flex-1 text-surface-800 dark:text-surface-100 font-semibold">
            {activeLabel}
          </span>
          <span className="text-[9px] text-surface-400 flex-shrink-0">▼</span>
        </button>

        {open && (
          <div className="absolute left-0 mt-1.5 w-64 max-w-[min(100vw-2rem,20rem)] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg z-40 overflow-hidden">
            <div className="p-2 border-b border-surface-100 dark:border-surface-800">
              <input
                type="text"
                className="w-full px-2 py-1 text-xs input"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-surface-50 dark:divide-surface-800">
              <button
                type="button"
                onClick={() => { onChange('all'); setOpen(false); setSearch('') }}
                className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 ${
                  value === 'all'
                    ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20'
                    : 'text-surface-700 dark:text-surface-300'
                }`}
              >
                {allLabel}
              </button>
              {groups.length === 0 ? (
                <p className="p-3 text-[10px] text-center text-surface-400 font-medium">{emptyHint}</p>
              ) : searched.length === 0 ? (
                <p className="p-3 text-xs text-center text-surface-400">No matching groups found.</p>
              ) : (
                searched.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { onChange(g.id); setOpen(false); setSearch('') }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 flex flex-col ${
                      value === g.id
                        ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20'
                        : 'text-surface-700 dark:text-surface-300'
                    }`}
                  >
                    <span>{g.name}</span>
                    {g.org ? <span className="text-[9px] text-surface-400 font-normal">{g.org}</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Filter devices by access-group selection (`all` or group id). */
export function filterDevicesByAccessGroup(devices, groups, groupFilter) {
  if (!groupFilter || groupFilter === 'all') return devices
  const group = groups.find((g) => g.id === groupFilter)
  if (!group?.deviceIds?.length) return []
  const ids = new Set(group.deviceIds)
  return devices.filter((d) => ids.has(d.id))
}
