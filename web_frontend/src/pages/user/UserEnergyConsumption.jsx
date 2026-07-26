import { useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Zap, TrendingUp, Moon, Sun, Receipt, Activity, Loader2 } from 'lucide-react'
import emsApi from '../../api/emsApi'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import { PERIOD_TO_RANGE, energyFromAiResponse, timeRangeFromDates } from '../../utils/analyticsHelpers'
import { useFetch, ChartEmpty } from '../../components/ui/PageState'

const periods = ['Today', 'This Week', 'This Month', 'Custom']
const ICONS = { zap: Zap, trend: TrendingUp, moon: Moon, sun: Sun, receipt: Receipt, activity: Activity }
const colorClass = {
  primary: 'text-primary-600 bg-primary-600/10',
  warning: 'text-primary-600 bg-warning-600/10',
  info: 'text-info-600 bg-info-600/10',
  success: 'text-success-600 bg-success-600/10',
  danger: 'text-danger-600 bg-danger-600/10',
}

export default function UserEnergyConsumption() {
  const { selectedDeviceId, selectedSlaveId, selectedDevice } = useDevices()
  const [period, setPeriod] = useState('This Month')
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data, loading, reload } = useFetch(async () => {
    const deviceName = selectedDevice?.name ?? 'Device'
    const deviceId = selectedDeviceId
    if (!deviceId) return energyFromAiResponse({}, { deviceName })
    try {
      const timeRange = period === 'Custom' ? timeRangeFromDates(from, to) : (PERIOD_TO_RANGE[period] ?? '30d')
      const res = await emsApi.getAiEnergy({ deviceId, slaveId: selectedSlaveId || undefined, timeRange })
      return energyFromAiResponse(res?.data ?? {}, { deviceName })
    } catch {
      return energyFromAiResponse({}, { deviceName })
    }
  }, [period, from, to, selectedDeviceId, selectedSlaveId])

  const chartData = data?.chartData ?? []
  const dailyData = data?.dailyData ?? []
  const statCards = data?.statCards ?? energyFromAiResponse({}).statCards

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Energy Consumption</h2>
          <p className="breadcrumb">User / Energy Consumption</p>
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-surface-400" />}
      </div>

      <DeviceSlaveSelector onChange={reload} />

      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Period</label>
            <select className="select w-36" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          {period === 'Custom' && (
            <>
              <div><label className="label">From</label><input type="date" className="input w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><label className="label">To</label><input type="date" className="input w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>
          )}
          <button type="button" className="btn-primary" onClick={reload}>Load</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-800 mb-1">Power Consumption — {data?.deviceName ?? 'Device'}</h3>
        <p className="text-xs text-surface-500 mb-4">{period} · Active Power (kW)</p>
        {chartData.length === 0 ? <ChartEmpty height={260} /> : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5A623" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} kW`, 'Active Power']} />
              <Area type="monotone" dataKey="power" stroke="#F5A623" fill="url(#powerGrad)" strokeWidth={2} name="Power" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(({ label, value, unit, iconKey, color }) => {
          const Icon = ICONS[iconKey] || Zap
          return (
            <div key={label} className="card p-4">
              <div className={`w-8 h-8 rounded-lg ${colorClass[color]} flex items-center justify-center mb-3`}>
                <Icon size={15} className={colorClass[color].split(' ')[0]} />
              </div>
              <p className="text-lg font-bold text-surface-900">{value}</p>
              {unit && <p className="text-xs text-surface-500">{unit}</p>}
              <p className="text-xs text-surface-400 mt-1">{label}</p>
            </div>
          )
        })}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-800 mb-1">Daily Consumption</h3>
        <p className="text-xs text-surface-500 mb-4">Energy consumed per interval (kWh)</p>
        {dailyData.length === 0 ? <ChartEmpty height={200} /> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip formatter={(v) => [`${v} kWh`, 'Consumption']} />
              <Bar dataKey="kWh" fill="#F5A623" radius={[4, 4, 0, 0]} name="kWh" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
