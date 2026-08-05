import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Activity, Gauge, TrendingUp, Radio, Search, ChevronRight, Cpu } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapOrganization } from '../../utils/mappers'
import {
  readDeviceMetric,
  computeDynamicKpis,
  listDeviceMetricEntries,
  isOffline,
  isSwitchOff,
  unitForVariable,
} from '../../utils/deviceMetrics'
import DrillDownModal from '../ui/DrillDownModal'
import { useToast } from '../../context/ToastContext'
import { onSocketEvent, isSocketEnabled } from '../../services/socketService'

const KPI_ICONS = [Zap, Activity, Gauge, TrendingUp]
const KPI_COLORS = ['#F5A623', '#3B82F6', '#22C55E', '#8B5CF6']

function highlightMatch(text, search) {
  if (!search || !text) return text
  const parts = String(text).split(new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 px-0.5 rounded">{part}</mark>
        ) : part
      )}
    </span>
  )
}

function formatTileValue(value, name) {
  if (!Number.isFinite(value)) return '—'
  if (/powerfactor|\bpf\b/i.test(String(name))) return value.toFixed(2)
  if (Math.abs(value) >= 1000) return value.toFixed(0)
  return value.toFixed(1)
}

/**
 * Shared KPI + Master Device Control panel.
 * @param {'group'|'org'} filterMode — admin uses `org`; org dashboard uses access `group`
 * @param {React.ReactNode} between — rendered between KPI cards and telemetry (e.g. StatCards)
 */
export default function DashboardTelemetry({
  panelTitle = 'Master Executive Device Control',
  showAccessFilter = true,
  highlightQuery = '',
  sections = 'all',
  allDevicesLabel = 'All Devices',
  powerKpiLabel,
  emptyGroupsHint = 'No groups found.',
  filterMode = 'group',
  between = null,
  onScopeChange,
  telemetrySubtitle,
}) {
  const { showToast } = useToast()
  const [devices, setDevices] = useState([])
  const [groups, setGroups] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [groupFilter, setGroupFilter] = useState('all')
  const [drillMetric, setDrillMetric] = useState(null)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const filterRef = useRef(null)
  const onScopeChangeRef = useRef(onScopeChange)
  onScopeChangeRef.current = onScopeChange
  const showKpis = sections === 'all' || sections === 'kpis'
  const showTelemetry = sections === 'all' || sections === 'telemetry'
  const isOrgMode = filterMode === 'org'

  const loadDevices = () => {
    emsApi.getDevices({ limit: 100, withMetrics: true })
      .then((res) => setDevices(list(res).map(mapDevice)))
      .catch(() => {})
  }

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isSocketEnabled()) return undefined
    return onSocketEvent((event, data) => {
      if (event === 'device:status' && data?.deviceId) {
        setDevices((prev) => prev.map((d) => {
          if (d.id !== data.deviceId) return d
          const statusRaw = data.status
          return {
            ...d,
            statusRaw,
            status: statusRaw === 'ONLINE' ? 'Online' : 'Offline',
          }
        }))
      }
      if (event === 'device:switch' && data?.deviceId) {
        setDevices((prev) => prev.map((d) => {
          if (d.id !== data.deviceId) return d
          const action = data.action || data.switchState
          return {
            ...d,
            switchOn: action === 'ON',
            switchState: action,
            ...(action === 'OFF' || data.status === 'OFFLINE'
              ? { status: 'Offline', statusRaw: 'OFFLINE' }
              : {}),
          }
        }))
      }
      if (event === 'reading:new') loadDevices()
    })
  }, [])

  useEffect(() => {
    if (!showAccessFilter) return
    if (isOrgMode) {
      emsApi.getOrganizations({ limit: 100 })
        .then((res) => setOrganizations(list(res).map(mapOrganization)))
        .catch(() => setOrganizations([]))
      return
    }
    emsApi.getAccessGroups({ limit: 100 })
      .then((res) => setGroups(list(res).map((g) => ({
        id: g.id,
        name: g.name,
        org: g.organization?.name ?? g.org ?? '—',
        deviceIds: g.deviceIds ?? (g.devices || []).map((d) => d.id ?? d.deviceId).filter(Boolean),
      }))))
      .catch(() => {})
  }, [showAccessFilter, isOrgMode])

  useEffect(() => {
    if (!filterOpen) return
    const onClick = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [filterOpen])

  const selectedOrg = useMemo(() => {
    if (!isOrgMode || groupFilter === 'all') return null
    return organizations.find((o) => o.id === groupFilter) || null
  }, [isOrgMode, groupFilter, organizations])

  const activeDevices = useMemo(() => {
    if (groupFilter === 'all') return devices
    if (isOrgMode) {
      return devices.filter((d) => d.organizationId === groupFilter || d.org === selectedOrg?.name)
    }
    const group = groups.find((g) => g.id === groupFilter)
    if (!group) return devices
    return devices.filter((d) => group.deviceIds.includes(d.id))
  }, [devices, groups, groupFilter, isOrgMode, selectedOrg])

  useEffect(() => {
    onScopeChangeRef.current?.({
      filterId: groupFilter,
      organizationId: isOrgMode && groupFilter !== 'all' ? groupFilter : null,
      organization: selectedOrg,
      devices: activeDevices,
    })
  }, [groupFilter, isOrgMode, selectedOrg, activeDevices])

  const kpiState = useMemo(() => computeDynamicKpis(activeDevices), [activeDevices])

  const KPI_CONFIG = useMemo(() => (
    kpiState.cards.map((c, i) => ({
      ...c,
      Icon: KPI_ICONS[i % KPI_ICONS.length],
      color: KPI_COLORS[i % KPI_COLORS.length],
      label: powerKpiLabel && (c.key === 'power' || /activepower/i.test(c.key))
        ? powerKpiLabel
        : c.label,
    }))
  ), [kpiState.cards, powerKpiLabel])

  const activeGroupLabel = useMemo(() => {
    if (groupFilter === 'all') return allDevicesLabel
    if (isOrgMode) return selectedOrg?.name || allDevicesLabel
    const g = groups.find((x) => x.id === groupFilter)
    return g ? `${g.name} (${g.org})` : allDevicesLabel
  }, [groupFilter, groups, allDevicesLabel, isOrgMode, selectedOrg])

  const searchedOptions = useMemo(() => {
    const q = filterSearch.toLowerCase().trim()
    if (isOrgMode) {
      if (!q) return organizations
      return organizations.filter((o) =>
        o.name.toLowerCase().includes(q) || (o.status || '').toLowerCase().includes(q)
      )
    }
    if (!q) return groups
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.org.toLowerCase().includes(q))
  }, [groups, organizations, filterSearch, isOrgMode])

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.toLowerCase().trim()
    if (q) {
      return activeDevices.filter((d) =>
        d.name.toLowerCase().includes(q)
        || (d.gateway ?? '').toLowerCase().includes(q)
        || (d.org ?? '').toLowerCase().includes(q)
        || (d.template ?? '').toLowerCase().includes(q)
      )
    }
    return [...activeDevices].reverse().slice(0, 5)
  }, [activeDevices, deviceSearch])

  const handleToggleSwitch = async (device) => {
    const action = device.switchOn ? 'OFF' : 'ON'
    setDevices((prev) => prev.map((d) => (
      d.id === device.id
        ? {
            ...d,
            switchOn: action === 'ON',
            switchState: action,
            ...(action === 'OFF'
              ? { status: 'Offline', statusRaw: 'OFFLINE', latestMetrics: {} }
              : {}),
          }
        : d
    )))
    try {
      await emsApi.switchDevice(device.id, action)
      showToast(`${device.name} switched ${action}`, 'success')
    } catch (e) {
      showToast(e.message || 'Switch failed', 'error')
      loadDevices()
    }
  }

  const drillCfg = drillMetric ? KPI_CONFIG.find((k) => k.key === drillMetric) : null
  const defaultTelemetryHint = deviceSearch.trim()
    ? `Search results for "${deviceSearch}"`
    : (telemetrySubtitle || 'Showing 5 latest devices. Use the search bar to find past devices.')

  return (
    <div className="space-y-6">
      {showKpis && (
        <div className="space-y-3">
          {showAccessFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest flex-shrink-0">
                Filter KPIs:
              </span>
              <div className="relative group-filter-dropdown-container" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((o) => !o)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl border bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-primary-500 transition-colors"
                >
                  <Search size={12} className="text-surface-400" />
                  <span className="text-surface-800 dark:text-surface-100">{activeGroupLabel}</span>
                  <span className="text-[9px] text-surface-400">▼</span>
                </button>
                {filterOpen && (
                  <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-floating z-[999] overflow-hidden">
                    <div className="p-2 border-b border-surface-100 dark:border-surface-800">
                      <input
                        type="text"
                        className="w-full px-2 py-1 text-xs input"
                        placeholder={isOrgMode ? 'Search organizations...' : 'Search groups...'}
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-surface-50 dark:divide-surface-800">
                      <button
                        type="button"
                        onClick={() => { setGroupFilter('all'); setFilterOpen(false); setFilterSearch('') }}
                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 ${groupFilter === 'all' ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20' : 'text-surface-700 dark:text-surface-300'}`}
                      >
                        {allDevicesLabel}
                      </button>
                      {(isOrgMode ? organizations : groups).length === 0 ? (
                        <p className="p-3 text-[10px] text-center text-surface-400 font-medium">{emptyGroupsHint}</p>
                      ) : searchedOptions.length === 0 ? (
                        <p className="p-3 text-xs text-center text-surface-400">
                          {isOrgMode ? 'No matching organizations found.' : 'No matching groups found.'}
                        </p>
                      ) : isOrgMode ? (
                        searchedOptions.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => { setGroupFilter(o.id); setFilterOpen(false); setFilterSearch('') }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 flex flex-col ${groupFilter === o.id ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20' : 'text-surface-700 dark:text-surface-300'}`}
                          >
                            <span>{o.name}</span>
                            <span className="text-[9px] text-surface-400 font-normal">{o.status}</span>
                          </button>
                        ))
                      ) : (
                        searchedOptions.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => { setGroupFilter(g.id); setFilterOpen(false); setFilterSearch('') }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 flex flex-col ${groupFilter === g.id ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20' : 'text-surface-700 dark:text-surface-300'}`}
                          >
                            <span>{g.name}</span>
                            <span className="text-[9px] text-surface-400 font-normal">{g.org}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={`grid grid-cols-2 gap-4 ${KPI_CONFIG.length >= 4 ? 'lg:grid-cols-4' : KPI_CONFIG.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            {KPI_CONFIG.length === 0 ? (
              <div className="col-span-2 lg:col-span-4 card p-4 text-xs text-surface-500">
                No live variables yet — start the MQTT bridge so device readings appear here.
              </div>
            ) : (
              KPI_CONFIG.map(({ key, label, unit, Icon, color, agg, value }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDrillMetric(key)}
                  className="card p-4 text-left hover:shadow-elevated hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200 cursor-pointer group border border-surface-200 dark:border-surface-800 w-full"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[10px] font-black text-surface-400 uppercase tracking-wider leading-tight truncate pr-2">{label}</span>
                    <Icon size={13} style={{ color }} className="flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-surface-900 dark:text-surface-100 leading-none">
                      {Number.isFinite(value) ? formatTileValue(value, key) : '—'}
                    </span>
                    {unit ? <span className="text-xs font-bold text-surface-400">{unit}</span> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-surface-400 font-semibold">{agg} · {kpiState.onlineCount} online</span>
                    <ChevronRight size={11} className="text-surface-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {between}

      {showTelemetry && (
        <div className="card p-5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-100 dark:border-surface-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="text-primary-600 animate-pulse" size={18} />
              <div>
                <h3 className="text-base font-extrabold text-surface-900 dark:text-surface-100 tracking-tight leading-tight">{panelTitle}</h3>
                <p className="text-xs text-surface-400 font-semibold mt-0.5">{defaultTelemetryHint}</p>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" size={13} />
              <input
                type="text"
                className="input pl-8 pr-3 py-1 text-xs bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 w-full"
                placeholder={isOrgMode ? 'Search device, gateway or org...' : 'Search device or gateway...'}
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredDevices.length === 0 ? (
              <div className="p-8 text-center text-xs text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-900/40 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
                No matching devices found. Clear search to see latest devices.
              </div>
            ) : (
              filteredDevices.map((d) => {
                const offline = isOffline(d)
                const switchOff = isSwitchOff(d)
                const tiles = switchOff ? [] : listDeviceMetricEntries(d, { limit: 24 })
                return (
                  <div key={d.id} className="p-4 bg-surface-50/50 dark:bg-surface-900/40 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3 hover:border-primary-300 dark:hover:border-primary-800 transition-all duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 dark:border-surface-800/80 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${offline || switchOff ? 'bg-surface-200 dark:bg-surface-800 text-surface-400' : 'bg-primary-50 dark:bg-primary-950/20 text-primary-600'}`}>
                          <Cpu size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-surface-800 dark:text-surface-100 leading-tight">{highlightMatch(d.name, highlightQuery)}</h4>
                          <p className="text-[10px] text-surface-400 font-bold mt-0.5 uppercase tracking-wide">
                            Gateway: {highlightMatch(d.gateway, highlightQuery)} • Org: {highlightMatch(d.org, highlightQuery)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge ${offline || switchOff ? 'badge-danger' : 'badge-success'} text-[9px] font-black uppercase tracking-wider`}>
                          {offline || switchOff ? 'Offline' : 'Online'}
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] text-surface-400 font-black uppercase select-none">Control Switch</span>
                          <button
                            type="button"
                            onClick={() => handleToggleSwitch(d)}
                            className={`relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${d.switchOn ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-700'}`}
                          >
                            <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${d.switchOn ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </label>
                      </div>
                    </div>

                    {switchOff ? (
                      <p className="text-[11px] text-surface-500 py-3 text-center">
                        Switch is off — live telemetry hidden for this device.
                      </p>
                    ) : tiles.length === 0 ? (
                      <p className="text-[11px] text-surface-500 py-3 text-center">
                        Waiting for first reading from this device’s variables…
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {tiles.map(({ name, value, unit }) => (
                          <div key={name} className="p-3 bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800/80 flex flex-col justify-between min-h-[5.5rem] hover:border-primary-300 dark:hover:border-primary-800 transition-all duration-200">
                            <div className="flex justify-between items-start text-surface-400 gap-1">
                              <span className="text-[10px] font-black uppercase tracking-wide truncate" title={name}>{name}</span>
                              <Zap size={13} className={offline ? 'text-surface-400' : 'text-primary-500'} />
                            </div>
                            <div className="mt-1">
                              <span className="text-base font-black text-surface-900 dark:text-surface-100 leading-none">
                                {formatTileValue(value, name)}
                              </span>
                              {unit ? <span className="text-[10px] text-surface-400 font-semibold ml-1">{unit}</span> : null}
                            </div>
                            <div className="text-[9px] text-surface-400/80 mt-1 truncate border-t border-surface-100 dark:border-surface-800/40 pt-1.5 font-bold uppercase tracking-widest">
                              {offline ? 'last reading · ' : ''}for {d.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {showKpis && drillCfg && (
        <DrillDownModal
          open
          onClose={() => setDrillMetric(null)}
          metric={drillCfg.label}
          unit={drillCfg.unit || unitForVariable(drillCfg.metric)}
          aggregate={drillCfg.value}
          aggregateLabel={drillCfg.agg}
          devices={activeDevices}
          getDeviceValue={(device) => readDeviceMetric(device, drillCfg.metric)}
          gaugeMax={drillCfg.gaugeMax}
          gaugeColor={drillCfg.color}
        />
      )}
    </div>
  )
}
