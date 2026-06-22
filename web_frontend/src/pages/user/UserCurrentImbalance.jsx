import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageState, { useFetch } from '../../components/ui/PageState'
import { AlertTriangle } from 'lucide-react'
import emsApi from '../../api/emsApi'
import { aiPointsToChart } from '../../utils/mappers'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'

export default function UserCurrentImbalance() {
  const { selectedDeviceId, selectedDevice } = useDevices()
  const [from, setFrom] = useState(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))

  const { data, loading, error, reload } = useFetch(async () => {
    const deviceId = selectedDeviceId
    if (!deviceId) return { chartData: [], events: [], stats: [] }
    const res = await emsApi.getAiCurrent({ deviceId, timeRange: '7d' })
    const chartData = aiPointsToChart(res?.data?.chartData?.currentA ?? [], 'currentA')
    const imbalance = res?.data?.chartData?.currentImbalance ?? []
    const values = imbalance.map((p) => p.value).filter((v) => v != null)
    const maxImb = values.length ? `${Math.max(...values).toFixed(1)}%` : '—'
    const avgImb = values.length ? `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}%` : '—'
    const current = res?.data?.current ?? {}
    const events = values.slice(0, 5).map((v, i) => ({
      id: i,
      time: imbalance[i]?.timestamp ?? '—',
      phaseA: current.CurrentA != null ? `${current.CurrentA}A` : '—',
      phaseB: current.CurrentB != null ? `${current.CurrentB}A` : '—',
      phaseC: current.CurrentC != null ? `${current.CurrentC}A` : '—',
      imbalance: `${v.toFixed(1)}%`,
      severity: v > 3 ? 'Critical' : 'Warning',
    }))
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
  }, [selectedDeviceId, from, to])

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div><h2 className="page-title">Current Imbalance</h2><p className="breadcrumb">User / Current Imbalance</p></div>
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
          <h3 className="text-sm font-semibold text-surface-800 mb-1">Current Phase A — {data?.deviceName}</h3>
          <p className="text-xs text-surface-500 mb-4">Current (A) per time slot</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.chartData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip formatter={(v) => [`${v} A`, 'Current Phase A']} />
              <Bar dataKey="currentA" fill="#F5A623" radius={[3, 3, 0, 0]} name="Current A" />
            </BarChart>
          </ResponsiveContainer>
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
                    <tr><td colSpan={7} className="text-center py-8 text-surface-500 text-sm">No events in this period.</td></tr>
                  ) : (data?.events ?? []).map((e, i) => (
                    <tr key={e.id}>
                      <td className="text-surface-500 font-mono text-xs">{i + 1}</td>
                      <td><span className="font-mono text-xs">{String(e.time).slice(0, 16)}</span></td>
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
    </PageState>
  )
}
