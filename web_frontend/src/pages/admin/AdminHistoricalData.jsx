import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, Trash2, X } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import emsApi, { list } from '../../api/emsApi'
import { mapOrganization, mapDevice } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'
import { fetchDeviceVariables } from '../../utils/sensorReadings'
import { downloadCsv } from '../../utils/csv'

const tableColumns = [
  { key: 'variable', label: 'Variable Name' },
  { key: 'value', label: 'Display Value', render: (v) => <span className="font-mono text-primary-600">{v}</span> },
  { key: 'time', label: 'Received Time', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
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
  const [variableKey, setVariableKey] = useState('')
  const [primaryTag, setPrimaryTag] = useState('')
  const [deviceVariables, setDeviceVariables] = useState([])
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())
  const [chartData, setChartData] = useState([])
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const filteredDevices = orgFilter
    ? (filters?.devices ?? []).filter((d) => d.organizationId === orgFilter)
    : (filters?.devices ?? [])

  useEffect(() => {
    if (!deviceFilter) {
      setDeviceVariables([])
      setVariableKey('')
      setPrimaryTag('')
      return
    }
    fetchDeviceVariables(deviceFilter).then((vars) => {
      setDeviceVariables(vars)
      setVariableKey((prev) => {
        const next = prev && vars.some((v) => v.name === prev) ? prev : vars[0]?.name ?? ''
        setPrimaryTag(next)
        return next
      })
    }).catch(() => {
      setDeviceVariables([])
      setVariableKey('')
      setPrimaryTag('')
    })
  }, [deviceFilter])

  const displayVariable = primaryTag || variableKey || 'Variable'

  const loadData = async () => {
    if (!deviceFilter) {
      showToast('Please select a device', 'warning')
      return
    }
    if (!variableKey) {
      showToast('Please select a variable', 'warning')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await emsApi.getSensorHistory({
        deviceId: deviceFilter,
        variableName: variableKey,
        startDate: dateFrom,
        endDate: dateTo ? `${dateTo}T23:59:59.999` : dateTo,
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
        variable: displayVariable,
        time: new Date(p.receivedTime ?? p.timestamp).toLocaleString(),
        value: p.value,
      })))
      setLoaded(true)
    } catch (e) {
      setError(e.message || 'Failed to load historical data')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!deviceFilter) {
      showToast('Please select a device', 'warning')
      return
    }
    try {
      await emsApi.downloadSensorCsv({
        deviceId: deviceFilter,
        variableName: variableKey || undefined,
        startDate: dateFrom,
        endDate: dateTo ? `${dateTo}T23:59:59.999` : dateTo,
      })
      showToast('Download started', 'success')
    } catch (e) {
      // Fallback to client CSV from loaded table
      if (!tableData.length) {
        showToast(e.message || 'Download failed', 'error')
        return
      }
      const header = ['Variable Name', 'Display Value', 'Received Time']
      const rows = tableData.map((r) => [r.variable, r.value, r.time])
      downloadCsv('historical_data.csv', header, rows)
    }
  }

  const handleDeleteData = async () => {
    if (!deviceFilter) {
      showToast('Please select a device', 'warning')
      return
    }
    if (!confirm(`Delete sensor readings for this device from ${dateFrom} to ${dateTo}?`)) return
    try {
      const res = await emsApi.deleteSensorData({
        deviceId: deviceFilter,
        startDate: dateFrom,
        endDate: dateTo ? `${dateTo}T23:59:59.999` : dateTo,
      })
      setChartData([])
      setTableData([])
      setLoaded(false)
      showToast(`Deleted ${res?.deleted ?? 0} reading(s)`, 'success')
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  return (
    <PageState loading={filtersLoading} error={filtersError} onRetry={reloadFilters}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Data Center</h2>
            <p className="breadcrumb">Data Center &ndash; Historical Data</p>
          </div>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-44">
                <label className="label">Organization</label>
                <select className="select" value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setDeviceFilter('') }}>
                  <option value="">All Orgs</option>
                  {(filters?.organizations ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="w-44">
                <label className="label">Device</label>
                <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
                  <option value="">Select Device</option>
                  {filteredDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="w-56">
                <label className="label">Date Range</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" className="input text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <span className="text-surface-400 text-xs">-</span>
                  <input type="date" className="input text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
              <div className="w-44">
                <label className="label">Trigger</label>
                <div className="input flex items-center justify-between text-xs">
                  <span className="truncate">{primaryTag || '—'}</span>
                  <button
                    type="button"
                    onClick={() => setPrimaryTag('')}
                    className="text-surface-400 hover:text-surface-700 flex-shrink-0"
                    aria-label="Clear trigger"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              <div className="w-44">
                <label className="label">Variable</label>
                <select
                  className="select"
                  value={variableKey}
                  onChange={(e) => {
                    setVariableKey(e.target.value)
                    setPrimaryTag(e.target.value)
                  }}
                  disabled={!deviceVariables.length}
                >
                  {!deviceVariables.length && <option value="">Select device first</option>}
                  {deviceVariables.map((v) => <option key={v.name} value={v.name}>{v.name}{v.unit ? ` (${v.unit})` : ''}</option>)}
                </select>
              </div>
              <button type="button" className="btn-primary" onClick={loadData} disabled={loading}>
                {loading ? 'Loading...' : 'Load'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-primary" onClick={handleDownload}><Download size={14} /> Download Data</button>
              <button type="button" className="btn-danger" onClick={handleDeleteData}><Trash2 size={14} /> Delete Data</button>
            </div>
          </div>
        </div>

        {error && (
          <div className="card p-4 mb-5 text-sm text-danger-600">{error}</div>
        )}

        {loaded ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DataTable
              columns={tableColumns}
              data={tableData}
              searchPlaceholder="Search data..."
              pageSize={50}
              pageSizeOptions={[10, 25, 50, 100]}
              emptyMessage="No data available in table"
            />

            <div className="card p-5">
              <ResponsiveContainer width="100%" height={380}>
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
                    name={displayVariable}
                    stroke="#F5A623"
                    strokeWidth={2}
                    dot={{ fill: '#F5A623', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          !loading && !error && (
            <div className="card p-16 text-center text-surface-500 text-sm">
              Select filters and click Load to view historical data.
            </div>
          )
        )}
      </div>
    </PageState>
  )
}
