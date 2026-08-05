import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Download } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapGateway, bucketToChart } from '../../utils/mappers'
import { fetchDeviceVariables } from '../../utils/sensorReadings'
import { downloadCsv } from '../../utils/csv'
import { useToast } from '../../context/ToastContext'

const CHART_COLORS = ['#F5A623', '#3B82F6', '#EF4444', '#10B981', '#06b6d4', '#8B5CF6']
const RANGE_MAP = { today: '24h', '7days': '7d', '30days': '30d' }

function yesterdayIso() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export default function OrgHistoricalData() {
  const { showToast } = useToast()
  const { data: lookups, loading, error, reload } = useFetch(async () => {
    const [devicesRes, gatewaysRes] = await Promise.all([
      emsApi.getDevices({ limit: 200 }),
      emsApi.getGateways({ limit: 200 }),
    ])
    return {
      devices: list(devicesRes).map(mapDevice),
      gateways: list(gatewaysRes).map(mapGateway),
    }
  }, [])

  const [sourceId, setSourceId] = useState('') // device or gateway id
  const [sourceKind, setSourceKind] = useState('device') // 'device' | 'gateway'
  const [dateRange, setDateRange] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [deviceVariables, setDeviceVariables] = useState([])
  const [selectedVars, setSelectedVars] = useState([])
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)

  const devices = lookups?.devices ?? []
  const gateways = lookups?.gateways ?? []

  const resolveDeviceId = useCallback(() => {
    if (!sourceId) return ''
    if (sourceKind === 'device') return sourceId
    const underGateway = devices.filter((d) => d.gatewayId === sourceId)
    return underGateway[0]?.id ?? ''
  }, [sourceId, sourceKind, devices])

  const deviceId = resolveDeviceId()

  useEffect(() => {
    if (!sourceId && devices[0]?.id) {
      setSourceId(devices[0].id)
      setSourceKind('device')
    }
  }, [devices, sourceId])

  useEffect(() => {
    if (!deviceId) {
      setDeviceVariables([])
      setSelectedVars([])
      return
    }
    fetchDeviceVariables(deviceId).then((vars) => {
      const names = vars.map((v) => v.name).filter(Boolean)
      setDeviceVariables(vars)
      setSelectedVars((prev) => {
        const kept = prev.filter((n) => names.includes(n))
        if (kept.length) return kept
        return names.slice(0, 2)
      })
    }).catch(() => {
      setDeviceVariables([])
      setSelectedVars([])
    })
  }, [deviceId])

  const loadChart = useCallback(async () => {
    if (!deviceId || selectedVars.length === 0) {
      setChartData([])
      return
    }
    setChartLoading(true)
    try {
      const useHistory = dateRange === 'custom' || dateRange === 'yesterday'
      let startDate
      let endDate
      let timeRange
      if (dateRange === 'yesterday') {
        startDate = yesterdayIso()
        endDate = startDate
      } else if (dateRange === 'custom') {
        startDate = customFrom
        endDate = customTo
        if (!startDate || !endDate) {
          setChartData([])
          setChartLoading(false)
          return
        }
      } else {
        timeRange = RANGE_MAP[dateRange] ?? '24h'
      }

      const series = await Promise.all(
        selectedVars.map(async (variableName) => {
          if (useHistory) {
            const res = await emsApi.getSensorHistory({
              deviceId,
              variableName,
              startDate,
              endDate,
              limit: 200,
            })
            const points = Array.isArray(res?.data) ? res.data : list(res)
            const chartPts = [...points].reverse().map((p) => ({
              time: new Date(p.receivedTime ?? p.timestamp).toLocaleString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              }),
              [variableName]: p.value,
              value: p.value,
            }))
            return { key: variableName, points: chartPts }
          }
          const res = await emsApi.getSensorAggregate({ deviceId, variableName, timeRange })
          return { key: variableName, points: bucketToChart(res?.data ?? [], variableName) }
        }),
      )
      const maxLen = Math.max(...series.map((s) => s.points.length), 0)
      const merged = Array.from({ length: maxLen }, (_, i) => {
        const row = { time: series[0]?.points[i]?.time ?? `${i}` }
        series.forEach(({ key, points }) => { row[key] = points[i]?.[key] ?? points[i]?.value })
        return row
      })
      setChartData(merged)
    } catch {
      setChartData([])
    } finally {
      setChartLoading(false)
    }
  }, [deviceId, dateRange, selectedVars, customFrom, customTo])

  useEffect(() => { loadChart() }, [loadChart])

  const toggleVar = (name) => {
    setSelectedVars((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]))
  }

  const sourceName = sourceKind === 'gateway'
    ? (gateways.find((g) => g.id === sourceId)?.name ?? '')
    : (devices.find((d) => d.id === sourceId)?.name ?? '')

  const tableColumns = ['Variable Name', 'Min', 'Max', 'Average', 'Last Value']
  const tableData = selectedVars.map((name) => {
    const values = chartData.map((d) => d[name]).filter((x) => x != null)
    const meta = deviceVariables.find((v) => v.name === name)
    if (!values.length) return { key: name, label: name, unit: meta?.unit ?? '', min: '—', max: '—', avg: '—', last: '—' }
    const min = Math.min(...values).toFixed(2)
    const max = Math.max(...values).toFixed(2)
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
    const last = values[values.length - 1]
    return { key: name, label: name, unit: meta?.unit ?? '', min, max, avg, last }
  })

  const handleExport = () => {
    if (!tableData.length || !chartData.length) {
      showToast('No data to export', 'warning')
      return
    }
    const header = ['Time', ...selectedVars]
    const rows = chartData.map((row) => [row.time, ...selectedVars.map((v) => row[v] ?? '')])
    downloadCsv('org_historical_data.csv', header, rows)
    showToast('Export started', 'success')
  }

  const onSourceChange = (e) => {
    const val = e.target.value
    const opt = e.target.selectedOptions?.[0]
    const kind = opt?.dataset?.kind || 'device'
    setSourceId(val)
    setSourceKind(kind)
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Historical Data</h2>
            <p className="breadcrumb">Organization / Historical Data</p>
          </div>
          <button type="button" className="btn-secondary" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-40">
              <label className="label">Device</label>
              <select className="select" value={sourceId} onChange={onSourceChange}>
                <option value="">Select Device</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id} data-kind="device">{d.name}</option>
                ))}
                {gateways.map((g) => (
                  <option key={g.id} value={g.id} data-kind="gateway">{g.name} (Gateway)</option>
                ))}
              </select>
              {sourceKind === 'gateway' && sourceId && !deviceId && (
                <p className="text-[10px] text-warning-600 mt-1">No devices linked to this gateway</p>
              )}
            </div>
            <div className="flex-1 min-w-40">
              <label className="label">Date Range</label>
              <select className="select" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {dateRange === 'custom' && (
              <div className="flex-1 min-w-56">
                <label className="label">Custom Range</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" className="input text-xs" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  <span className="text-surface-400 text-xs">-</span>
                  <input type="date" className="input text-xs" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </div>
            )}
            <div className="flex-1 min-w-40">
              <label className="label">Variables</label>
              <div className="flex flex-wrap gap-2">
                {deviceVariables.length === 0 ? (
                  <span className="text-xs text-surface-500">Select a device with configured variables</span>
                ) : deviceVariables.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => toggleVar(v.name)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      selectedVars.includes(v.name)
                        ? 'border-primary-500 bg-primary-600/20 text-primary-800 font-bold'
                        : 'border-surface-200 text-surface-600 hover:border-surface-500'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5 mb-5">
          <h3 className="text-sm font-semibold text-surface-700 mb-4">
            {sourceName || 'Select a device'} — Variable Trend
            {chartLoading && <span className="text-xs text-surface-400 ml-2">Loading...</span>}
          </h3>
          {selectedVars.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-surface-500 text-sm">
              Select at least one variable to display the chart
            </div>
          ) : chartData.length === 0 && !chartLoading ? (
            <div className="h-64 flex items-center justify-center text-surface-500 text-sm">
              No historical data for selected variables in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {selectedVars.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} name={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="table-container">
          <div className="p-4 border-b border-surface-200">
            <h3 className="text-sm font-semibold text-surface-700">Variable Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>{tableColumns.map((col) => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-surface-500">Select variables to see summary</td></tr>
                ) : tableData.map((row) => (
                  <tr key={row.key}>
                    <td className="font-medium text-surface-800">{row.label}{row.unit ? ` (${row.unit})` : ''}</td>
                    <td className="text-danger-600">{row.min}</td>
                    <td className="text-success-600">{row.max}</td>
                    <td className="text-primary-600">{row.avg}</td>
                    <td>{row.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageState>
  )
}
