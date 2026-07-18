import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import DrillDownModal from '../../components/ui/DrillDownModal'
import { Cpu, Bell, AlertTriangle, CreditCard, Shield, Calendar, ArrowUpRight, Radio, Zap, Activity, Gauge, TrendingUp, Search, ChevronRight } from 'lucide-react'
import { userStats, historicalData, notifications, devices, users as initialUsers } from '../../data/dummy'
import { useAuth } from '../../context/AuthContext'
import { useAccessGroups } from '../../context/AccessGroupContext'
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
    case 'power':       return (rand * 80 + 8).toFixed(1)
    case 'voltage':     return (218 + rand * 22).toFixed(1)
    case 'current':     return (5 + rand * 55).toFixed(1)
    case 'pf':          return (0.86 + rand * 0.13).toFixed(2)
    case 'consumption': return (new Date().getHours() * 8 + rand * 7 + 20).toFixed(1)
    case 'status':      return 'Online'
    default:            return '0.0'
  }
}

// Numeric variant for KPI aggregates
function getLiveTelemetryNum(deviceName, metricKey, isOffline, tick) {
  if (isOffline) return 0
  const codeSum = deviceName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const seed = codeSum + tick * 7.3
  const rand = (Math.sin(seed) + 1) / 2
  switch (metricKey) {
    case 'power':   return rand * 80 + 8
    case 'voltage': return 218 + rand * 22
    case 'current': return 5 + rand * 55
    case 'pf':      return 0.86 + rand * 0.13
    default:        return 0
  }
}

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

export default function UserDashboard() {
  const { user } = useAuth()
  const { groups } = useAccessGroups()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab,  setActiveTab]  = useState('Today')
  const [drillMetric, setDrillMetric] = useState(null)

  const allUsers = useMemo(() => {
    try {
      const saved = localStorage.getItem('cf-ems-users')
      return saved ? JSON.parse(saved) : initialUsers
    } catch {
      return initialUsers
    }
  }, [])

  const dbUser = useMemo(() => allUsers.find(u => u.email === user?.email), [allUsers, user])
  const orgName = dbUser?.org || 'Delicia Warehouse'

  const [globalDeviceList, setGlobalDeviceList] = useState(() => {
    try {
      const saved = localStorage.getItem('cf-ems-devices')
      return saved ? JSON.parse(saved) : devices
    } catch {
      return devices
    }
  })

  // sync to localStorage
  useEffect(() => {
    localStorage.setItem('cf-ems-devices', JSON.stringify(globalDeviceList))
  }, [globalDeviceList])

  // Get allowed device IDs for this specific user based on access groups
  const allowedDeviceIds = useMemo(() => {
    if (!dbUser) return null
    const orgGroups = groups.filter(g => g.org === orgName)
    if (orgGroups.length === 0) return null // No groups configured, fall back to all org devices
    
    // Find groups that contain this user
    const userGroups = orgGroups.filter(g => g.userIds?.includes(dbUser.id))
    const ids = new Set()
    userGroups.forEach(g => {
      g.deviceIds?.forEach(id => ids.add(id))
    })
    return Array.from(ids)
  }, [groups, dbUser, orgName])

  // Filter deviceList to only allowed devices
  const deviceList = useMemo(() => {
    const orgDevices = globalDeviceList.filter(d => d.org === orgName)
    if (allowedDeviceIds === null) return orgDevices
    return orgDevices.filter(d => allowedDeviceIds.includes(d.id))
  }, [globalDeviceList, orgName, allowedDeviceIds])

  const [deviceSearchQuery, setDeviceSearchQuery] = useState('')
  const location = useLocation()
  const highlightQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('highlight') || ''
  }, [location.search])

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

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800)
    const interval = setInterval(() => setTick(t => t + 1), 5000)
    return () => { clearTimeout(timer); clearInterval(interval) }
  }, [])

  // KPI aggregates (respects access group filtering)
  const kpiValues = useMemo(() => {
    const isOff  = (d) => d.status === 'Offline' || !d.switchOn
    const online = deviceList.filter(d => !isOff(d))
    const sum    = (m) => online.reduce((s, d) => s + getLiveTelemetryNum(d.name, m, false, tick), 0)
    const mean   = (m) => online.length ? sum(m) / online.length : 0
    return {
      totalPower:   sum('power'),
      totalCurrent: sum('current'),
      avgVoltage:   mean('voltage'),
      avgPF:        mean('pf'),
      onlineCount:  online.length,
    }
  }, [deviceList, tick])

  const handleToggleSwitch = (id) => {
    setGlobalDeviceList(prev =>
      prev.map(d => (d.id === id ? { ...d, switchOn: !d.switchOn, status: !d.switchOn ? 'Online' : 'Offline' } : d))
    )
  }

  const onlineCount  = deviceList.filter(d => d.status === 'Online' && d.switchOn).length
  const offlineCount = deviceList.length - onlineCount

  const getGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 12) return 'Good morning'
    if (hr < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-surface-200 p-3 rounded-lg shadow-floating text-xs font-semibold text-surface-800">
          {label && <p className="text-surface-400 mb-1 font-bold">{label}</p>}
          {payload.map((item, i) => (
            <div key={i} className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
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
    { key: 'power',   label: 'Total Power',      value: kpiValues.totalPower,   unit: 'kW', Icon: Zap,        color: '#F5A623', gaugeMax: 88,  agg: 'Sum'  },
    { key: 'current', label: 'Total Current',    value: kpiValues.totalCurrent, unit: 'A',  Icon: Activity,   color: '#3B82F6', gaugeMax: 60,  agg: 'Sum'  },
    { key: 'voltage', label: 'Avg Voltage',      value: kpiValues.avgVoltage,   unit: 'V',  Icon: Gauge,      color: '#22C55E', gaugeMax: 240, agg: 'Mean' },
    { key: 'pf',      label: 'Avg Power Factor', value: kpiValues.avgPF,        unit: '',   Icon: TrendingUp, color: '#8B5CF6', gaugeMax: 1,   agg: 'Mean' },
  ]

  return (
    <Skeleton name="user-dashboard" loading={isLoading} transition={300}>
      <div className="space-y-6">
        {/* Personalized Greeting Banner */}
        <div className="card p-6 bg-gradient-to-r from-surface-900 to-surface-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-none shadow-elevated">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-white">
              {getGreeting()}, Maryam 👋
            </h2>
            <p className="text-xs text-surface-400 flex items-center gap-1.5">
              <Shield size={12} className="text-primary-500" />
              Account Tier: <span className="text-primary-600 font-bold uppercase">{userStats.subscription} Plan</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => alert('Latest PDF Report is being generated.')}
            className="btn-primary self-start sm:self-auto text-xs py-2 px-3 flex items-center gap-1 font-bold"
          >
            View Latest Report
            <ArrowUpRight size={13} />
          </button>
        </div>

        {/* ── KPI Summary Section ── */}
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

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="My Assigned Devices" value={deviceList.length}               icon={Cpu}           color="primary" />
          <StatCard label="Active Alarms"        value={offlineCount > 0 ? 1 : 0}       icon={AlertTriangle} color="warning" />
          <StatCard label="Notifications"        value={userStats.notifications}         icon={Bell}          color="info"    />
          <StatCard label="Subscription"         value={userStats.subscription}          icon={CreditCard}    color="success" />
        </div>

        {/* MASTER TELEMETRY PANEL */}
        <div className="card p-5 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-100 dark:border-surface-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="text-primary-600 animate-pulse" size={18} />
              <div>
                <h3 className="text-base font-extrabold text-surface-900 tracking-tight leading-tight">Master Telemetry Panel</h3>
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
                        { key: 'power',       label: 'Active Power',       unit: 'kW',  cls: 'text-amber-500'   },
                        { key: 'current',     label: 'Current',            unit: 'A',   cls: 'text-info-500'    },
                        { key: 'voltage',     label: 'Voltage',            unit: 'V',   cls: 'text-success-500' },
                        { key: 'pf',          label: 'Power Factor',       unit: '',    cls: 'text-primary-500' },
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

        {/* Live Readings Chart */}
        <div className="card p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-surface-900 leading-none">Live Readings — Main Wapda</h3>
              <p className="text-xs text-surface-400 mt-1">Voltage (V) logged across all three phases</p>
            </div>
            <div className="flex bg-surface-100 p-0.5 rounded-lg border border-surface-200">
              {['Today', 'Week', 'Month'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-surface-900 shadow-sm border border-surface-200/50'
                      : 'text-surface-500 hover:text-surface-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis domain={[210, 240]} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Line type="monotone" dataKey="voltageA" stroke="#F5A623" dot={false} strokeWidth={2} name="Phase A" unit="V" />
              <Line type="monotone" dataKey="voltageB" stroke="#3B82F6" dot={false} strokeWidth={2} name="Phase B" unit="V" />
              <Line type="monotone" dataKey="voltageC" stroke="#EF4444" dot={false} strokeWidth={2} name="Phase C" unit="V" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Notifications Panel */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-surface-200">
            <div>
              <h3 className="text-sm font-bold text-surface-900">Recent Notifications</h3>
              <p className="text-xs text-surface-400 mt-0.5">Critical system updates and threshold alarms</p>
            </div>
            <span className="badge badge-neutral flex items-center gap-1"><Calendar size={11} /> Logged events</span>
          </div>
          <div className="divide-y divide-surface-100 flex-1">
            {notifications.slice(0, 5).map(n => {
              const isCritical = n.severity === 'danger'
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-4 py-4 hover:bg-surface-50 transition-colors duration-100 border-l-4 ${isCritical ? 'border-l-danger-600' : 'border-l-primary-500'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${isCritical ? 'bg-danger-100/40 text-danger-700 border-danger-600/20' : 'bg-primary-100/40 text-primary-700 border-primary-500/20'}`}>
                    {isCritical ? <AlertTriangle size={14} /> : <Bell size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-surface-800 leading-tight">{n.triggerName}</p>
                    <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{n.description}</p>
                  </div>
                  <span className="text-[10px] font-bold text-surface-400 flex-shrink-0 whitespace-nowrap">
                    {n.time.slice(11)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Drill-Down Modal */}
        {drillMetric && (() => {
          const isOff = (d) => d.status === 'Offline' || !d.switchOn
          const cfg = {
            power:   { label: 'Total Power',      unit: 'kW', max: 88,  color: '#F5A623', agg: 'Sum',  val: kpiValues.totalPower,   fn: d => getLiveTelemetryNum(d.name, 'power',   isOff(d), tick) },
            current: { label: 'Total Current',    unit: 'A',  max: 60,  color: '#3B82F6', agg: 'Sum',  val: kpiValues.totalCurrent, fn: d => getLiveTelemetryNum(d.name, 'current', isOff(d), tick) },
            voltage: { label: 'Average Voltage',  unit: 'V',  max: 240, color: '#22C55E', agg: 'Mean', val: kpiValues.avgVoltage,   fn: d => getLiveTelemetryNum(d.name, 'voltage', isOff(d), tick) },
            pf:      { label: 'Avg Power Factor', unit: '',   max: 1,   color: '#8B5CF6', agg: 'Mean', val: kpiValues.avgPF,        fn: d => getLiveTelemetryNum(d.name, 'pf',      isOff(d), tick) },
          }[drillMetric]
          return (
            <DrillDownModal
              open
              onClose={() => setDrillMetric(null)}
              metric={cfg.label}
              unit={cfg.unit}
              aggregate={cfg.val}
              aggregateLabel={cfg.agg}
              devices={deviceList}
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
