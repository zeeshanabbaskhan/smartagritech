import { useState, useEffect, useMemo, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, Trash2 } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import {
  DateRangePicker,
  SearchableSelect,
  MultiSelectTags,
  resolvePresetRange,
} from '../../components/ui/DataCenterFilterBar'
import PageState, { useFetch } from '../../components/ui/PageState'
import emsApi, { list } from '../../api/emsApi'
import { mapOrganization, mapDevice } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'
import { fetchDeviceVariables } from '../../utils/sensorReadings'
import { downloadDeviceDataCsv, pivotLongRowsToWide } from '../../utils/deviceDataExport'

const CHART_COLORS = ['#F5A623', '#3B82F6', '#EF4444', '#10B981', '#06b6d4', '#8B5CF6']

const tableColumns = [
  { key: 'variable', label: 'Variable Name' },
  { key: 'displayName', label: 'Display Name' },
  { key: 'value', label: 'Display Value', render: (v) => <span className="font-mono text-primary-600">{v}</span> },
  { key: 'time', label: 'Received Time', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
]

const defaultRange = resolvePresetRange('today') || { from: '', to: '' }

function variableLabel(v) {
  const name = v.displayName || v.name
  if (v.registerAddress) return `${name} (${v.registerAddress})`
  return name
}

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
  const [slaveId, setSlaveId] = useState('')
  const [slaves, setSlaves] = useState([])
  const [deviceVariables, setDeviceVariables] = useState([])
  const [selectedVars, setSelectedVars] = useState([])
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [chartData, setChartData] = useState([])
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const filteredDevices = useMemo(() => (
    orgFilter
      ? (filters?.devices ?? []).filter((d) => d.organizationId === orgFilter)
      : (filters?.devices ?? [])
  ), [filters?.devices, orgFilter])

  const orgOptions = useMemo(
    () => (filters?.organizations ?? []).map((o) => ({ value: o.id, label: o.name })),
    [filters?.organizations],
  )
  const deviceOptions = useMemo(
    () => filteredDevices.map((d) => ({ value: d.id, label: d.name })),
    [filteredDevices],
  )
  const slaveOptions = useMemo(
    () => slaves.map((s) => ({ value: s.id, label: s.name })),
    [slaves],
  )
  const variableOptions = useMemo(
    () => deviceVariables.map((v) => ({ value: v.name, label: variableLabel(v) })),
    [deviceVariables],
  )

  useEffect(() => {
    if (!deviceFilter) {
      setSlaves([])
      setSlaveId('')
      setDeviceVariables([])
      setSelectedVars([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const slaveList = list(await emsApi.getDeviceConfig(deviceFilter)).map((s) => ({
          id: s.id,
          name: s.name ?? s.slaveName ?? s.id,
        }))
        if (cancelled) return
        setSlaves(slaveList)
        const nextSlave = slaveList[0]?.id ?? ''
        setSlaveId(nextSlave)
      } catch {
        if (!cancelled) {
          setSlaves([])
          setSlaveId('')
        }
      }
    })()
    return () => { cancelled = true }
  }, [deviceFilter])

  useEffect(() => {
    if (!deviceFilter || !slaveId) {
      setDeviceVariables([])
      setSelectedVars([])
      return
    }
    let cancelled = false
    fetchDeviceVariables(deviceFilter, slaveId).then((vars) => {
      if (cancelled) return
      setDeviceVariables(vars)
      setSelectedVars((prev) => {
        const names = vars.map((v) => v.name)
        const kept = prev.filter((n) => names.includes(n))
        if (kept.length) return kept
        return names[0] ? [names[0]] : []
      })
    }).catch(() => {
      if (!cancelled) {
        setDeviceVariables([])
        setSelectedVars([])
      }
    })
    return () => { cancelled = true }
  }, [deviceFilter, slaveId])

  const loadData = useCallback(async () => {
    if (!deviceFilter) {
      showToast('Please select a device', 'warning')
      return
    }
    if (!selectedVars.length) {
      showToast('Please select at least one variable', 'warning')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const series = await Promise.all(
        selectedVars.map(async (variableName) => {
          const res = await emsApi.getSensorHistory({
            deviceId: deviceFilter,
            variableName,
            startDate: dateFrom,
            endDate: dateTo ? `${dateTo}T23:59:59.999` : dateTo,
            limit: 200,
          })
          const points = Array.isArray(res?.data) ? res.data : list(res)
          const meta = deviceVariables.find((v) => v.name === variableName)
          return {
            key: variableName,
            label: variableLabel(meta || { name: variableName }),
            displayName: meta?.displayName || variableName,
            points,
          }
        }),
      )

      const table = []
      series.forEach(({ key, label, displayName, points }) => {
        points.forEach((p, i) => {
          table.push({
            id: `${key}-${i}-${p.receivedTime ?? p.timestamp}`,
            variable: label,
            displayName,
            time: new Date(p.receivedTime ?? p.timestamp).toLocaleString(),
            value: p.value,
            _ts: new Date(p.receivedTime ?? p.timestamp).getTime(),
          })
        })
      })
      table.sort((a, b) => (b._ts || 0) - (a._ts || 0))
      setTableData(table)

      const byTime = new Map()
      series.forEach(({ key, points }) => {
        ;[...points].reverse().forEach((p) => {
          const ts = new Date(p.receivedTime ?? p.timestamp).getTime()
          if (Number.isNaN(ts)) return
          if (!byTime.has(ts)) {
            byTime.set(ts, {
              time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })
          }
          byTime.get(ts)[key] = p.value
        })
      })
      setChartData(Array.from(byTime.entries()).sort((a, b) => a[0] - b[0]).map(([, row]) => row))
      setLoaded(true)
    } catch (e) {
      setError(e.message || 'Failed to load historical data')
    } finally {
      setLoading(false)
    }
  }, [deviceFilter, selectedVars, dateFrom, dateTo, deviceVariables, showToast])

  const handleDownload = async () => {
    if (!deviceFilter) {
      showToast('Please select a device', 'warning')
      return
    }
    try {
      await emsApi.downloadSensorCsv({
        deviceId: deviceFilter,
        slaveId: slaveId || undefined,
        startDate: dateFrom,
        endDate: dateTo ? `${dateTo}T23:59:59.999` : dateTo,
      })
      showToast('Download started', 'success')
    } catch (e) {
      if (!tableData.length) {
        showToast(e.message || 'Download failed', 'error')
        return
      }
      const deviceName = filteredDevices.find((d) => d.id === deviceFilter)?.name || ''
      const slaveName = slaves.find((s) => s.id === slaveId)?.name || ''
      const longRows = tableData.map((r) => ({
        variableName: r.variable,
        value: r.value,
        timestamp: r.time,
        deviceName,
        slaveName,
      }))
      downloadDeviceDataCsv(pivotLongRowsToWide(longRows, { deviceName, slaveName }))
      showToast('Download started', 'success')
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

        <div className="card p-4 mb-5 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <SearchableSelect
              label="Organization"
              className="w-44"
              value={orgFilter}
              options={orgOptions}
              placeholder="All Orgs"
              onChange={(v) => { setOrgFilter(v); setDeviceFilter('') }}
            />
            <SearchableSelect
              label="Device"
              className="w-52"
              value={deviceFilter}
              options={deviceOptions}
              placeholder="Select Device"
              onChange={setDeviceFilter}
            />
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onApply={(from, to) => { setDateFrom(from); setDateTo(to) }}
              className="w-56"
            />
            <button type="button" className="btn-danger self-end" onClick={handleDeleteData}>
              <Trash2 size={14} /> Delete Data
            </button>
            <SearchableSelect
              label="Slave"
              className="w-48"
              value={slaveId}
              options={slaveOptions}
              placeholder={deviceFilter ? 'Select slave' : 'Select device first'}
              disabled={!deviceFilter || !slaveOptions.length}
              onChange={setSlaveId}
            />
            <MultiSelectTags
              label="Variable"
              className="min-w-[240px] flex-1"
              values={selectedVars}
              options={variableOptions}
              placeholder={slaveId ? 'Select variables' : 'Select slave first'}
              disabled={!slaveId || !variableOptions.length}
              onChange={setSelectedVars}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={loadData} disabled={loading}>
              {loading ? 'Loading...' : 'Load'}
            </button>
            <button type="button" className="btn-primary" onClick={handleDownload}>
              <Download size={14} /> Download Data
            </button>
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
              {chartData.length === 0 ? (
                <div className="h-[380px] flex items-center justify-center text-surface-500 text-sm">
                  No chart data for selected filters
                </div>
              ) : (
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
                    {selectedVars.map((name, i) => {
                      const meta = deviceVariables.find((v) => v.name === name)
                      return (
                        <Line
                          key={name}
                          type="monotone"
                          dataKey={name}
                          name={variableLabel(meta || { name })}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 5 }}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
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
