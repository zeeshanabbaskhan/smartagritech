import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import emsApi, { list } from '../../api/emsApi'
import { mapOrganization, mapDevice } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const VARIABLES = [
  { value: 'VoltageA', label: 'Voltage Phase A', unit: 'V', color: '#F5A623' },
  { value: 'CurrentA', label: 'Current Phase A', unit: 'A', color: '#3B82F6' },
  { value: 'PowerConsumption', label: 'Active Power', unit: 'kWh', color: '#10B981' },
]

const tableColumns = [
  { key: 'time', label: 'Time' },
  { key: 'value', label: 'Value', render: (v) => <span className="font-mono text-primary-600">{v}</span> },
  { key: 'unit', label: 'Unit' },
]

const today = () => new Date().toISOString().slice(0, 10)

export default function AdminHistoricalData() {
  const { showToast } = useToast()
  const { data: filters, loading: filtersLoading, error: filtersError, reload: reloadFilters } = useFetch(async () => {
    const [orgsRes, devicesRes] = await Promise.all([
      emsApi.getOrganizations({ limit: 100 }),
      emsApi.getDevices({ limit: 100 }),
    ])
    return {
      organizations: list(orgsRes).map(mapOrganization),
      devices: list(devicesRes).map(mapDevice),
    }
  }, [])

  const [orgFilter, setOrgFilter] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('')
  const [variableKey, setVariableKey] = useState('VoltageA')
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [chartData, setChartData] = useState([])
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const varMeta = VARIABLES.find((v) => v.value === variableKey)
  const filteredDevices = orgFilter
    ? (filters?.devices ?? []).filter((d) => d.organizationId === orgFilter)
    : (filters?.devices ?? [])

  const loadData = async () => {
    if (!deviceFilter) {
      showToast('Please select a device', 'warning')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await emsApi.getSensorHistory({
        deviceId: deviceFilter,
        variableName: variableKey,
        startDate: dateFrom,
        endDate: dateTo,
        limit: 100,
      })
      const points = Array.isArray(res?.data) ? res.data : list(res)
      const chart = points.map((p) => ({
        time: new Date(p.receivedTime ?? p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: p.value,
      }))
      setChartData(chart)
      setTableData(points.map((p, i) => ({
        id: i,
        time: new Date(p.receivedTime ?? p.timestamp).toLocaleString(),
        value: p.value,
        unit: p.unit ?? varMeta?.unit ?? '—',
      })))
      setLoaded(true)
    } catch (e) {
      setError(e.message || 'Failed to load historical data')
    } finally {
      setLoading(false)
    }
  }

  const selectedDeviceName = filteredDevices.find((d) => d.id === deviceFilter)?.name ?? 'All Devices'

  return (
    <PageState loading={filtersLoading} error={filtersError} onRetry={reloadFilters}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Historical Data</h2>
            <p className="breadcrumb">Admin / Historical Data</p>
          </div>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-32">
              <label className="label">Organization</label>
              <select className="select" value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setDeviceFilter('') }}>
                <option value="">All Orgs</option>
                {(filters?.organizations ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-32">
              <label className="label">Device</label>
              <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
                <option value="">Select Device</option>
                {filteredDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-32">
              <label className="label">Variable</label>
              <select className="select" value={variableKey} onChange={(e) => setVariableKey(e.target.value)}>
                {VARIABLES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-28">
              <label className="label">From</label>
              <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex-1 min-w-28">
              <label className="label">To</label>
              <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={loadData} disabled={loading}>
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>

        {error && (
          <div className="card p-4 mb-5 text-sm text-danger-600">{error}</div>
        )}

        {loaded && (
          <div className="card p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-surface-800">{varMeta.label} — {dateFrom} to {dateTo}</h3>
              <span className="text-xs text-surface-500">{selectedDeviceName}</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12, color: '#1F2937' }}
                  itemStyle={{ color: '#1F2937' }}
                  labelStyle={{ color: '#6B7280', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6B7280' }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={varMeta.label}
                  stroke={varMeta.color}
                  strokeWidth={2}
                  dot={{ fill: varMeta.color, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {loaded && (
          <DataTable
            columns={tableColumns}
            data={tableData}
            searchPlaceholder="Search data..."
            pageSize={12}
          />
        )}
      </div>
    </PageState>
  )
}
