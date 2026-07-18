import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import DrillDownModal from '../../components/ui/DrillDownModal'
import Modal from '../../components/ui/Modal'
import PowerFlowMindMap from '../../components/ui/PowerFlowMindMap'
import { Cpu, AlertTriangle, Zap, CheckCircle, Smartphone, Radio, Activity, Gauge, TrendingUp, Search, ChevronRight, Clock3 } from 'lucide-react'
import { orgStats, historicalData, devices } from '../../data/dummy'
import { useAuth } from '../../context/AuthContext'
import { useAccessGroups } from '../../context/AccessGroupContext'
import { useDeviceGroups } from '../../context/DeviceGroupContext'
import { Skeleton } from 'boneyard-js/react'

// Real-time telemetry generator (returns string for display)
function getLiveTelemetry(deviceName, metricKey, isOffline, tick) {
  if (isOffline) {
    if (metricKey === 'status') return 'Offline'
    return '0.0'
  }
  const codeSum = deviceName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const seed = codeSum + tick * 7.3
  const rand = (Math.sin(seed) + 1) / 2

  switch (metricKey) {
    case 'power': return (rand * 100 + 10).toFixed(1)
    case 'voltage': return (218 + rand * 22).toFixed(1)
    case 'current': return (6 + rand * 64).toFixed(1)
    case 'pf': return (0.85 + rand * 0.14).toFixed(2)
    case 'consumption': return (new Date().getHours() * 9 + rand * 8 + 25).toFixed(1)
    case 'status': return 'Online'
    default: return '0.0'
  }
}

// Numeric variant for KPI aggregates
function getLiveTelemetryNum(deviceName, metricKey, isOffline, tick) {
  if (isOffline) return 0
  const codeSum = deviceName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const seed = codeSum + tick * 7.3
  const rand = (Math.sin(seed) + 1) / 2
  switch (metricKey) {
    case 'power': return rand * 100 + 10
    case 'voltage': return 218 + rand * 22
    case 'current': return 6 + rand * 64
    case 'pf': return 0.85 + rand * 0.14
    default: return 0
  }
}

// Deterministic 24h series per energy source, shaped to look physically sensible:
// Solar follows a daylight bell curve, Generator mostly stays on standby (0) with rare spikes,
// Grid fills in whatever Solar + Generator don't cover.
function buildSourceSeries(orgName) {
  const codeSum = orgName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return historicalData.map((row, i) => {
    const hour = i * 2
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) // 0 at night, peak at ~12:00
    const solar = +(daylight * (6 + (codeSum % 5)) * (0.85 + 0.3 * Math.sin(codeSum + i))).toFixed(2)
    const generator = i % 5 === 0 ? +((codeSum % 3) * 0.4).toFixed(2) : 0
    const load = +(row.power / 1000).toFixed(2) // reuse the historical power series, scaled to kW
    const grid = +Math.max(0, load - solar - generator).toFixed(2)
    return { time: row.time, solar: Math.max(0, solar), generator, grid, load }
  })
}

function seedNum(str = '') {
  return String(str).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

// Deterministic 24h load curve per device group, shaped around each group's
// current live load so the chart stays visually consistent with the KPI/bar
// values shown elsewhere, while every group is plotted on one shared timeline.
function buildDeviceGroupSeries(groupsWithLoad) {
  return historicalData.map((row, i) => {
    const hour = i * 2
    const entry = { time: row.time }
    groupsWithLoad.forEach(g => {
      const seed = seedNum(g.name)
      const dayCurve = 0.55 + 0.45 * Math.sin(((hour - 6) / 12) * Math.PI + (seed % 6))
      const base = Math.max(0.4, g.load || 0.4)
      entry[g.id] = +Math.max(0, base * (0.35 + dayCurve * 0.9)).toFixed(2)
    })
    return entry
  })
}

const GROUP_LINE_COLORS = ['#8B5CF6', '#F5A623', '#3B82F6', '#22C55E', '#EC4899', '#14B8A6', '#F97316', '#6366F1']

const highlightMatch = (text, search) => {
  if (!search || !text) return text
  const parts = String(text).split(new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  )
}

export default function OrgDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()
  const orgName = user?.name || 'Ambition'
  const { groups } = useAccessGroups()
  const { getDeviceGroupsForOrg } = useDeviceGroups()

  // Find groups created by Org Admin for this organization
  const orgGroups = useMemo(() => groups.filter(g => g.org === orgName && g.createdBy === 'org'), [groups, orgName])

  // Device Groups (from the Device Groups page) — used to break down load in the Power Flow widget
  const powerFlowGroups = useMemo(() => getDeviceGroupsForOrg(orgName), [getDeviceGroupsForOrg, orgName])

  const [globalDeviceList, setGlobalDeviceList] = useState(() => {
    const defaultDevices = devices.filter(d => d.org === orgName)
    try {
      const saved = localStorage.getItem('cf-ems-devices')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed
      }
      return defaultDevices
    } catch {
      return defaultDevices
    }
  })

  // sync to localStorage
  useEffect(() => {
    localStorage.setItem('cf-ems-devices', JSON.stringify(globalDeviceList))
  }, [globalDeviceList])

  // Get allowed device IDs assigned by Super Admin for this organization
  const adminAllowedDeviceIds = useMemo(() => {
    const adminGroups = groups.filter(g => g.org === orgName && g.createdBy === 'admin')
    if (adminGroups.length === 0) return null // No admin restrictions, show all devices
    const ids = new Set()
    adminGroups.forEach(g => {
      g.deviceIds?.forEach(id => ids.add(id))
    })
    return Array.from(ids)
  }, [groups, orgName])

  // Filter deviceList to only include devices allowed by Super Admin
  const deviceList = useMemo(() => {
    const orgDevices = globalDeviceList.filter(d => d.org === orgName)
    if (adminAllowedDeviceIds === null) return orgDevices
    return orgDevices.filter(d => adminAllowedDeviceIds.includes(d.id))
  }, [globalDeviceList, orgName, adminAllowedDeviceIds])

  const [deviceSearchQuery, setDeviceSearchQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [drillMetric, setDrillMetric] = useState(null)
  const location = useLocation()
  const highlightQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('highlight') || ''
  }, [location.search])

  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [filterSearchQuery, setFilterSearchQuery] = useState('')

  // Selected group label
  const activeGroupLabel = useMemo(() => {
    if (groupFilter === 'all') return 'All Organization Devices'
    const match = orgGroups.find(g => g.id === groupFilter)
    return match ? match.name : 'All Organization Devices'
  }, [groupFilter, orgGroups])

  // Filter groups by search query
  const searchedGroups = useMemo(() => {
    const q = filterSearchQuery.toLowerCase().trim()
    if (!q) return orgGroups
    return orgGroups.filter(g => g.name.toLowerCase().includes(q))
  }, [orgGroups, filterSearchQuery])

  // Click outside listener to close filter dropdown
  useEffect(() => {
    if (!filterDropdownOpen) return
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.group-filter-dropdown-container')) {
        setFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [filterDropdownOpen])

  const filteredDevices = useMemo(() => {
    if (deviceSearchQuery.trim()) {
      const q = deviceSearchQuery.toLowerCase().trim()
      return deviceList.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.gateway.toLowerCase().includes(q) ||
        d.template.toLowerCase().includes(q)
      )
    }
    return [...deviceList].reverse().slice(0, 5)
  }, [deviceList, deviceSearchQuery])

  // Devices in the selected access group (for KPI aggregation)
  const activeDevices = useMemo(() => {
    if (groupFilter === 'all') return deviceList
    const group = orgGroups.find(g => g.id === groupFilter)
    return group ? deviceList.filter(d => group.deviceIds.includes(d.id)) : deviceList
  }, [deviceList, groupFilter, orgGroups])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800)
    const interval = setInterval(() => setTick(t => t + 1), 5000)
    return () => { clearTimeout(timer); clearInterval(interval) }
  }, [])

  // KPI aggregates
  const kpiValues = useMemo(() => {
    const isOff = (d) => d.status === 'Offline' || !d.switchOn
    const online = activeDevices.filter(d => !isOff(d))
    const sum = (m) => online.reduce((s, d) => s + getLiveTelemetryNum(d.name, m, false, tick), 0)
    const mean = (m) => online.length ? sum(m) / online.length : 0
    return {
      totalPower: sum('power'),
      totalCurrent: sum('current'),
      avgVoltage: mean('voltage'),
      avgPF: mean('pf'),
      onlineCount: online.length,
    }
  }, [activeDevices, tick])

  // 24h Solar / Generator / Grid / Load series for the charts at the bottom of the page
  const sourceSeries = useMemo(() => buildSourceSeries(orgName), [orgName])

  // Estimated cost savings from Solar + Generator offsetting Grid import,
  // using the org's tariff (PKR 28/unit, same rate used on the Slab Rates page).
  const savings = useMemo(() => {
    const TARIFF_PKR_PER_KWH = 28
    const SAMPLE_INTERVAL_HOURS = 2 // sourceSeries is sampled every 2 hours across the day
    const dailyOffsetKWh = sourceSeries.reduce((sum, row) => sum + (row.solar + row.generator) * SAMPLE_INTERVAL_HOURS, 0)
    return {
      dailyKWh: +dailyOffsetKWh.toFixed(1),
      daily: Math.round(dailyOffsetKWh * TARIFF_PKR_PER_KWH),
      weekly: Math.round(dailyOffsetKWh * 7 * TARIFF_PKR_PER_KWH),
      monthly: Math.round(dailyOffsetKWh * 30 * TARIFF_PKR_PER_KWH),
    }
  }, [sourceSeries])

  // Live instantaneous values for the Power Flow widget, derived from the same
  // total-load KPI so the numbers stay internally consistent (Solar + Generator + Grid = Load)
  const powerFlow = useMemo(() => {
    const codeSum = orgName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const hour = new Date().getHours()
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
    const rand = (Math.sin(codeSum + tick * 4.1) + 1) / 2
    const solar = +(daylight * (kpiValues.totalPower * 0.6 + rand * 3)).toFixed(1)
    const generator = tick % 9 === 0 ? +(rand * 2).toFixed(1) : 0
    const net = +(kpiValues.totalPower - solar - generator).toFixed(1)
    return {
      solar,
      generator,
      grid: Math.abs(net),
      gridMode: net >= 0 ? 'Importing' : 'Exporting',
      load: kpiValues.totalPower,
    }
  }, [orgName, tick, kpiValues.totalPower])

  // Load per Device Group (created in the Device Groups page), for the Power Flow widget
  const deviceGroupLoads = useMemo(() => {
    const isOff = (d) => d.status === 'Offline' || !d.switchOn
    return powerFlowGroups.map(g => {
      const groupDevices = deviceList.filter(d => g.deviceIds?.includes(d.id))
      const onlineDevices = groupDevices.filter(d => !isOff(d))
      const load = onlineDevices.reduce((s, d) => s + getLiveTelemetryNum(d.name, 'power', false, tick), 0)
      return { id: g.id, name: g.name, deviceCount: groupDevices.length, load: +load.toFixed(2), active: onlineDevices.length > 0 }
    })
  }, [powerFlowGroups, deviceList, tick])

  // 24h series (one line per device group) for the combined "all groups on one graph" chart
  const deviceGroupSeries = useMemo(() => buildDeviceGroupSeries(deviceGroupLoads), [deviceGroupLoads])

  // Selected Device Group for the "view all devices" drill-down (mind map leaf click / bar chart click)
  const [openGroupId, setOpenGroupId] = useState(null)
  const openGroupDevices = (groupId) => setOpenGroupId(groupId)
  const closeGroupDevices = () => setOpenGroupId(null)

  const openGroup = useMemo(
    () => powerFlowGroups.find(g => g.id === openGroupId) || null,
    [powerFlowGroups, openGroupId]
  )
  const openGroupDeviceList = useMemo(() => {
    if (!openGroup) return []
    return deviceList.filter(d => openGroup.deviceIds?.includes(d.id))
  }, [openGroup, deviceList])

  const handleToggleSwitch = (id) => {
    setGlobalDeviceList(prev => {
      const nextList = prev.map(d => (d.id === id ? { ...d, switchOn: !d.switchOn, status: !d.switchOn ? 'Online' : 'Offline' } : d))
      try {
        localStorage.setItem('cf-ems-devices', JSON.stringify(nextList))
      } catch (e) { console.error(e) }
      return nextList
    })
  }

  const onlineCount = deviceList.filter(d => d.status === 'Online' && d.switchOn).length
  const offlineCount = deviceList.length - onlineCount

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-surface-200 p-3 rounded-lg shadow-floating text-xs font-semibold text-surface-800">
          {label && <p className="text-surface-400 mb-1 font-bold">{label}</p>}
          {payload.map((item, i) => (
            <div key={i} className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
              <span>{item.name}:</span>
              <span className="text-surface-900 font-bold">{item.value} {item.unit || ''}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const kpiConfig = [
    { key: 'power', label: 'Total Power Consumption', value: kpiValues.totalPower, unit: 'kW', Icon: Zap, color: '#F5A623', gaugeMax: 110, agg: 'Sum' },
    { key: 'current', label: 'Total Current', value: kpiValues.totalCurrent, unit: 'A', Icon: Activity, color: '#3B82F6', gaugeMax: 70, agg: 'Sum' },
    { key: 'voltage', label: 'Avg Voltage', value: kpiValues.avgVoltage, unit: 'V', Icon: Gauge, color: '#22C55E', gaugeMax: 240, agg: 'Mean' },
    { key: 'pf', label: 'Avg Power Factor', value: kpiValues.avgPF, unit: '', Icon: TrendingUp, color: '#8B5CF6', gaugeMax: 1, agg: 'Mean' },
  ]

  return (
    <Skeleton name="org-dashboard" loading={isLoading} transition={300}>
      <div className="space-y-6">

        {/* ── Power Flow Mind Map ── */}
        <div className="card p-5">

          <h3 className="text-2xl font-extrabold tracking-tight text-center mb-3 bg-gradient-to-r from-primary-500 via-purple-500 to-success-500 bg-clip-text text-transparent">
            Energy Flow Overview
          </h3>
          <PowerFlowMindMap
            powerFlow={powerFlow}
            orgName={orgName}
            groups={deviceGroupLoads}
            onGroupClick={openGroupDevices}
            savings={savings}
          />

          <div className="flex items-center justify-center gap-5 mt-2 pt-3 border-t border-surface-100 dark:border-surface-800 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 bg-primary-400 inline-block" /> Sources</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 bg-success-600 inline-block" /> Load</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: '#8B5CF6' }} /> Groups</span>
          </div>
        </div>

        {/* ── KPI Summary Section ── */}
        <div className="space-y-3">
          {/* Group filter chips (only if org has groups) */}
          {/* Group filter dropdown (only if org has groups) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest flex-shrink-0">
              Filter KPIs:
            </span>
            <div className="relative group-filter-dropdown-container">
              <button
                type="button"
                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl border bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:border-primary-500 transition-colors"
              >
                <Search size={12} className="text-surface-400" />
                <span className="text-surface-800 dark:text-surface-100">{activeGroupLabel}</span>
                <span className="text-[9px] text-surface-400">▼</span>
              </button>

              {filterDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-floating z-[999] overflow-hidden">
                  <div className="p-2 border-b border-surface-100 dark:border-surface-800">
                    <input
                      type="text"
                      className="w-full px-2 py-1 text-xs input"
                      placeholder="Search groups..."
                      value={filterSearchQuery}
                      onChange={e => setFilterSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-surface-50 dark:divide-surface-850">
                    <button
                      type="button"
                      onClick={() => {
                        setGroupFilter('all')
                        setFilterDropdownOpen(false)
                        setFilterSearchQuery('')
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 ${groupFilter === 'all' ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20' : 'text-surface-700 dark:text-surface-300'
                        }`}
                    >
                      All Organization Devices
                    </button>
                    {orgGroups.length === 0 ? (
                      <p className="p-3 text-[10px] text-center text-surface-400 font-medium">
                        No groups created yet. Go to "Access Groups" to create one.
                      </p>
                    ) : searchedGroups.length === 0 ? (
                      <p className="p-3 text-[10px] text-center text-surface-400 font-medium">No matching groups found.</p>
                    ) : (
                      searchedGroups.map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setGroupFilter(g.id)
                            setFilterDropdownOpen(false)
                            setFilterSearchQuery('')
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 flex flex-col ${groupFilter === g.id ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/20' : 'text-surface-700 dark:text-surface-300'
                            }`}
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

          {/* 4 Clickable KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiConfig.map(({ key, label, value, unit, Icon, color, gaugeMax, agg }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDrillMetric(key)}
                className="card p-4 text-left hover:shadow-elevated hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200 cursor-pointer group border border-surface-200 dark:border-surface-800 w-full"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] font-black text-surface-400 uppercase tracking-wider leading-tight">
                    {label}
                  </span>
                  <Icon size={13} style={{ color }} className="flex-shrink-0 mt-0.5" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-surface-900 dark:text-surface-100 leading-none">
                    {value > 0 ? value.toFixed(key === 'pf' ? 2 : 1) : '—'}
                  </span>
                  {unit && <span className="text-xs font-bold text-surface-400">{unit}</span>}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-surface-400 font-semibold">
                    {agg} · {kpiValues.onlineCount} online
                  </span>
                  <ChevronRight size={11} className="text-surface-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="My Devices" value={deviceList.length} icon={Cpu} color="primary" />
          <StatCard label="Online Devices" value={onlineCount} icon={CheckCircle} color="success" />
          <StatCard label="Active Alarms" value={offlineCount > 0 ? 1 : 0} icon={AlertTriangle} color="warning" />
          <StatCard label="Monthly Energy" value={orgStats.monthlyEnergy} icon={Zap} color="info" />
        </div>


        {/* Solar / Grid / Generator / Load — combined in one graph, differentiated by color */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Power Sources — Last 24 Hours</h3>
          <p className="text-xs text-surface-400 mt-1 mb-4">Solar, Generator, Grid and total Load over the last 24 hours — hover to compare all four at once</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={sourceSeries}>
              <defs>
                <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="generatorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="load" stroke="#8B5CF6" fill="url(#loadGrad)" strokeWidth={2} name="Load" unit="kW" />
              <Area type="monotone" dataKey="solar" stroke="#F5A623" fill="url(#solarGrad)" strokeWidth={2} name="Solar" unit="kW" />
              <Area type="monotone" dataKey="generator" stroke="#22C55E" fill="url(#generatorGrad)" strokeWidth={2} name="Generator" unit="kW" />
              <Area type="monotone" dataKey="grid" stroke="#3B82F6" fill="url(#gridGrad)" strokeWidth={2} name="Grid" unit="kW" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
            {[
              { label: 'Load', color: '#8B5CF6' },
              { label: 'Solar', color: '#F5A623' },
              { label: 'Generator', color: '#22C55E' },
              { label: 'Grid', color: '#3B82F6' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-surface-500">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* Device Groups — all groups' load plotted on one graph, hover for per-group detail */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Asset Group Load — Last 24 Hours</h3>
          <p className="text-xs text-surface-400 mt-1 mb-4">Every device group at {orgName} plotted together — hover any point to see each group's detailed value, or click a group below to view its devices</p>
          {deviceGroupLoads.length === 0 ? (
            <div className="p-8 text-center text-xs text-surface-450 dark:text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-850/20 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
              No device groups yet. Create one in "Device Groups" to see the comparison here.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={deviceGroupSeries}>
                  <defs>
                    {deviceGroupLoads.map((g, i) => (
                      <linearGradient key={g.id} id={`groupGrad${g.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length]} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <Tooltip content={<CustomTooltip />} />
                  {deviceGroupLoads.map((g, i) => (
                    <Area
                      key={g.id}
                      type="monotone"
                      dataKey={g.id}
                      stroke={GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length]}
                      fill={`url(#groupGrad${g.id})`}
                      strokeWidth={2}
                      name={g.name}
                      unit="kW"
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                {deviceGroupLoads.map((g, i) => (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => openGroupDevices(g.id)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 px-2 py-1 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length] }} />
                    {g.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Consumption Chart */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-surface-900 leading-none">Power Consumption — Last 24 Hours</h3>
            <p className="text-xs text-surface-400 mt-1 mb-4">Real-time load in kW logged at {orgName}</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="orgPowerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A623" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="power" stroke="#F5A623" fill="url(#orgPowerGrad)" strokeWidth={2} name="Load" unit="kW" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* DEVICE TELEMETRY CONTROL PANEL — moved to bottom, below all charts */}
        <div className="card p-5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-100 dark:border-surface-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="text-primary-600 animate-pulse" size={18} />
              <div>
                <h3 className="text-base font-extrabold text-surface-900 tracking-tight leading-tight">Device Telemetry</h3>
                <p className="text-xs text-surface-400 font-semibold mt-0.5">
                  {deviceSearchQuery.trim()
                    ? `Search results for "${deviceSearchQuery}"`
                    : `Showing 5 latest devices. Use the search bar to find past devices for ${orgName}.`}
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" size={13} />
              <input
                type="text"
                className="input pl-8 pr-3 py-1 text-xs bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 w-full"
                placeholder="Search device or gateway..."
                value={deviceSearchQuery}
                onChange={e => setDeviceSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredDevices.length === 0 ? (
              <div className="p-8 text-center text-xs text-surface-450 dark:text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-850/20 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
                No matching devices found. Clear search to see latest devices.
              </div>
            ) : (
              filteredDevices.map(d => {
                const isOffline = d.status === 'Offline' || !d.switchOn
                return (
                  <div key={d.id} className="p-4 bg-surface-50/50 dark:bg-surface-850/40 rounded-xl border border-surface-150 dark:border-surface-800 space-y-3 hover:border-primary-300 dark:hover:border-primary-800 transition-all duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 dark:border-surface-800/80 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isOffline ? 'bg-surface-200 dark:bg-surface-800 text-surface-400' : 'bg-primary-50 dark:bg-primary-950/20 text-primary-600'}`}>
                          <Cpu size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-surface-800 dark:text-surface-100 leading-tight">
                            {highlightMatch(d.name, highlightQuery)}
                          </h4>
                          <p className="text-[10px] text-surface-400 font-bold mt-0.5 uppercase tracking-wide">
                            Gateway: {highlightMatch(d.gateway, highlightQuery)} • Template: {highlightMatch(d.template, highlightQuery)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge ${isOffline ? 'badge-danger' : 'badge-success'} text-[9px] font-black uppercase tracking-wider`}>
                          {isOffline ? 'Offline' : 'Online'}
                        </span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] text-surface-400 font-black uppercase select-none">Switch</span>
                          <button
                            type="button"
                            onClick={() => handleToggleSwitch(d.id)}
                            className={`relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${d.switchOn ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-700'}`}
                          >
                            <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${d.switchOn ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {[
                        { key: 'power', label: 'Active Power', unit: 'kW', cls: 'text-amber-500' },
                        { key: 'current', label: 'Current', unit: 'A', cls: 'text-info-500' },
                        { key: 'voltage', label: 'Voltage', unit: 'V', cls: 'text-success-500' },
                        { key: 'pf', label: 'Power Factor', unit: '', cls: 'text-primary-500' },
                        { key: 'consumption', label: 'Energy Consumption', unit: 'kWh', cls: 'text-warning-500', span: true },
                      ].map(({ key, label, unit, cls, span }) => (
                        <div key={key} className={`p-3 bg-white dark:bg-surface-900 rounded-lg border border-surface-150 dark:border-surface-800/80 flex flex-col justify-between min-h-[5.5rem] group hover:border-primary-300 dark:hover:border-primary-800 transition-all duration-200${span ? ' col-span-2 sm:col-span-1' : ''}`}>
                          <div className="flex justify-between items-start text-surface-400">
                            <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-base font-black text-surface-900 dark:text-surface-100 leading-none">
                              {getLiveTelemetry(d.name, key, isOffline, tick)}
                            </span>
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

        {/* Device Group — Devices Drill-Down Modal */}
        <Modal
          open={openGroup !== null}
          onClose={closeGroupDevices}
          size="lg"
          title={openGroup ? `${openGroup.name} — Devices` : 'Devices'}
        >
          {openGroupDeviceList.length === 0 ? (
            <p className="text-xs text-surface-400 p-3 bg-surface-50 dark:bg-surface-850/40 rounded-lg">
              This group has no devices assigned yet.
            </p>
          ) : (
            <div className="space-y-3">
              {openGroupDeviceList.map(d => {
                const isOffline = d.status === 'Offline' || !d.switchOn
                return (
                  <div key={d.id} className="p-3 bg-surface-50/60 dark:bg-surface-850/40 rounded-xl border border-surface-150 dark:border-surface-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Cpu size={13} className="text-surface-400" />
                        <span className="text-xs font-black text-surface-800 dark:text-surface-100">{d.name}</span>
                      </div>
                      <span className={`badge ${isOffline ? 'badge-neutral' : 'badge-success'} text-[9px]`}>
                        {isOffline ? 'Offline' : 'Online'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { key: 'power', label: 'Power', unit: 'kW' },
                        { key: 'current', label: 'Current', unit: 'A' },
                        { key: 'voltage', label: 'Voltage', unit: 'V' },
                        { key: 'pf', label: 'PF', unit: '' },
                      ].map(({ key, label, unit }) => (
                        <div key={key} className="p-2 bg-white dark:bg-surface-900 rounded-lg border border-surface-100 dark:border-surface-800">
                          <p className="text-[9px] text-surface-400 font-bold uppercase">{label}</p>
                          <p className="text-xs font-black text-surface-900 dark:text-surface-100">
                            {getLiveTelemetry(d.name, key, isOffline, tick)} <span className="text-[9px] text-surface-400 font-semibold">{unit}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>

        {/* Drill-Down Modal */}
        {drillMetric && (() => {
          const isOff = (d) => d.status === 'Offline' || !d.switchOn
          const cfg = {
            power: { label: 'Total Power Consumption', unit: 'kW', max: 110, color: '#F5A623', agg: 'Sum', val: kpiValues.totalPower, fn: d => getLiveTelemetryNum(d.name, 'power', isOff(d), tick) },
            current: { label: 'Total Current', unit: 'A', max: 70, color: '#3B82F6', agg: 'Sum', val: kpiValues.totalCurrent, fn: d => getLiveTelemetryNum(d.name, 'current', isOff(d), tick) },
            voltage: { label: 'Average Voltage', unit: 'V', max: 240, color: '#22C55E', agg: 'Mean', val: kpiValues.avgVoltage, fn: d => getLiveTelemetryNum(d.name, 'voltage', isOff(d), tick) },
            pf: { label: 'Avg Power Factor', unit: '', max: 1, color: '#8B5CF6', agg: 'Mean', val: kpiValues.avgPF, fn: d => getLiveTelemetryNum(d.name, 'pf', isOff(d), tick) },
          }[drillMetric]
          return (
            <DrillDownModal
              open
              onClose={() => setDrillMetric(null)}
              metric={cfg.label}
              unit={cfg.unit}
              aggregate={cfg.val}
              aggregateLabel={cfg.agg}
              devices={activeDevices}
              getDeviceValue={cfg.fn}
              gaugeMax={cfg.max}
              gaugeColor={cfg.color}
            />
          )
        })()}
      </div>
    </Skeleton>
  )
}
