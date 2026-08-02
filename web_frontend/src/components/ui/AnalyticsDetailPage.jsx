import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import DeviceSlaveSelector from '../shared/DeviceSlaveSelector'

const RANGES = ['1h', '24h', '7d', '30d']

function RangeChart({
  title,
  type = 'bar',
  data = [],
  dataKey = 'v',
  color = '#3B82F6',
  range: controlledRange,
  onRangeChange,
}) {
  const [localRange, setLocalRange] = useState('1h')
  const range = controlledRange ?? localRange
  const chartData = Array.isArray(data) && data.length ? data : [{ t: '—', v: 0 }]

  const setRange = (r) => {
    if (controlledRange === undefined) setLocalRange(r)
    onRangeChange?.(r)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">{title}</h3>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                range === r
                  ? 'bg-primary-500 text-surface-950'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        {type === 'bar' ? (
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" vertical={false} />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
            <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
            <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" vertical={false} />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
            <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
            <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export default function AnalyticsDetailPage({
  title,
  valueLabel,
  value,
  anomalyType = 'Anomaly',
  anomalyRows,
  anomalyCount,
  extraAnomalyColumn,
  noAnomalies = false,
  predictedTitle,
  predictedType = 'bar',
  predictedData = [],
  predictedColor = '#3B82F6',
  overTimeTitle,
  overTimeType = 'bar',
  overTimeData = [],
  overTimeColor = '#3B82F6',
  extraFilter,
  backTo,
  onDeviceChange,
  onRangeChange,
  timeRange,
  loading = false,
}) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const rows = noAnomalies
    ? []
    : (anomalyRows ?? []).map((r) => ({
        time: r.time ?? r.detectedAt ?? '—',
        type: r.type ?? r.trigger ?? anomalyType,
        extra: r.extra ?? r.value ?? '—',
      }))

  const total = anomalyCount ?? rows.length
  const totalPages = Math.max(1, Math.ceil(total / 5) || 1)
  const rowsOnPage = rows.slice((page - 1) * 5, page * 5)

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="breadcrumb">Dashboard &ndash; {valueLabel}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => (backTo ? navigate(backTo) : navigate(-1))}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[280px]">
          <DeviceSlaveSelector onChange={onDeviceChange} />
        </div>
        {extraFilter}
        {loading && <span className="text-xs text-surface-400 self-center">Loading…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-bold text-surface-900 dark:text-surface-100 mb-1">{valueLabel}</p>
            <p className="text-4xl font-black text-surface-900 dark:text-surface-100">{value}</p>
          </div>

          <div>
            <p className="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-warning-600" /> Anomalies
            </p>
            <div className="table-container">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      {extraAnomalyColumn && <th>{extraAnomalyColumn}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsOnPage.length === 0 ? (
                      <tr>
                        <td colSpan={extraAnomalyColumn ? 3 : 2} className="text-center py-8 text-surface-400 text-xs">
                          No anomalies detected
                        </td>
                      </tr>
                    ) : (
                      rowsOnPage.map((r, i) => (
                        <tr key={i}>
                          <td className="text-xs font-mono">{r.time}</td>
                          <td><span className="badge badge-danger">{r.type}</span></td>
                          {extraAnomalyColumn && <td className="text-xs text-surface-400">{r.extra}</td>}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {!noAnomalies && total > 5 && (
              <div className="flex items-center gap-1 mt-3 flex-wrap">
                <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${p === page ? 'bg-primary-500 text-surface-950' : 'text-surface-500 hover:bg-surface-100'}`}
                  >
                    {p}
                  </button>
                ))}
                {totalPages > 5 && <span className="text-xs text-surface-400">…</span>}
                {totalPages > 5 && (
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${page === totalPages ? 'bg-primary-500 text-surface-950' : 'text-surface-500 hover:bg-surface-100'}`}
                  >
                    {totalPages}
                  </button>
                )}
                <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <RangeChart
            title={predictedTitle}
            type={predictedType}
            data={predictedData}
            color={predictedColor}
            range={timeRange}
            onRangeChange={onRangeChange}
          />
        </div>
      </div>

      <RangeChart
        title={overTimeTitle}
        type={overTimeType}
        data={overTimeData}
        color={overTimeColor}
        range={timeRange}
        onRangeChange={onRangeChange}
      />
    </div>
  )
}
