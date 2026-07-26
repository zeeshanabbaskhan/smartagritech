import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Activity, Gauge, TrendingUp, Radio, Search, ChevronRight, Cpu } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice } from '../../utils/mappers'
import { readDeviceMetric, computeKpis, isOffline } from '../../utils/deviceMetrics'
import DrillDownModal from '../ui/DrillDownModal'
import { useToast } from '../../context/ToastContext'

const DEFAULT_KPI_CONFIG = [
  { key: 'power',   label: 'Total Power',      metric: 'power',   unit: 'kW', Icon: Zap,        color: '#F5A623', gaugeMax: 135, agg: 'Sum',  aggKey: 'totalPower' },
  { key: 'current', label: 'Total Current',    metric: 'current', unit: 'A',  Icon: Activity,   color: '#3B82F6', gaugeMax: 80,  agg: 'Sum',  aggKey: 'totalCurrent' },
  { key: 'voltage', label: 'Avg Voltage',      metric: 'voltage', unit: 'V',  Icon: Gauge,      color: '#22C55E', gaugeMax: 240, agg: 'Mean', aggKey: 'avgVoltage' },
  { key: 'pf',      label: 'Avg Power Factor', metric: 'pf',      unit: '',   Icon: TrendingUp, color: '#8B5CF6', gaugeMax: 1,   agg: 'Mean', aggKey: 'avgPF' },
]

const TILE_CONFIG = [
  { key: 'power',       label: 'Active Power',       unit: 'kW',  Icon: Zap,        cls: 'text-amber-500' },
  { key: 'current',     label: 'Current',            unit: 'A',   Icon: Activity,   cls: 'text-info-500' },
  { key: 'voltage',     label: 'Voltage',            unit: 'V',   Icon: Gauge,      cls: 'text-success-500' },
  { key: 'pf',          label: 'Power Factor',       unit: '',    Icon: TrendingUp, cls: 'text-primary-500' },
  { key: 'consumption', label: 'Energy Consumption', unit: 'kWh', Icon: Zap,        cls: 'text-primary-500', span: true },
]

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

function tileValue(device, key, offline) {
  if (offline) return '—'
  const n = readDeviceMetric(device, key)
  if (!Number.isFinite(n)) return '—'
  return key === 'pf' ? n.toFixed(2) : n.toFixed(1)
}

export default function DashboardTelemetry({
  panelTitle = 'Master Executive Device Control',
  showAccessFilter = true,
  highlightQuery = '',
  /** 'all' | 'kpis' | 'telemetry' — lets pages match CF section order */
  sections = 'all',
  allDevicesLabel = 'All Devices',
  powerKpiLabel,
  emptyGroupsHint = 'No groups found.',
}) {
  const { showToast } = useToast()
  const [devices, setDevices] = useState([])
  const [groups, setGroups] = useState([])
  const [groupFilter, setGroupFilter] = useState('all')
  const [drillMetric, setDrillMetric] = useState(null)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const filterRef = useRef(null)
  const showKpis = sections === 'all' || sections === 'kpis'
  const showTelemetry = sections === 'all' || sections === 'telemetry'
  const KPI_CONFIG = useMemo(() => (
    powerKpiLabel
      ? DEFAULT_KPI_CONFIG.map((k) => (k.key === 'power' ? { ...k, label: powerKpiLabel } : k))
      : DEFAULT_KPI_CONFIG
  ), [powerKpiLabel])

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
    if (!showAccessFilter) return
    emsApi.getAccessGroups({ limit: 100 })
      .then((res) => setGroups(list(res).map((g) => ({
        id: g.id,
        name: g.name,
        org: g.organization?.name ?? g.org ?? '—',
        deviceIds: g.deviceIds ?? (g.devices || []).map((d) => d.id ?? d.deviceId).filter(Boolean),
      }))))
      .catch(() => {})
  }, [showAccessFilter])

  useEffect(() => {
    if (!filterOpen) return
    const onClick = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [filterOpen])

  const activeDevices = useMemo(() => {
    if (groupFilter === 'all') return devices
    const group = groups.find((g) => g.id === groupFilter)
    if (!group) return devices
    return devices.filter((d) => group.deviceIds.includes(d.id))
  }, [devices, groups, groupFilter])

  const kpis = useMemo(() => computeKpis(activeDevices), [activeDevices])

  const activeGroupLabel = useMemo(() => {
    if (groupFilter === 'all') return allDevicesLabel
    const g = groups.find((x) => x.id === groupFilter)
    return g ? g.name : allDevicesLabel
  }, [groupFilter, groups, allDevicesLabel])

  const searchedGroups = useMemo(() => {
    const q = filterSearch.toLowerCase().trim()
    if (!q) return groups
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.org.toLowerCase().includes(q))
  }, [groups, filterSearch])

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.toLowerCase().trim()
    if (q) {
      return activeDevices.filter((d) =>
        d.name.toLowerCase().includes(q) ||
        (d.gateway ?? '').toLowerCase().includes(q) ||
        (d.org ?? '').toLowerCase().includes(q) ||
        (d.template ?? '').toLowerCase().includes(q)
      )
    }
    return [...activeDevices].slice(0, 5)
  }, [activeDevices, deviceSearch])

  const handleToggleSwitch = async (device) => {
    const action = device.switchOn ? 'OFF' : 'ON'
    setDevices((prev) => prev.map((d) => (
      d.id === device.id
        ? { ...d, switchOn: action === 'ON', switchState: action }
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

  return (
    <div className="space-y-6">
      {showKpis && (
        <div className="space-y-3">
          {showAccessFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-surface-600 dark:text-surface-400 uppercase tracking-widest flex-shrink-0">Filter KPIs:</span>
              <div className="relative" ref={filterRef}>
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
                        placeholder="Search groups..."
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
                      {groups.length === 0 ? (
                        <p className="p-3 text-[10px] text-center text-surface-400 font-medium">{emptyGroupsHint}</p>
                      ) : searchedGroups.length === 0 ? (
                        <p className="p-3 text-xs text-center text-surface-400">No matching groups found.</p>
                      ) : (
                        searchedGroups.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => { setGroupFilter(g.id); setFilterOpen(false); setFilterSearch('') }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 flex flex-col ${groupFilter === g.id ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20' : 'text-surface-700 dark:text-surface-300'}`}
                          >
                            <span>{g.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_CONFIG.map(({ key, label, unit, Icon, color, agg, aggKey }) => {
              const value = kpis[aggKey]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDrillMetric(key)}
                  className="card p-4 text-left hover:shadow-elevated hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200 cursor-pointer group border border-surface-200 dark:border-surface-800 w-full"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[10px] font-black text-surface-600 dark:text-surface-400 uppercase tracking-wider leading-tight">{label}</span>
                    <Icon size={13} style={{ color }} className="flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-surface-900 dark:text-surface-100 leading-none">
                      {Number.isFinite(value) && value > 0 ? value.toFixed(key === 'pf' ? 2 : 1) : '—'}
                    </span>
                    {unit && <span className="text-xs font-bold text-surface-400">{unit}</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-surface-400 font-semibold">{agg} · {kpis.onlineCount} online</span>
                    <ChevronRight size={11} className="text-surface-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showTelemetry && (
        <div className="card p-5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-100 dark:border-surface-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="text-primary-600 animate-pulse" size={18} />
              <div>
                <h3 className="text-base font-extrabold text-surface-900 dark:text-surface-100 tracking-tight leading-tight">{panelTitle}</h3>
                <p className="text-xs text-surface-400 font-semibold mt-0.5">
                  {deviceSearch.trim() ? `Search results for "${deviceSearch}"` : 'Showing 5 latest devices. Use search to find more.'}
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" size={13} />
              <input
                type="text"
                className="input pl-8 pr-3 py-1 text-xs bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 w-full"
                placeholder="Search device or gateway..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredDevices.length === 0 ? (
              <div className="p-8 text-center text-xs text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-900/40 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
                No matching devices found.
              </div>
            ) : (
              filteredDevices.map((d) => {
                const offline = isOffline(d)
                return (
                  <div key={d.id} className="p-4 bg-surface-50/50 dark:bg-surface-900/40 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3 hover:border-primary-300 dark:hover:border-primary-800 transition-all duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 dark:border-surface-800/80 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${offline ? 'bg-surface-200 dark:bg-surface-800 text-surface-400' : 'bg-primary-50 dark:bg-primary-950/20 text-primary-600'}`}>
                          <Cpu size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-surface-800 dark:text-surface-100 leading-tight">{highlightMatch(d.name, highlightQuery)}</h4>
                          <p className="text-[10px] text-surface-400 font-bold mt-0.5 uppercase tracking-wide">
                            Gateway: {highlightMatch(d.gateway, highlightQuery)} • Template: {highlightMatch(d.template, highlightQuery)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge ${offline ? 'badge-danger' : 'badge-success'} text-[9px] font-black uppercase tracking-wider`}>
                          {offline ? 'Offline' : 'Online'}
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] text-surface-600 dark:text-surface-400 font-black uppercase select-none">Switch</span>
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {TILE_CONFIG.map(({ key, label, unit, Icon, cls, span }) => (
                        <div key={key} className={`p-3 bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800/80 flex flex-col justify-between min-h-[5.5rem] hover:border-primary-300 dark:hover:border-primary-800 transition-all duration-200${span ? ' col-span-2 sm:col-span-1' : ''}`}>
                          <div className="flex justify-between items-start text-surface-400">
                            <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
                            <Icon size={13} className={offline ? '' : cls} />
                          </div>
                          <div className="mt-1">
                            <span className="text-base font-black text-surface-900 dark:text-surface-100 leading-none">{tileValue(d, key, offline)}</span>
                            {unit && <span className="text-[10px] text-surface-400 font-semibold ml-1">{unit}</span>}
                          </div>
                          <div className="text-[9px] text-surface-400/80 mt-1 truncate border-t border-surface-100 dark:border-surface-800/40 pt-1.5 font-bold uppercase tracking-widest">
                            for {d.name}
                          </div>
                        </div>
                      ))}
                    </div>
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
          unit={drillCfg.unit}
          aggregate={kpis[drillCfg.aggKey]}
          aggregateLabel={drillCfg.agg}
          devices={activeDevices}
          getDeviceValue={(d) => readDeviceMetric(d, drillCfg.metric)}
          gaugeMax={drillCfg.gaugeMax}
          gaugeColor={drillCfg.color}
        />
      )}
    </div>
  )
}
