import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { AlertTriangle, Loader2 } from 'lucide-react'
import emsApi from '../../api/emsApi'
import { mergeVoltageChart } from '../../utils/mappers'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import {
  timeRangeFromDates,
  formatTs,
  alarmStatus,
  alarmSeverity,
  imbalanceEventsFromSeries,
  cfFallbackChart,
  cfFallbackEvents,
  preferLive,
} from '../../utils/analyticsHelpers'
import { useFetch } from '../../components/ui/PageState'

export default function UserVoltageImbalance() {
  const { selectedDeviceId, selectedSlaveId, selectedDevice } = useDevices()
  const [from, setFrom] = useState(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data, loading, reload } = useFetch(async () => {
    const fallbackChart = cfFallbackChart('voltage')
    const fallbackEvents = cfFallbackEvents('voltage')
    const deviceId = selectedDeviceId
    if (!deviceId) {
      return {
        chartData: fallbackChart,
        events: fallbackEvents,
        isDemo: true,
        stats: [
          { label: 'Max Imbalance', value: '2.1%', color: 'text-primary-600' },
          { label: 'Avg Imbalance', value: '0.8%', color: 'text-info-600' },
          { label: 'Events Detected', value: '3', color: 'text-danger-600' },
        ],
        deviceName: 'Main Wapda',
      }
    }
    try {
      const timeRange = timeRangeFromDates(from, to)
      const res = await emsApi.getAiVoltage({ deviceId, slaveId: selectedSlaveId || undefined, timeRange })
      const liveChart = mergeVoltageChart(res?.data?.chartData ?? {})
      const chartData = preferLive(liveChart, fallbackChart)
      const imbalance = res?.data?.chartData?.voltageImbalance ?? []
      const values = imbalance.map((p) => p.value).filter((v) => v != null)
      const alarmEvents = (res?.data?.alarms ?? []).map((a, i) => ({
        id: a.id ?? i,
        time: formatTs(a.alarmTime),
        phaseA: res?.data?.current?.VoltageA != null ? `${Number(res.data.current.VoltageA).toFixed(1)}V` : '—',
        phaseB: res?.data?.current?.VoltageB != null ? `${Number(res.data.current.VoltageB).toFixed(1)}V` : '—',
        phaseC: res?.data?.current?.VoltageC != null ? `${Number(res.data.current.VoltageC).toFixed(1)}V` : '—',
        imbalance: a.triggeringCondition ?? a.variableName ?? '—',
        severity: alarmSeverity(a),
        status: alarmStatus(a),
      }))
      const seriesEvents = imbalanceEventsFromSeries({
        imbalance, chartRows: liveChart, chartKeys: ['voltageA', 'voltageB', 'voltageC'], unit: 'V',
      })
      const events = preferLive(alarmEvents.length ? alarmEvents : seriesEvents, fallbackEvents)
      const maxImb = values.length ? `${Math.max(...values).toFixed(1)}%` : '2.1%'
      const avgImb = values.length ? `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}%` : '0.8%'
      return {
        chartData,
        events,
        isDemo: !liveChart.length,
        stats: [
          { label: 'Max Imbalance', value: maxImb, color: 'text-primary-600' },
          { label: 'Avg Imbalance', value: avgImb, color: 'text-info-600' },
          { label: 'Events Detected', value: String(events.length), color: 'text-danger-600' },
        ],
        deviceName: selectedDevice?.name ?? 'Device',
      }
    } catch {
      return {
        chartData: fallbackChart, events: fallbackEvents, isDemo: true,
        stats: [
          { label: 'Max Imbalance', value: '2.1%', color: 'text-primary-600' },
          { label: 'Avg Imbalance', value: '0.8%', color: 'text-info-600' },
          { label: 'Events Detected', value: '3', color: 'text-danger-600' },
        ],
        deviceName: selectedDevice?.name ?? 'Device',
      }
    }
  }, [selectedDeviceId, selectedSlaveId, from, to])

  const chartData = data?.chartData ?? cfFallbackChart('voltage')
  const events = data?.events ?? cfFallbackEvents('voltage')
  const stats = data?.stats?.length ? data.stats : [
    { label: 'Max Imbalance', value: '2.1%', color: 'text-primary-600' },
    { label: 'Avg Imbalance', value: '0.8%', color: 'text-info-600' },
    { label: 'Events Detected', value: '3', color: 'text-danger-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="page-title">Voltage Imbalance</h2>
            {data?.isDemo && <span className="badge badge-neutral">Sample preview</span>}
          </div>
          <p className="breadcrumb">User / Voltage Imbalance</p>
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
        <h3 className="text-sm font-semibold text-surface-800 mb-1">Phase Voltage Trend — {data?.deviceName ?? 'Device'}</h3>
        <p className="text-xs text-surface-500 mb-4">Three-phase voltage comparison (V)</p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
            <YAxis domain={[210, 240]} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
            <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="voltageA" stroke="#F5A623" dot={false} strokeWidth={2} name="Phase A" />
            <Line type="monotone" dataKey="voltageB" stroke="#3B82F6" dot={false} strokeWidth={2} name="Phase B" />
            <Line type="monotone" dataKey="voltageC" stroke="#EF4444" dot={false} strokeWidth={2} name="Phase C" />
          </LineChart>
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
                    <td><span className={`badge ${e.severity === 'Critical' || e.severity === 'High' ? 'badge-danger' : 'badge-warning'}`}>{e.severity}</span></td>
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
