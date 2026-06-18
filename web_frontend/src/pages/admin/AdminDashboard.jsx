import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Building2, Users, Cpu, Wifi, AlertTriangle, Activity, CheckCircle, XCircle, Check } from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import emsApi from '../../api/emsApi'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import { fetchAdminStats, fetchDashboardChart } from '../../utils/dashboardHelpers'
import { mapAnomaly } from '../../utils/mappers'

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
  const { selectedDeviceId } = useDevices()
  const { data: stats, loading, error, reload, setData } = useFetch(() => fetchAdminStats(), [])
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(true)

  useEffect(() => {
    if (!selectedDeviceId) {
      setChartData([])
      setChartLoading(false)
      return
    }
    let cancelled = false
    setChartLoading(true)
    fetchDashboardChart(selectedDeviceId, '24h')
      .then((chart) => { if (!cancelled) setChartData(chart) })
      .catch(() => { if (!cancelled) setChartData([]) })
      .finally(() => { if (!cancelled) setChartLoading(false) })
    return () => { cancelled = true }
  }, [selectedDeviceId])

  const alarms = (stats?.anomalies ?? []).slice(0, 5).map((a) => {
    const m = mapAnomaly(a)
    return {
      id: m.id,
      device: m.device,
      trigger: m.trigger !== '—' ? m.trigger : m.variable,
      time: fmtTime(a.alarmTime),
      severity: a.alarmState === 'ACTIVE' ? 'danger' : 'warning',
      _raw: a,
    }
  })

  const deviceList = (stats?.devices ?? []).slice(0, 5)
  const onlineCount = stats?.onlineDevices ?? 0
  const offlineCount = stats?.offlineDevices ?? 0
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
          d.id === device.id ? { ...d, switchOn: !d.switchOn, switchState: action } : d
        ),
      } : prev)
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

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <Skeleton name="admin-dashboard" loading={loading || chartLoading} transition={300}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Organizations" value={stats?.totalOrgs ?? 0} icon={Building2} color="primary" />
            <StatCard label="Total Users" value={stats?.totalUsers ?? 0} icon={Users} color="info" />
            <StatCard label="Total Devices" value={stats?.totalDevices ?? 0} icon={Cpu} color="neutral" />
            <StatCard label="Total Gateways" value={stats?.totalGateways ?? 0} icon={Wifi} color="neutral" />
            <StatCard label="Online Devices" value={stats?.onlineDevices ?? 0} icon={CheckCircle} color="success" />
            <StatCard label="Offline Devices" value={stats?.offlineDevices ?? 0} icon={XCircle} color="danger" />
            <StatCard label="Active Alarms" value={stats?.activeAlarms ?? 0} icon={AlertTriangle} color="warning" />
            <StatCard label="Total Alarms" value={stats?.totalAlarms ?? 0} icon={Activity} color="neutral" />
          </div>

          <DeviceSlaveSelector />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-surface-900 leading-none">Power Consumption — Today</h3>
                <p className="text-xs text-surface-400 mt-1 mb-4">Total load in kW across all organizations</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
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
                <h3 className="text-sm font-bold text-surface-900 leading-none">Voltage Phases — Today</h3>
                <p className="text-xs text-surface-400 mt-1 mb-4">Mean voltage levels in volts across phases</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData.filter((_, i) => i % 3 === 0)} barSize={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <YAxis domain={[200, 240]} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="voltageA" fill="#F5A623" radius={[2, 2, 0, 0]} name="Phase A" unit="V" />
                  <Bar dataKey="voltageB" fill="#3B82F6" radius={[2, 2, 0, 0]} name="Phase B" unit="V" />
                  <Bar dataKey="voltageC" fill="#EF4444" radius={[2, 2, 0, 0]} name="Phase C" unit="V" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-surface-900 leading-none">Device Availability Ratio</h3>
                <p className="text-xs text-surface-400 mt-1 mb-4">Percentage breakdown of online vs offline terminals</p>
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
                {deviceList.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors duration-100">
                    <span className={`badge ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                      {d.status}
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
                ))}
              </div>
            </div>
          </div>
        </div>
      </Skeleton>
    </PageState>
  )
}
