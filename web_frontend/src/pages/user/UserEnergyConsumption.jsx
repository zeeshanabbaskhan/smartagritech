import { useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Zap, TrendingUp, Moon, Sun, Receipt } from 'lucide-react'
import emsApi from '../../api/emsApi'
import { aiPointsToChart } from '../../utils/mappers'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'

const periods = ['Today', 'This Week', 'This Month', 'Custom']
const RANGE_MAP = { Today: '24h', 'This Week': '7d', 'This Month': '30d', Custom: '30d' }

const colorClass = {
  primary: 'text-primary-600 bg-primary-600/10',
  warning: 'text-primary-600 bg-warning-600/10',
  info: 'text-info-600 bg-info-600/10',
  success: 'text-success-600 bg-success-600/10',
  danger: 'text-danger-600 bg-danger-600/10',
}

export default function UserEnergyConsumption() {
  const { selectedDeviceId, selectedDevice } = useDevices()
  const [period, setPeriod] = useState('This Month')

  const { data, loading, error, reload } = useFetch(async () => {
    const deviceId = selectedDeviceId
    if (!deviceId) return { chartData: [], dailyData: [], statCards: [], deviceName: '—' }
    const timeRange = RANGE_MAP[period] ?? '30d'
    const res = await emsApi.getAiEnergy({ deviceId, timeRange })
    const chartData = aiPointsToChart(res?.data?.chartData ?? [], 'power').map((p) => ({ ...p, power: p.power ?? p.value }))
    const total = res?.data?.totalConsumption ?? 0
    const peak = chartData.reduce((max, p) => Math.max(max, p.power ?? 0), 0)
    const deviceName = selectedDevice?.name ?? 'Device'
    const dailyData = chartData.filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 7)) === 0).map((p, i) => ({
      day: p.time || `Pt ${i + 1}`,
      kWh: Math.round((p.power ?? 0) / 10),
    }))
    const statCards = [
      { label: 'Total kWh', value: Number(total).toLocaleString(), unit: 'kWh', icon: Zap, color: 'primary' },
      { label: 'Peak kW', value: peak.toFixed(1), unit: 'kW', icon: TrendingUp, color: 'warning' },
      { label: 'Off-Peak kWh', value: Math.round(total * 0.5).toLocaleString(), unit: 'kWh', icon: Moon, color: 'info' },
      { label: 'On-Peak kWh', value: Math.round(total * 0.5).toLocaleString(), unit: 'kWh', icon: Sun, color: 'success' },
      { label: 'Cost', value: `PKR ${Math.round(total * 28).toLocaleString()}`, unit: '', icon: Receipt, color: 'danger' },
    ]
    return { chartData, dailyData, statCards, deviceName }
  }, [period, selectedDeviceId])

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div><h2 className="page-title">Energy Consumption</h2><p className="breadcrumb">User / Energy Consumption</p></div>
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
            <button type="button" className="btn-primary" onClick={reload}>Load</button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-800 mb-1">Power Consumption — {data?.deviceName}</h3>
          <p className="text-xs text-surface-500 mb-4">{period} · Active Power (kW)</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data?.chartData ?? []}>
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
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {(data?.statCards ?? []).map(({ label, value, unit, icon: Icon, color }) => (
            <div key={label} className="card p-4">
              <div className={`w-8 h-8 rounded-lg ${colorClass[color]} flex items-center justify-center mb-3`}>
                <Icon size={15} className={colorClass[color].split(' ')[0]} />
              </div>
              <p className="text-lg font-bold text-surface-900">{value}</p>
              {unit && <p className="text-xs text-surface-500">{unit}</p>}
              <p className="text-xs text-surface-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-800 mb-1">Daily Consumption</h3>
          <p className="text-xs text-surface-500 mb-4">Energy consumed per bucket (kWh)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.dailyData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip formatter={(v) => [`${v} kWh`, 'Consumption']} />
              <Bar dataKey="kWh" fill="#F5A623" radius={[4, 4, 0, 0]} name="kWh" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PageState>
  )
}
