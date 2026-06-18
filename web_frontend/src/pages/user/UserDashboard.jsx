import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Cpu, Bell, AlertTriangle, CreditCard, Shield, Calendar, ArrowUpRight } from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import { useAuth } from '../../context/AuthContext'
import { fetchUserStats, fetchDashboardChart } from '../../utils/dashboardHelpers'
import { mapNotificationRow } from '../../utils/mappers'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'

export default function UserDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { selectedDeviceId } = useDevices()
  const [activeTab, setActiveTab] = useState('Today')
  const [chartData, setChartData] = useState([])

  const { data: stats, loading, error, reload } = useFetch(
    () => fetchUserStats(user),
    [user?.id, user?.email]
  )

  const timeRangeMap = { Today: '24h', Week: '7d', Month: '30d' }

  useEffect(() => {
    if (!selectedDeviceId) return
    fetchDashboardChart(selectedDeviceId, timeRangeMap[activeTab] ?? '24h').then(setChartData)
  }, [stats, activeTab, selectedDeviceId])

  const getGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 12) return 'Good morning'
    if (hr < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const notifications = (stats?.notificationList ?? []).slice(0, 5).map(mapNotificationRow)

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

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <Skeleton name="user-dashboard" loading={loading} transition={300}>
        <div className="space-y-6">
          <div className="card p-6 bg-gradient-to-r from-surface-900 to-surface-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-none shadow-elevated">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-white">
                {getGreeting()}, {user?.name ?? 'User'} 👋
              </h2>
              <p className="text-xs text-surface-400 flex items-center gap-1.5">
                <Shield size={12} className="text-primary-500" />
                Account Tier: <span className="text-primary-600 font-bold uppercase">{stats?.subscription ?? '—'} Plan</span>
              </p>
            </div>
            <button type="button" onClick={() => navigate('/user/sensor-history')} className="btn-primary self-start sm:self-auto text-xs py-2 px-3 flex items-center gap-1 font-bold">
              Sensor History <ArrowUpRight size={13} />
            </button>
          </div>

          <DeviceSlaveSelector className="mb-2" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="My Assigned Devices" value={stats?.assignedDevices ?? 0} icon={Cpu} color="primary" />
            <StatCard label="Active Alarms" value={stats?.activeAlarms ?? 0} icon={AlertTriangle} color="warning" />
            <StatCard label="Notifications" value={stats?.notifications ?? 0} icon={Bell} color="info" />
            <StatCard label="Subscription" value={stats?.subscription ?? '—'} icon={CreditCard} color="success" />
          </div>

          <div className="card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-surface-900 leading-none">Live Readings</h3>
                <p className="text-xs text-surface-400 mt-1">Voltage (V) logged across all three phases</p>
              </div>
              <div className="flex bg-surface-100 p-0.5 rounded-lg border border-surface-200">
                {['Today', 'Week', 'Month'].map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${activeTab === tab ? 'bg-white text-surface-900 shadow-sm border border-surface-200/50' : 'text-surface-500 hover:text-surface-800'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Line type="monotone" dataKey="voltageA" stroke="#F5A623" dot={false} strokeWidth={2} name="Phase A" unit="V" />
                <Line type="monotone" dataKey="voltageB" stroke="#3B82F6" dot={false} strokeWidth={2} name="Phase B" unit="V" />
                <Line type="monotone" dataKey="voltageC" stroke="#EF4444" dot={false} strokeWidth={2} name="Phase C" unit="V" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-surface-200">
              <div>
                <h3 className="text-sm font-bold text-surface-900">Recent Notifications</h3>
                <p className="text-xs text-surface-400 mt-0.5">Critical system updates and threshold alarms</p>
              </div>
              <span className="badge badge-neutral flex items-center gap-1"><Calendar size={11} /> Logged events</span>
            </div>
            <div className="divide-y divide-surface-100 flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-surface-500 text-xs">No notifications yet.</div>
              ) : notifications.map((n) => {
                const isCritical = n.severity === 'danger' || !n.read
                return (
                  <div key={n.id} className={`flex items-start gap-4 px-4 py-4 hover:bg-surface-50 transition-colors duration-100 border-l-4 ${isCritical ? 'border-l-danger-600' : 'border-l-primary-500'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${isCritical ? 'bg-danger-100/40 text-danger-700 border-danger-600/20' : 'bg-primary-100/40 text-primary-700 border-primary-500/20'}`}>
                      {isCritical ? <AlertTriangle size={14} /> : <Bell size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-surface-800 leading-tight">{n.triggerName}</p>
                      <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{n.description}</p>
                    </div>
                    <span className="text-[10px] font-bold text-surface-400 flex-shrink-0 whitespace-nowrap">{n.time?.slice(11) ?? n.time}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Skeleton>
    </PageState>
  )
}
