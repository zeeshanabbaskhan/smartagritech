import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import PageState, { useFetch } from '../../components/ui/PageState'
import { AlertTriangle } from 'lucide-react'
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
} from '../../utils/analyticsHelpers'

function EmptyChart({ children }) {
  return (
    <div className="p-8 text-center text-xs text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-900/40 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
      {children}
    </div>
  )
}

export default function UserVoltageImbalance() {
  const { selectedDeviceId, selectedSlaveId, selectedDevice } = useDevices()
  const [from, setFrom] = useState(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data, loading, error, reload } = useFetch(async () => {
    const deviceId = selectedDeviceId
    if (!deviceId) return { chartData: [], events: [], stats: [] }
    const timeRange = timeRangeFromDates(from, to)
    const res = await emsApi.getAiVoltage({ deviceId, slaveId: selectedSlaveId || undefined, timeRange })
    const chartData = mergeVoltageChart(res?.data?.chartData ?? {})
    const imbalance = res?.data?.chartData?.voltageImbalance ?? []
    const values = imbalance.map((p) => p.value).filter((v) => v != null)
    const maxImb = values.length ? `${Math.max(...values).toFixed(1)}%` : '—'
    const avgImb = values.length ? `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}%` : '—'
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
      imbalance,
      chartRows: chartData,
      chartKeys: ['voltageA', 'voltageB', 'voltageC'],
      unit: 'V',
    })
    const events = alarmEvents.length ? alarmEvents : seriesEvents
    return {
      chartData,
      events,
      stats: [
        { label: 'Max Imbalance', value: maxImb, color: 'text-primary-600' },
        { label: 'Avg Imbalance', value: avgImb, color: 'text-info-600' },
        { label: 'Events Detected', value: String(events.length), color: 'text-danger-600' },
      ],
      deviceName: selectedDevice?.name ?? 'Device',
    }
  }, [selectedDeviceId, selectedSlaveId, from, to])

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Voltage Imbalance</h2>
            <p className="breadcrumb">User / Voltage Imbalance</p>
          </div>
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
          <h3 className="text-sm font-semibold text-surface-800 mb-1">Phase Voltage Trend — {data?.deviceName}</h3>
          <p className="text-xs text-surface-500 mb-4">Three-phase voltage comparison (V)</p>
          {(data?.chartData ?? []).length === 0 ? (
            <EmptyChart>No logged readings in this period.</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="voltageA" stroke="#F5A623" dot={false} strokeWidth={2} name="Phase A" />
                <Line type="monotone" dataKey="voltageB" stroke="#3B82F6" dot={false} strokeWidth={2} name="Phase B" />
                <Line type="monotone" dataKey="voltageC" stroke="#EF4444" dot={false} strokeWidth={2} name="Phase C" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(data?.stats ?? []).map(({ label, value, color }) => (
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
                  {(data?.events ?? []).length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-surface-500 text-sm">No imbalance events in this period.</td></tr>
                  ) : (data?.events ?? []).map((e, i) => (
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
    </PageState>
  )
}
