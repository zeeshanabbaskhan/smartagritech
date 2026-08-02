import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LabelList, Cell,
} from 'recharts'
import { ArrowLeft } from 'lucide-react'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi, { list } from '../../api/emsApi'
import { mapAnomaly } from '../../utils/mappers'
import { formatTs } from '../../utils/analyticsHelpers'

const RANGES = ['1h', '24h', '7d', '30d']
const COLORS = ['#EF4444', '#F5A623', '#F97316', '#3B82F6', '#10B981']
const RANGE_MS = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}
const BUCKET_MS = {
  '1h': 5 * 60 * 1000,
  '24h': 30 * 60 * 1000,
  '7d': 6 * 60 * 60 * 1000,
  '30d': 24 * 60 * 60 * 1000,
}

function rangeBounds(range) {
  const ms = RANGE_MS[range] || RANGE_MS['24h']
  const to = new Date()
  const from = new Date(to.getTime() - ms)
  return { from: from.toISOString(), to: to.toISOString() }
}

function bucketTimeline(rows, range) {
  const bucketMs = BUCKET_MS[range] || BUCKET_MS['24h']
  const buckets = new Map()
  for (const a of rows) {
    const raw = a._raw?.alarmTime ?? a.time
    const ts = new Date(raw).getTime()
    if (!Number.isFinite(ts)) continue
    const key = Math.floor(ts / bucketMs) * bucketMs
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, count]) => ({
      t: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      v: count,
    }))
}

export default function UserAnomalies() {
  const navigate = useNavigate()
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [timelineRange, setTimelineRange] = useState('1h')
  const [breakdownRange, setBreakdownRange] = useState('1h')

  const { data, loading, reload } = useFetch(async () => {
    const { from, to } = rangeBounds(timelineRange)
    const params = {
      limit: 200,
      from,
      to,
      timeRange: timelineRange,
      ...(selectedDeviceId ? { deviceId: selectedDeviceId } : {}),
    }
    const rows = list(await emsApi.getAnomalies(params).catch(() => ({ data: [] }))).map(mapAnomaly)

    let timelineData = []
    if (selectedDeviceId) {
      const timelineRes = await emsApi.getAnomalyTimeline({
        deviceId: selectedDeviceId,
        from,
        to,
      }).catch(() => null)
      const points = list(timelineRes)
      timelineData = points.map((p) => ({
        t: formatTs(p.timestamp) || '—',
        v: Number(p.count) || 0,
      }))
    }
    if (!timelineData.length) {
      timelineData = bucketTimeline(rows, timelineRange)
    }

    const byType = {}
    for (const a of rows) {
      const key = a.type || 'Anomaly'
      if (!byType[key]) byType[key] = { key, label: key, category: a.variable || 'General', count: 0 }
      byType[key].count += 1
    }
    const issues = Object.values(byType)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((i, idx) => ({ ...i, color: COLORS[idx % COLORS.length] }))

    return {
      totalAnomalies: rows.length,
      issues: issues.length ? issues : [{ key: 'none', label: 'None', category: '—', count: 0, color: '#9AA09A' }],
      timelineData: timelineData.length ? timelineData : [{ t: '—', v: 0 }],
    }
  }, [selectedDeviceId, selectedSlaveId, timelineRange])

  const totalAnomalies = data?.totalAnomalies ?? 0
  const issues = data?.issues ?? []
  const timelineData = data?.timelineData ?? [{ t: '—', v: 0 }]

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Anomalies Details</h2>
          <p className="breadcrumb">Dashboard &ndash; Anomalies</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate('/user')}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[280px]">
          <DeviceSlaveSelector onChange={reload} />
        </div>
        {loading && <span className="text-xs text-surface-400">Loading…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-bold text-surface-900 dark:text-surface-100 mb-1">Anomalies</p>
            <p className="text-5xl font-black text-danger-600">{totalAnomalies}</p>
            <p className="text-xs text-surface-400 mt-1">Count aims to trend downward</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Timeline</h3>
              <div className="flex items-center gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTimelineRange(r)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                      timelineRange === r
                        ? 'bg-primary-500 text-surface-950'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="v" stroke="#EF4444" fill="#FEE2E2" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Issues Breakdown</h3>
            <div className="flex items-center gap-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setBreakdownRange(r)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                    breakdownRange === r
                      ? 'bg-primary-500 text-surface-950'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={issues} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: '#6B7280' }} stroke="#D1D5C8" />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {issues.map((i) => <Cell key={i.key} fill={i.color} />)}
                <LabelList dataKey="count" position="insideRight" fill="#ffffff" fontSize={11} fontWeight="bold" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-surface-100 dark:border-surface-800">
            {issues.map((issue) => (
              <div key={issue.key} className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: issue.color }} />
                <div>
                  <p className="text-xs font-bold text-surface-900 dark:text-surface-100">{issue.label}</p>
                  <p className="text-[10px] text-surface-400">{issue.category}</p>
                  <p className="text-[10px] text-surface-400">Low Priority &middot; {issue.count} occurrences</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
