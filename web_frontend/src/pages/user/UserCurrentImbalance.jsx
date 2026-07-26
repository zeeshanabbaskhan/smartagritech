import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AlertTriangle, Loader2 } from 'lucide-react'
import emsApi from '../../api/emsApi'
import { mergeCurrentChart } from '../../utils/mappers'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import {
  timeRangeFromDates,
  imbalanceEventsFromSeries,
  cfFallbackChart,
  cfFallbackEvents,
  preferLive,
} from '../../utils/analyticsHelpers'
import { useFetch } from '../../components/ui/PageState'

export default function UserCurrentImbalance() {
  const { selectedDeviceId, selectedSlaveId, selectedDevice } = useDevices()
  const [from, setFrom] = useState(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data, loading, reload } = useFetch(async () => {
    const fallbackChart = cfFallbackChart('current')
    const fallbackEvents = cfFallbackEvents('current')
    const deviceId = selectedDeviceId
    if (!deviceId) {
      return {
        chartData: fallbackChart, events: fallbackEvents, isDemo: true,
        stats: [
          { label: 'Max Imbalance', value: '2.9%', color: 'text-primary-600' },
          { label: 'Avg Imbalance', value: '1.1%', color: 'text-info-600' },
          { label: 'Events Detected', value: '3', color: 'text-danger-600' },
        ],
        deviceName: 'Main Wapda',
      }
    }
    try {
      const timeRange = timeRangeFromDates(from, to)
      const res = await emsApi.getAiCurrent({ deviceId, slaveId: selectedSlaveId || undefined, timeRange })
      const liveChart = mergeCurrentChart(res?.data?.chartData ?? {})
      const chartData = preferLive(liveChart, fallbackChart)
      const imbalance = res?.data?.chartData?.currentImbalance ?? []
      const values = imbalance.map((p) => p.value).filter((v) => v != null)
      const liveEvents = imbalanceEventsFromSeries({
        imbalance, chartRows: liveChart, chartKeys: ['currentA', 'currentB', 'currentC'], unit: 'A',
      })
      const events = preferLive(liveEvents, fallbackEvents)
      return {
        chartData,
        events,
        isDemo: !liveChart.length,
        stats: [
          { label: 'Max Imbalance', value: values.length ? `${Math.max(...values).toFixed(1)}%` : '2.9%', color: 'text-primary-600' },
          { label: 'Avg Imbalance', value: values.length ? `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}%` : '1.1%', color: 'text-info-600' },
          { label: 'Events Detected', value: String(events.length), color: 'text-danger-600' },
        ],
        deviceName: selectedDevice?.name ?? 'Device',
      }
    } catch {
      return {
        chartData: fallbackChart, events: fallbackEvents, isDemo: true,
        stats: [
          { label: 'Max Imbalance', value: '2.9%', color: 'text-primary-600' },
          { label: 'Avg Imbalance', value: '1.1%', color: 'text-info-600' },
          { label: 'Events Detected', value: '3', color: 'text-danger-600' },
        ],
        deviceName: selectedDevice?.name ?? 'Device',
      }
    }
  }, [selectedDeviceId, selectedSlaveId, from, to])

  const chartData = data?.chartData ?? cfFallbackChart('current')
  const events = data?.events ?? cfFallbackEvents('current')
  const stats = data?.stats?.length ? data.stats : [
    { label: 'Max Imbalance', value: '2.9%', color: 'text-primary-600' },
    { label: 'Avg Imbalance', value: '1.1%', color: 'text-info-600' },
    { label: 'Events Detected', value: '3', color: 'text-danger-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="page-title">Current Imbalance</h2>
            {data?.isDemo && <span className="badge badge-neutral">Sample preview</span>}
          </div>
          <p className="breadcrumb">User / Current Imbalance</p>
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-surface-400" />}
      </div>

      <DeviceSlaveSelector onChange={reload} />

      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="label">From Date</label><input type="date" className="input w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To Date</label><input type="date" className="input w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <button type="button" className="btn-primary" onClick={reload}>Load</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-800 mb-1">Phase Current Trend — {data?.deviceName ?? 'Device'}</h3>
        <p className="text-xs text-surface-500 mb-4">Three-phase current comparison (A)</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
            <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="currentA" fill="#F5A623" name="Phase A" radius={[2, 2, 0, 0]} />
            <Bar dataKey="currentB" fill="#3B82F6" name="Phase B" radius={[2, 2, 0, 0]} />
            <Bar dataKey="currentC" fill="#EF4444" name="Phase C" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-surface-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-primary-600" /> Detected Imbalance Events</h3>
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>#</th><th>Timestamp</th><th>Phase A</th><th>Phase B</th><th>Phase C</th><th>Imbalance</th><th>Severity</th></tr></thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.id ?? i}>
                    <td className="text-surface-500 font-mono text-xs">{i + 1}</td>
                    <td><span className="font-mono text-xs">{e.time}</span></td>
                    <td>{e.phaseA}</td><td>{e.phaseB}</td><td>{e.phaseC}</td>
                    <td className="font-semibold text-primary-600">{e.imbalance}</td>
                    <td><span className={`badge ${e.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}`}>{e.severity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
