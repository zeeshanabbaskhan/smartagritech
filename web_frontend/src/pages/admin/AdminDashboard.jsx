import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Building2, Users, Cpu, Wifi, AlertTriangle, Activity, CheckCircle, XCircle, Check } from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import emsApi from '../../api/emsApi'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import DashboardTelemetry from '../../components/dashboard/DashboardTelemetry'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import { fetchAdminStats, fetchDashboardChart, fetchListTotal } from '../../utils/dashboardHelpers'
import { mapAnomaly } from '../../utils/mappers'
import { isOffline, isSwitchOff } from '../../utils/deviceMetrics'

const fmtTime = (d) => {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)} d ago`
}

export default function AdminDashboard() {
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const highlightQuery = useMemo(() => searchParams.get('highlight') || '', [searchParams])
  const { selectedDeviceId, selectedSlaveId, devices: contextDevices } = useDevices()
  const { data: stats, loading, error, reload, setData } = useFetch(() => fetchAdminStats(), [])
  const [chartBundle, setChartBundle] = useState({ power: [], multi: [], lines: [], voltagePhases: null })
  const [chartLoading, setChartLoading] = useState(true)
  const [scope, setScope] = useState({ organizationId: null, organization: null, devices: [] })
  const [scopedCounts, setScopedCounts] = useState({ users: null, gateways: null })

  const handleScopeChange = useCallback((next) => {
    setScope(next)
  }, [])

  // When an org is selected, load scoped user/gateway totals (live API)
  useEffect(() => {
    const orgId = scope.organizationId
    if (!orgId) {
      setScopedCounts({ users: null, gateways: null })
      return
    }
    let cancelled = false
    Promise.all([
      fetchListTotal(emsApi.getUsers, { organizationId: orgId }).catch(() => 0),
      fetchListTotal(emsApi.getGateways, { organizationId: orgId }).catch(() => 0),
    ]).then(([users, gateways]) => {
      if (!cancelled) setScopedCounts({ users, gateways })
    })
    return () => { cancelled = true }
  }, [scope.organizationId])

  // Prefer chart device within the active org scope when filter changes
  // (DeviceSlaveSelector also reconciles via devicesOverride)
  useEffect(() => {
    if (!selectedDeviceId) {
      setChartBundle({ power: [], multi: [], lines: [], voltagePhases: null })
      setChartLoading(false)
      return
    }
    let cancelled = false
    setChartLoading(true)
    fetchDashboardChart(selectedDeviceId, '24h', selectedSlaveId)
      .then((chart) => { if (!cancelled) setChartBundle(chart) })
      .catch(() => { if (!cancelled) setChartBundle({ power: [], multi: [], lines: [], voltagePhases: null }) })
      .finally(() => { if (!cancelled) setChartLoading(false) })
    return () => { cancelled = true }
  }, [selectedDeviceId, selectedSlaveId])

  const selectedOrg = scope.organization
  const scopedDeviceIds = useMemo(
    () => new Set((scope.devices || []).map((d) => d.id)),
    [scope.devices]
  )
  const scopedDeviceNames = useMemo(
    () => new Set((scope.devices || []).map((d) => d.name)),
    [scope.devices]
  )

  const scopedAlarms = useMemo(() => {
    const mapped = (stats?.anomalies ?? []).map((a) => {
      const m = mapAnomaly(a)
      return {
        id: m.id,
        device: m.device,
        deviceId: a.deviceId ?? a.device?.id,
        trigger: m.trigger !== '—' ? m.trigger : m.variable,
        time: fmtTime(a.alarmTime),
        severity: a.alarmState === 'ACTIVE' ? 'danger' : 'warning',
        _raw: a,
      }
    })
    if (!selectedOrg) return mapped
    return mapped.filter((a) =>
      (a.deviceId && scopedDeviceIds.has(a.deviceId))
      || scopedDeviceNames.has(a.device)
    )
  }, [stats?.anomalies, selectedOrg, scopedDeviceIds, scopedDeviceNames])

  const alarms = useMemo(() => scopedAlarms.slice(0, 5), [scopedAlarms])

  const deviceList = useMemo(() => {
    const source = selectedOrg
      ? (scope.devices || [])
      : (stats?.devices ?? [])
    return source.slice(0, 5)
  }, [selectedOrg, scope.devices, stats?.devices])

  const onlineCount = useMemo(() => {
    if (selectedOrg) {
      return (scope.devices || []).filter((d) => !isOffline(d) && !isSwitchOff(d)).length
    }
    return stats?.onlineDevices ?? 0
  }, [selectedOrg, scope.devices, stats?.onlineDevices])

  const offlineCount = useMemo(() => {
    if (selectedOrg) {
      return Math.max(0, (scope.devices || []).length - onlineCount)
    }
    return stats?.offlineDevices ?? 0
  }, [selectedOrg, scope.devices, onlineCount, stats?.offlineDevices])

  const pieData = [
    { name: 'Online', value: onlineCount || 1, color: '#16A34A' },
    { name: 'Offline', value: offlineCount || 0, color: '#DC2626' },
  ]
  const pieTotal = onlineCount + offlineCount || 1

  const handleAcknowledge = async (alarm) => {
    try {
      if (alarm._raw?.processState === 'PENDING') {
        await emsApi.processVariableAlarm(alarm.id)
      } else {
        await emsApi.acknowledgeAnomaly(alarm.id)
      }
      setData((prev) => prev ? {
        ...prev,
        anomalies: prev.anomalies.filter((a) => a.id !== alarm.id),
        activeAlarms: Math.max(0, prev.activeAlarms - 1),
      } : prev)
    } catch (e) {
      showToast(e.message || 'Acknowledge failed', 'error')
    }
  }

  const handleToggleSwitch = async (device) => {
    const action = device.switchOn ? 'OFF' : 'ON'
    try {
      await emsApi.switchDevice(device.id, action)
      setData((prev) => prev ? {
        ...prev,
        devices: prev.devices.map((d) =>
          d.id === device.id
            ? {
                ...d,
                switchOn: action === 'ON',
                switchState: action,
                ...(action === 'OFF' ? { status: 'Offline', statusRaw: 'OFFLINE' } : {}),
              }
            : d
        ),
      } : prev)
      setScope((prev) => ({
        ...prev,
        devices: (prev.devices || []).map((d) =>
          d.id === device.id
            ? {
                ...d,
                switchOn: action === 'ON',
                switchState: action,
                ...(action === 'OFF' ? { status: 'Offline', statusRaw: 'OFFLINE' } : {}),
              }
            : d
        ),
      }))
    } catch (e) {
      showToast(e.message || 'Switch failed', 'error')
    }
  }

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

  const chartDevices = useMemo(() => {
    if (selectedOrg && scope.devices?.length) return scope.devices
    return contextDevices?.length ? contextDevices : (stats?.devices ?? [])
  }, [selectedOrg, scope.devices, contextDevices, stats?.devices])

  const statCards = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Organizations"
        value={selectedOrg ? 1 : (stats?.totalOrgs ?? 0)}
        icon={Building2}
        color="primary"
      />
      <StatCard
        label="Total Users"
        value={selectedOrg ? (scopedCounts.users ?? 0) : (stats?.totalUsers ?? 0)}
        icon={Users}
        color="info"
      />
      <StatCard
        label="Total Devices"
        value={selectedOrg ? (scope.devices?.length ?? 0) : (stats?.totalDevices ?? 0)}
        icon={Cpu}
        color="neutral"
      />
      <StatCard
        label="Total Gateways"
        value={selectedOrg ? (scopedCounts.gateways ?? 0) : (stats?.totalGateways ?? 0)}
        icon={Wifi}
        color="neutral"
      />
      <StatCard label="Online Devices" value={onlineCount} icon={CheckCircle} color="success" />
      <StatCard label="Offline Devices" value={offlineCount} icon={XCircle} color="danger" />
      <StatCard
        label="Active Alarms"
        value={selectedOrg ? scopedAlarms.length : (stats?.activeAlarms ?? 0)}
        icon={AlertTriangle}
        color="warning"
      />
      <StatCard
        label="Total Alarms"
        value={selectedOrg ? scopedAlarms.length : (stats?.totalAlarms ?? 0)}
        icon={Activity}
        color="neutral"
      />
    </div>
  )

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <Skeleton name="admin-dashboard" loading={loading || chartLoading} transition={300}>
        <div className="space-y-6">
          {/* KPI filter + cards → stats → Master Executive Device Control (portal order) */}
          <DashboardTelemetry
            filterMode="org"
            highlightQuery={highlightQuery}
            allDevicesLabel="All Devices"
            powerKpiLabel="Total Power"
            emptyGroupsHint="No organizations found."
            onScopeChange={handleScopeChange}
            between={statCards}
          />

          {/* Chart device/slave picker (live data — portal used dummy series) */}
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-1">
              <div>
                <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Chart Device</h3>
                <p className="text-xs text-surface-400 mt-0.5">
                  Select a device and slave for the power / voltage charts below
                  {selectedOrg ? ` · scoped to ${selectedOrg.name}` : ''}
                </p>
              </div>
            </div>
            <DeviceSlaveSelector
              className="mt-2"
              devicesOverride={chartDevices}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-surface-900 leading-none">Power Consumption — Today</h3>
                <p className="text-xs text-surface-400 mt-1 mb-4">
                  {selectedOrg
                    ? `Load in kW for ${selectedOrg.name}`
                    : 'Total load in kW across all organizations'}
                </p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartBundle.power}>
                  <defs>
                    <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F5A623" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="power" stroke="#F5A623" fill="url(#powerGrad)" strokeWidth={2} name="Power" unit="kW" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-surface-900 leading-none">
                  {chartBundle.voltagePhases?.multi?.length
                    ? 'Voltage Phases — Today'
                    : 'Device Variables — Today'}
                </h3>
                <p className="text-xs text-surface-400 mt-1 mb-4">
                  {chartBundle.voltagePhases?.multi?.length
                    ? 'Mean voltage levels in volts across phases'
                    : chartBundle.lines.length
                      ? chartBundle.lines.map((l) => l.label).join(', ')
                      : 'Select a device with sensor data'}
                </p>
              </div>
              {chartBundle.voltagePhases?.multi?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartBundle.voltagePhases.multi.filter((_, i) => i % 3 === 0)} barSize={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    {chartBundle.voltagePhases.lines.map((line) => (
                      <Bar key={line.key} dataKey={line.key} fill={line.color} radius={[2, 2, 0, 0]} name={line.label} unit="V" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : chartBundle.multi.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartBundle.multi.filter((_, i) => i % 3 === 0)} barSize={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    {chartBundle.lines.map((line) => (
                      <Bar key={line.key} dataKey={line.key} fill={line.color} radius={[2, 2, 0, 0]} name={line.label} unit={line.unit} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-xs text-surface-500">No variable history for selected device.</div>
              )}
            </div>

            <div className="card p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-surface-900 leading-none">Device Availability Ratio</h3>
                <p className="text-xs text-surface-400 mt-1 mb-4">
                  {selectedOrg
                    ? `Online vs offline terminals in ${selectedOrg.name}`
                    : 'Percentage breakdown of online vs offline terminals'}
                </p>
              </div>
              <div className="flex items-center justify-center h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-surface-900 leading-none">
                    {Math.round((onlineCount / pieTotal) * 100)}%
                  </span>
                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mt-1">Online</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-surface-200">
                <div>
                  <h3 className="text-sm font-bold text-surface-900">Recent Alarms</h3>
                  <p className="text-xs text-surface-400 mt-0.5">Acknowledging alerts silences notifications</p>
                </div>
                <a href="/admin/variable-alarms" className="text-xs text-primary-600 hover:text-primary-700 font-bold transition-colors">
                  View all &rarr;
                </a>
              </div>
              <div className="divide-y divide-surface-100 flex-1">
                {alarms.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-8 text-center text-surface-400 text-xs">
                    No active alarms remaining.
                  </div>
                ) : (
                  alarms.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 px-4 py-3.5 group transition-colors duration-150 ${
                        a.severity === 'danger' ? 'bg-danger-100/10 hover:bg-danger-100/20' : 'hover:bg-surface-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.severity === 'danger' ? 'bg-danger-600' : 'bg-primary-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-surface-800 leading-tight">{a.trigger}</p>
                        <p className="text-xs text-surface-400 mt-0.5 truncate">{a.device}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] font-semibold text-surface-400">{a.time}</span>
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(a)}
                          className="btn-ghost p-1 text-[10px] py-0.5 font-bold text-primary-600 hover:bg-primary-500/10 border border-primary-500/10 rounded-md opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 flex items-center gap-0.5"
                        >
                          <Check size={10} />
                          Ack
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-surface-200">
                <div>
                  <h3 className="text-sm font-bold text-surface-900">Device Status</h3>
                  <p className="text-xs text-surface-400 mt-0.5">Toggle switch state for connected devices</p>
                </div>
                <a href="/admin/devices" className="text-xs text-primary-600 hover:text-primary-700 font-bold transition-colors">
                  View all &rarr;
                </a>
              </div>
              <div className="divide-y divide-surface-100 flex-1">
                {deviceList.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-8 text-center text-surface-400 text-xs">
                    No devices in this scope.
                  </div>
                ) : (
                  deviceList.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors duration-100">
                      <span className={`badge ${d.status === 'Online' && d.switchOn ? 'badge-success' : 'badge-neutral'}`}>
                        {d.status === 'Online' && d.switchOn ? 'Online' : 'Offline'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-surface-800 truncate leading-tight">{d.name}</p>
                        <p className="text-xs text-surface-400 mt-0.5 truncate">{d.org}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSwitch(d)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500/35 ${
                            d.switchOn ? 'bg-primary-500' : 'bg-surface-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              d.switchOn ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Skeleton>
    </PageState>
  )
}
