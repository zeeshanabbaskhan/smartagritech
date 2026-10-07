import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Zap, Activity, Gauge, TrendingUp, Sliders, Radio, Search, ChevronRight, Cpu } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapOrganization } from '../../utils/mappers'
import {
  readDeviceMetric,
  computeDynamicKpis,
  isOffline,
  isSwitchOff,
  unitForVariable,
  isPhaseCurrentVariable,
  getDeviceSourceSlaves,
  getDeviceLoadSlaves,
  getDeviceSourceMetric,
  getDeviceLoadMetric,
  getDeviceWapdaSlaves,
  getDeviceWapdaMetric,
} from '../../utils/deviceMetrics'
import DeviceSlaveMetricsPanel from '../shared/DeviceSlaveMetricsPanel'
import { formatTileValue } from '../shared/dashboardFormatters'
import DrillDownModal from '../ui/DrillDownModal'
import { useToast } from '../../context/ToastContext'
import { onSocketEvent, isSocketEnabled } from '../../services/socketService'
import { resolveBrandPrimary } from '../../utils/branding'

/** Debounce helper — coalesce rapid socket/poll bursts into one callback. */
function useDebouncedCallback(fn, delayMs) {
  const fnRef = useRef(fn)
  const timerRef = useRef(null)
  fnRef.current = fn
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  return useCallback((...args) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fnRef.current(...args), delayMs)
  }, [delayMs])
}
const KPI_REFRESH_DEBOUNCE_MS = 400
const KPI_ICONS = [Zap, Activity, Gauge, TrendingUp, Sliders]
const kpiColors = () => [resolveBrandPrimary(), '#3B82F6', '#22C55E', '#8B5CF6', '#EC4899']

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

/**
 * Shared KPI + Master Device Control panel.
 * @param {'group'|'org'|'device'} filterMode — admin uses `org`; access groups use `group`; org dashboard uses `device`
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
  totalPowerOverride = null,
  totalPowerSubLabel = null,
  sourceSlaveIds = null,
  powerFlow,
  liveSources,
}) {
  const { showToast } = useToast()
  const [devices, setDevices] = useState([])
  const [groups, setGroups] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [metricsRefreshToken, setMetricsRefreshToken] = useState(0)
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
  const isDeviceMode = filterMode === 'device'

  const loadDevices = useCallback(() => {
    emsApi.getDevices({ limit: 100, withMetrics: true })
      .then((res) => {
        setDevices(list(res).map(mapDevice))
        setMetricsRefreshToken((t) => t + 1)
      })
      .catch(() => {})
  }, [])

  const debouncedLoadDevices = useDebouncedCallback(loadDevices, KPI_REFRESH_DEBOUNCE_MS)

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 5000)
    return () => clearInterval(interval)
  }, [loadDevices])

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
      if (event === 'reading:new') {
        setMetricsRefreshToken((t) => t + 1)
        debouncedLoadDevices()
      }
    })
  }, [debouncedLoadDevices])

  useEffect(() => {
    if (!showAccessFilter) return
    if (isDeviceMode) return
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
  }, [showAccessFilter, isOrgMode, isDeviceMode])

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

  const selectedDevice = useMemo(() => {
    if (!isDeviceMode || groupFilter === 'all') return null
    return devices.find((d) => d.id === groupFilter) || null
  }, [isDeviceMode, groupFilter, devices])

  const activeDevices = useMemo(() => {
    if (groupFilter === 'all') return devices
    if (isDeviceMode) {
      return devices.filter((d) => d.id === groupFilter)
    }
    if (isOrgMode) {
      return devices.filter((d) => d.organizationId === groupFilter || d.org === selectedOrg?.name)
    }
    const group = groups.find((g) => g.id === groupFilter)
    if (!group) return devices
    return devices.filter((d) => group.deviceIds.includes(d.id))
  }, [devices, groups, groupFilter, isOrgMode, isDeviceMode, selectedOrg])

  useEffect(() => {
    onScopeChangeRef.current?.({
      filterId: groupFilter,
      organizationId: isOrgMode && groupFilter !== 'all' ? groupFilter : null,
      organization: selectedOrg,
      deviceId: isDeviceMode && groupFilter !== 'all' ? groupFilter : null,
      device: selectedDevice,
      devices: activeDevices,
    })
  }, [groupFilter, isOrgMode, isDeviceMode, selectedOrg, selectedDevice, activeDevices])

  // Join the ids so a freshly-built (but equal) array from the parent does not
  // re-run the KPI aggregation on every render.
  const sourceSlaveIdsKey = Array.isArray(sourceSlaveIds) ? sourceSlaveIds.join(',') : ''
  const kpiState = useMemo(
    () => computeDynamicKpis(activeDevices, { sourceSlaveIds }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDevices, sourceSlaveIdsKey]
  )

  const { onlineSlavesCount, totalSlavesCount } = useMemo(() => {
    let online = 0
    let total = 0
    for (const d of activeDevices) {
      const sList = d.slaves || d.configSlaves || []
      total += sList.length
      online += sList.filter((s) => s.status === 'Online' || s.status === 'ONLINE' || s.statusRaw === 'ONLINE').length
    }
    return { onlineSlavesCount: online, totalSlavesCount: total }
  }, [activeDevices])

  const KPI_CONFIG = useMemo(() => {
    const colors = kpiColors()
    // Calculate sources-based Power Factor across ALL configured source slaves
    let sourcesPfValue = null
    let sourcesCount = 0
    if (groupFilter === 'all') {
      const srcList = (liveSources?.length ? liveSources : powerFlow?.sources) || []
      const configuredSourceIds = new Set([
        ...(Array.isArray(sourceSlaveIds) ? sourceSlaveIds : (sourceSlaveIds instanceof Set ? [...sourceSlaveIds] : [])),
        ...srcList.flatMap((s) => s.slaveIds || []),
      ].map(String))

      const pfVals = []
      const evaluatedSlaves = []

      // Evaluate every slave across active online devices
      for (const d of devices) {
        if (isSwitchOff(d) || isOffline(d)) continue
        const slaves = d.configSlaves || d.slaves || []
        for (const slv of slaves) {
          if (isSwitchOff(slv) || isOffline(slv)) continue
          const idStr = String(slv.id ?? '')
          const isSource = configuredSourceIds.has(idStr)
          if (!isSource) continue

          const p = readDeviceMetric(slv, 'pf')
          if (Number.isFinite(p) && p > 0 && p <= 1.0) {
            pfVals.push(p)
            evaluatedSlaves.push({ name: slv.name, device: d.name, pf: p })
          }
        }
      }

      if (pfVals.length > 0) {
        const sum = pfVals.reduce((a, b) => a + b, 0)
        sourcesPfValue = +(sum / pfVals.length).toFixed(2)
        sourcesCount = pfVals.length
        if (typeof window !== 'undefined') {
          console.log(`[Power Factor KPI] Calculated arithmetic average across ${pfVals.length} source slaves:`, evaluatedSlaves, `Sum: ${sum.toFixed(4)}, Average: ${sourcesPfValue}`)
        }
      } else if (powerFlow?.gridMetrics?.powerFactor != null && Number(powerFlow.gridMetrics.powerFactor) > 0) {
        sourcesPfValue = +Number(powerFlow.gridMetrics.powerFactor).toFixed(2)
        sourcesCount = 1
      }
    } else if (isDeviceMode && selectedDevice) {
      const dp = readDeviceMetric(selectedDevice, 'pf')
      if (Number.isFinite(dp) && dp > 0) {
        sourcesPfValue = dp
      }
    }

    // Ensure all 5 core cards exist: Power, Current A, Current B, Current C, Power Factor
    let baseCards = [...kpiState.cards]
    const hasPf = baseCards.some((c) => c.key === 'pf' || /powerfactor/i.test(c.key) || c.label === 'Power Factor')
    if (!hasPf) {
      baseCards.push({
        key: 'pf',
        label: 'Power Factor',
        metric: 'pf',
        unit: '',
        value: sourcesPfValue != null && Number.isFinite(sourcesPfValue) ? sourcesPfValue : NaN,
        agg: 'Mean',
        gaugeMax: 1.0,
      })
    }

    return baseCards.map((c, i) => {
      const isPf = c.key === 'pf' || /powerfactor/i.test(c.key) || c.label === 'Power Factor'
      const isPower = c.key === 'power' || /total power|totalpower|activepower/i.test(c.label || c.key)
      const useOverride = isPower
        && groupFilter === 'all'
        && totalPowerOverride != null
        && Number.isFinite(totalPowerOverride)

      let finalValue = useOverride ? totalPowerOverride : c.value
      const isCurrent = isPhaseCurrentVariable(c.metric || c.key)
      let finalSub = c.sub || `${c.agg} · ${totalSlavesCount > 0 ? `${onlineSlavesCount} online slaves` : `${kpiState.onlineCount} online`}`

      if (useOverride && totalPowerSubLabel) {
        finalSub = totalPowerSubLabel
      } else if (isCurrent) {
        finalSub = 'Incomer'
      } else if (isPf) {
        if (sourcesPfValue != null && Number.isFinite(sourcesPfValue)) {
          finalValue = sourcesPfValue
        } else if (Number.isFinite(c.value)) {
          finalValue = c.value
        } else {
          finalValue = NaN
        }
        finalSub = 'Mean · All Power Sources'
      }

      return {
        ...c,
        unit: isPf ? '' : c.unit,
        value: finalValue,
        Icon: isPf ? Zap : (KPI_ICONS[i % KPI_ICONS.length] || Sliders),
        color: colors[i % colors.length],
        label: powerKpiLabel && isPower ? powerKpiLabel : c.label,
        sub: finalSub,
        subLabel: finalSub,
      }
    })
  }, [kpiState.cards, powerKpiLabel, groupFilter, isDeviceMode, selectedDevice, totalPowerOverride, totalPowerSubLabel, liveSources, powerFlow, devices, sourceSlaveIds, totalSlavesCount, onlineSlavesCount, kpiState.onlineCount])

  const activeGroupLabel = useMemo(() => {
    if (groupFilter === 'all') return allDevicesLabel
    if (isDeviceMode) return selectedDevice?.name || allDevicesLabel
    if (isOrgMode) return selectedOrg?.name || allDevicesLabel
    const g = groups.find((x) => x.id === groupFilter)
    return g ? `${g.name} (${g.org})` : allDevicesLabel
  }, [groupFilter, groups, allDevicesLabel, isOrgMode, isDeviceMode, selectedOrg, selectedDevice])

  const deviceFilterOptions = useMemo(() => (
    [...devices].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  ), [devices])

  const searchedOptions = useMemo(() => {
    const q = filterSearch.toLowerCase().trim()
    if (isDeviceMode) {
      if (!q) return deviceFilterOptions
      return deviceFilterOptions.filter((d) =>
        (d.name || '').toLowerCase().includes(q)
        || (d.gateway || '').toLowerCase().includes(q)
        || (d.status || '').toLowerCase().includes(q)
      )
    }
    if (isOrgMode) {
      if (!q) return organizations
      return organizations.filter((o) =>
        o.name.toLowerCase().includes(q) || (o.status || '').toLowerCase().includes(q)
      )
    }
    if (!q) return groups
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.org.toLowerCase().includes(q))
  }, [groups, organizations, deviceFilterOptions, filterSearch, isOrgMode, isDeviceMode])

  const filterSearchPlaceholder = isDeviceMode
    ? 'Search devices...'
    : isOrgMode
      ? 'Search organizations...'
      : 'Search groups...'
  const emptyFilterHint = isDeviceMode
    ? (emptyGroupsHint === 'No groups found.' ? 'No devices found.' : emptyGroupsHint)
    : emptyGroupsHint
  const noMatchHint = isDeviceMode
    ? 'No matching devices found.'
    : isOrgMode
      ? 'No matching organizations found.'
      : 'No matching groups found.'
  const optionList = isDeviceMode ? deviceFilterOptions : isOrgMode ? organizations : groups

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.toLowerCase().trim()
    const ranked = [...activeDevices].sort((a, b) => {
      const aOff = isOffline(a) || isSwitchOff(a) ? 1 : 0
      const bOff = isOffline(b) || isSwitchOff(b) ? 1 : 0
      if (aOff !== bOff) return aOff - bOff
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
    if (!q) return ranked
    return ranked.filter((d) =>
      d.name.toLowerCase().includes(q)
      || (d.gateway ?? '').toLowerCase().includes(q)
      || (d.org ?? '').toLowerCase().includes(q)
      || (d.template ?? '').toLowerCase().includes(q)
    )
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

  const drillScope = useMemo(() => {
    if (!drillCfg) return null
    const isPower = drillCfg.key === 'power' || /total power|totalpower|activepower|totalactivepower/i.test(drillCfg.metric || drillCfg.label || '')
    const isCurrent = isPhaseCurrentVariable(drillCfg.metric || drillCfg.key)

    if (isPower) {
      const sourceDevs = activeDevices.filter((d) => getDeviceSourceSlaves(d, { sourceSlaveIds }).length > 0)
      return {
        devices: sourceDevs,
        getValue: (device) => getDeviceSourceMetric(device, drillCfg.metric || 'power', { sourceSlaveIds }),
      }
    }

    if (isCurrent) {
      const wapdaDevs = activeDevices.filter((d) => getDeviceWapdaSlaves(d).length > 0)
      return {
        devices: wapdaDevs,
        getValue: (device) => getDeviceWapdaMetric(device, drillCfg.metric),
      }
    }

    return {
      devices: activeDevices,
      getValue: (device) => readDeviceMetric(device, drillCfg.metric),
    }
  }, [drillCfg, activeDevices, sourceSlaveIds])
  const defaultTelemetryHint = deviceSearch.trim()
    ? `Search results for "${deviceSearch}"`
    : (telemetrySubtitle || `${activeDevices.length} device${activeDevices.length === 1 ? '' : 's'} in scope (online first).`)

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
                        placeholder={filterSearchPlaceholder}
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
                      {optionList.length === 0 ? (
                        <p className="p-3 text-[10px] text-center text-surface-400 font-medium">{emptyFilterHint}</p>
                      ) : searchedOptions.length === 0 ? (
                        <p className="p-3 text-xs text-center text-surface-400">{noMatchHint}</p>
                      ) : isDeviceMode ? (
                        searchedOptions.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => { setGroupFilter(d.id); setFilterOpen(false); setFilterSearch('') }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 flex flex-col ${groupFilter === d.id ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20' : 'text-surface-700 dark:text-surface-300'}`}
                          >
                            <span>{d.name}</span>
                            <span className="text-[9px] text-surface-400 font-normal">
                              {d.gateway || '—'}{d.status ? ` · ${d.status}` : ''}
                            </span>
                          </button>
                        ))
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

          <div className={`grid grid-cols-2 gap-3.5 sm:grid-cols-2 md:grid-cols-3 ${KPI_CONFIG.length >= 5 ? 'lg:grid-cols-5' : KPI_CONFIG.length === 4 ? 'lg:grid-cols-4' : KPI_CONFIG.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            {KPI_CONFIG.length === 0 ? (
              <div className="col-span-2 lg:col-span-4 card p-4 text-xs text-surface-500">
                No live variables yet — start the MQTT bridge so device readings appear here.
              </div>
            ) : (
              KPI_CONFIG.map(({ key, label, unit, Icon, color, agg, value, sub, subLabel }) => {
                const isPf = key === 'pf' || /powerfactor/i.test(key) || label === 'Power Factor'
                const canDrill = !isPf

                return (
                  <div
                    key={key}
                    role={canDrill ? 'button' : undefined}
                    tabIndex={canDrill ? 0 : undefined}
                    onClick={() => canDrill && setDrillMetric(key)}
                    onKeyDown={(e) => canDrill && (e.key === 'Enter' || e.key === ' ') && setDrillMetric(key)}
                    className={`card p-4 text-left border border-surface-200 dark:border-surface-800 w-full transition-all duration-200 ${
                      canDrill
                        ? 'hover:shadow-elevated hover:border-primary-200 dark:hover:border-primary-800 cursor-pointer group'
                        : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-black text-surface-400 uppercase tracking-wider leading-tight truncate pr-2">{label}</span>
                      <Icon size={13} style={{ color }} className="flex-shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="device-metric-value text-2xl font-black leading-none">
                        {Number.isFinite(value) ? formatTileValue(value, key) : '—'}
                      </span>
                      {unit ? <span className="text-xs font-bold text-surface-400">{unit}</span> : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-surface-400 font-semibold">
                        {subLabel || sub || `${agg} · ${totalSlavesCount > 0 ? `${onlineSlavesCount} online slaves` : `${kpiState.onlineCount} online`}`}
                      </span>
                      {canDrill && (
                        <ChevronRight size={11} className="text-surface-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                      )}
                    </div>
                  </div>
                )
              })
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

          <div className="grid grid-cols-1 gap-6 max-h-[70vh] overflow-y-auto pr-1">
            {filteredDevices.length === 0 ? (
              <div className="p-8 text-center text-xs text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-900/40 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
                No matching devices found.
              </div>
            ) : (
              filteredDevices.map((d) => {
                const offline = isOffline(d)
                const switchOff = isSwitchOff(d)
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

                    <DeviceSlaveMetricsPanel
                      deviceId={d.id}
                      switchOn={!switchOff}
                      compact
                      liveRefresh={false}
                      refreshToken={metricsRefreshToken}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {showKpis && drillCfg && drillCfg.key !== 'pf' && !/powerfactor/i.test(drillCfg.key) && drillScope && (
        <DrillDownModal
          open
          onClose={() => setDrillMetric(null)}
          metric={drillCfg.label}
          unit={drillCfg.unit || unitForVariable(drillCfg.metric)}
          aggregate={drillCfg.value}
          aggregateLabel={drillCfg.agg}
          devices={drillScope.devices}
          getDeviceValue={drillScope.getValue}
          gaugeMax={drillCfg.gaugeMax}
          gaugeColor={drillCfg.color}
        />
      )}
    </div>
  )
}
