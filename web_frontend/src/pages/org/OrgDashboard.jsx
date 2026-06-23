import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import PageState, { useFetch } from '../../components/ui/PageState'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import { Cpu, AlertTriangle, Zap, CheckCircle, Smartphone } from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import { useAuth } from '../../context/AuthContext'
import { fetchOrgStats, fetchDashboardChart } from '../../utils/dashboardHelpers'
import emsApi from '../../api/emsApi'

export default function OrgDashboard() {
  const { user } = useAuth()
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [chartBundle, setChartBundle] = useState({ power: [], multi: [], lines: [] })

  const { data: stats, loading, error, reload } = useFetch(async () => {
    const orgStats = await fetchOrgStats()
    let monthlyEnergy = '—'
    const deviceId = selectedDeviceId
    if (deviceId) {
      try {
        const summary = await emsApi.getDashboardSummary({ deviceId, timeRange: '30d' })
        const val = summary?.data?.energySavingsComparison?.monthly?.current
          ?? summary?.data?.totalPowerConsumption?.value
        if (val != null) monthlyEnergy = `${Number(val).toLocaleString()} kWh`
      } catch (_) {}
    }
    const activeAlarms = orgStats.anomalies.filter(
      (a) => a.alarmState === 'ACTIVE' || a.processState === 'UNPROCESSED'
    ).length
    return { ...orgStats, activeAlarms, monthlyEnergy }
  }, [selectedDeviceId])

  useEffect(() => {
    if (!selectedDeviceId) { setChartBundle({ power: [], multi: [], lines: [] }); return }
    fetchDashboardChart(selectedDeviceId, '24h', selectedSlaveId).then(setChartBundle)
  }, [selectedDeviceId, selectedSlaveId])

  const orgName = user?.organization?.name ?? 'your organization'
  const devices = stats?.devices ?? []

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
      <Skeleton name="org-dashboard" loading={loading} transition={300}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="My Devices" value={stats?.totalDevices ?? 0} icon={Cpu} color="primary" />
            <StatCard label="Online Devices" value={stats?.onlineDevices ?? 0} icon={CheckCircle} color="success" />
            <StatCard label="Active Alarms" value={stats?.activeAlarms ?? 0} icon={AlertTriangle} color="warning" />
            <StatCard label="Monthly Energy" value={stats?.monthlyEnergy ?? '—'} icon={Zap} color="info" />
          </div>

          <DeviceSlaveSelector onChange={reload} />

          <div className="card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-surface-900 leading-none">Power Consumption — Last 24 Hours</h3>
              <p className="text-xs text-surface-400 mt-1 mb-4">Real-time load in kW logged at {orgName}</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartBundle.power}>
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

          <div className="card flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-surface-200">
              <div>
                <h3 className="text-sm font-bold text-surface-900">My Devices</h3>
                <p className="text-xs text-surface-400 mt-0.5">Active equipment assigned to {orgName}</p>
              </div>
              <span className="badge badge-neutral flex items-center gap-1"><Smartphone size={11} /> {devices.length} Total</span>
            </div>
            <div className="divide-y divide-surface-100 flex-1">
              {devices.length === 0 ? (
                <div className="p-8 text-center text-surface-500 text-xs">No devices found.</div>
              ) : (
                devices.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors duration-100">
                    <span className={`badge ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>{d.status}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-surface-800 leading-tight">{d.name}</p>
                      <p className="text-xs text-surface-400 mt-0.5 truncate">{d.template}</p>
                    </div>
                    <span className="text-xs text-surface-500 font-semibold flex-shrink-0">{d.gateway}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Skeleton>
    </PageState>
  )
}
