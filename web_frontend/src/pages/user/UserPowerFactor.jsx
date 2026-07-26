import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2 } from 'lucide-react'
import emsApi from '../../api/emsApi'
import { aiPointsToChart } from '../../utils/mappers'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import { PERIOD_TO_RANGE, RANGE_LABELS, formatTs, alarmStatus } from '../../utils/analyticsHelpers'
import { useFetch, ChartEmpty } from '../../components/ui/PageState'

const emptyStats = () => [
  { label: 'Avg Power Factor', value: '—', color: 'text-success-600' },
  { label: 'Min PF', value: '—', color: 'text-primary-600' },
  { label: 'Readings Below 0.85', value: '—', color: 'text-danger-600' },
]

function GaugeArc({ value }) {
  const num = Number(value) || 0
  const pct = Math.max(0, Math.min(1, (num - 0.7) / 0.3))
  const angle = pct * 180 - 90
  const cx = 100; const cy = 90; const r = 70
  const toXY = (angleDeg) => ({
    x: cx + r * Math.cos((angleDeg * Math.PI) / 180),
    y: cy + r * Math.sin((angleDeg * Math.PI) / 180),
  })
  const endGood = toXY(angle)
  const largeArc = angle > -90 ? 1 : 0
  const needleX = cx + (r - 5) * Math.cos((angle * Math.PI) / 180)
  const needleY = cy + (r - 5) * Math.sin((angle * Math.PI) / 180)
  const arcColor = num >= 0.9 ? '#16a34a' : num >= 0.85 ? '#ca8a04' : '#dc2626'

  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-xs mx-auto">
      <path d="M 30 90 A 70 70 0 0 1 170 90" fill="none" stroke="#ECEEE6" strokeWidth="14" strokeLinecap="round" />
      <path d={`M 30 90 A 70 70 0 ${largeArc} 1 ${endGood.x.toFixed(2)} ${endGood.y.toFixed(2)}`} fill="none" stroke={arcColor} strokeWidth="14" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={needleX.toFixed(2)} y2={needleY.toFixed(2)} stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill="#1F2937" />
      <text x="28" y="106" fontSize="9" fill="#64748b" textAnchor="middle">0.70</text>
      <text x="172" y="106" fontSize="9" fill="#64748b" textAnchor="middle">1.00</text>
      <text x={cx} y="80" fontSize="20" fill="#1F2937" textAnchor="middle" fontWeight="700">{num.toFixed(2)}</text>
      <text x={cx} y="94" fontSize="8" fill="#64748b" textAnchor="middle">POWER FACTOR</text>
    </svg>
  )
}

export default function UserPowerFactor() {
  const { selectedDeviceId, selectedSlaveId, selectedDevice } = useDevices()
  const [period, setPeriod] = useState('Today')

  const { data, loading, reload } = useFetch(async () => {
    const deviceName = selectedDevice?.name ?? 'Device'
    const deviceId = selectedDeviceId
    if (!deviceId) {
      return { currentPf: null, pfTrend: [], pfEvents: [], deviceName, periodLabel: period, stats: emptyStats() }
    }
    try {
      const timeRange = PERIOD_TO_RANGE[period] ?? '24h'
      const res = await emsApi.getAiPowerFactor({ deviceId, slaveId: selectedSlaveId || undefined, timeRange })
      const pfTrend = aiPointsToChart(res?.data?.chartData ?? [], 'pf')
      const chartVals = pfTrend.map((p) => p.pf ?? p.value).filter((v) => v != null)
      const rawCurrent = res?.data?.current ?? (chartVals.length ? chartVals[chartVals.length - 1] : null)
      const currentPf = rawCurrent != null ? Number(rawCurrent) : null
      const pfEvents = (res?.data?.alarms ?? []).map((a) => ({
        time: formatTs(a.alarmTime),
        pf: a.currentValue != null ? Number(a.currentValue).toFixed(2) : '—',
        duration: a.durationMinutes != null ? `${a.durationMinutes} min` : (a.duration ?? '—'),
        status: alarmStatus(a),
      }))
      return {
        currentPf,
        pfTrend,
        pfEvents,
        deviceName,
        periodLabel: RANGE_LABELS[timeRange] ?? period,
        stats: [
          { label: 'Avg Power Factor', value: chartVals.length ? (chartVals.reduce((a, b) => a + b, 0) / chartVals.length).toFixed(2) : '—', color: 'text-success-600' },
          { label: 'Min PF', value: chartVals.length ? Math.min(...chartVals).toFixed(2) : '—', color: 'text-primary-600' },
          { label: 'Readings Below 0.85', value: chartVals.length ? String(chartVals.filter((v) => v < 0.85).length) : '—', color: 'text-danger-600' },
        ],
      }
    } catch {
      return { currentPf: null, pfTrend: [], pfEvents: [], deviceName, periodLabel: period, stats: emptyStats() }
    }
  }, [selectedDeviceId, selectedSlaveId, period])

  const currentPf = data?.currentPf ?? null
  const pfTrend = data?.pfTrend ?? []
  const pfEvents = data?.pfEvents ?? []
  const stats = data?.stats ?? emptyStats()

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Power Factor</h2>
          <p className="breadcrumb">User / Power Factor</p>
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-surface-400" />}
      </div>

      <DeviceSlaveSelector onChange={reload} />

      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Period</label>
            <select className="select w-40" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {['Today', 'This Week', 'This Month'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button type="button" className="btn-primary" onClick={reload}>Load</button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-surface-800 text-center mb-4">Current Power Factor — {data?.deviceName ?? 'Device'}</h3>
        <GaugeArc value={currentPf ?? 0} />
        <p className={`text-center text-xs mt-2 ${currentPf == null ? 'text-surface-500' : currentPf >= 0.9 ? 'text-success-600' : 'text-warning-600'}`}>
          {currentPf == null ? 'No power factor reading available' : currentPf >= 0.9 ? 'Excellent — above 0.90 threshold' : 'Below optimal threshold'}
        </p>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-800 mb-1">Power Factor Trend</h3>
        <p className="text-xs text-surface-500 mb-4">{data?.periodLabel ?? period}</p>
        {pfTrend.length === 0 ? <ChartEmpty height={220} /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={pfTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis domain={[0.8, 1.0]} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip formatter={(v) => [v, 'Power Factor']} />
              <Line type="monotone" dataKey="pf" stroke="#F5A623" dot={false} strokeWidth={2} name="Power Factor" />
            </LineChart>
          </ResponsiveContainer>
        )}
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
        <h3 className="text-sm font-semibold text-surface-700 mb-3">PF Below Threshold Events</h3>
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>#</th><th>Timestamp</th><th>Power Factor</th><th>Duration</th><th>Status</th></tr></thead>
              <tbody>
                {pfEvents.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-xs text-surface-500 py-8">No power factor events recorded</td></tr>
                )}
                {pfEvents.map((e, i) => (
                  <tr key={i}>
                    <td className="text-surface-500 font-mono text-xs">{i + 1}</td>
                    <td><span className="font-mono text-xs">{e.time}</span></td>
                    <td className="text-primary-600 font-semibold">{e.pf}</td>
                    <td>{e.duration}</td>
                    <td><span className={`badge ${e.status === 'Active' ? 'badge-danger' : 'badge-success'}`}>{e.status}</span></td>
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
