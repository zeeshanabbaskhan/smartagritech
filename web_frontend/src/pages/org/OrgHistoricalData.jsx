import { useState, useEffect, useCallback, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import PageState, { useFetch } from '../../components/ui/PageState'
import {
  DateRangePicker,
  SearchableSelect,
  MultiSelectTags,
  resolvePresetRange,
} from '../../components/ui/DataCenterFilterBar'
import { Download, Trash2 } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapGateway } from '../../utils/mappers'
import { fetchDeviceVariables } from '../../utils/sensorReadings'
import { downloadDeviceDataCsv } from '../../utils/deviceDataExport'
import { useToast } from '../../context/ToastContext'

const CHART_COLORS = ['#F5A623', '#3B82F6', '#EF4444', '#10B981', '#06b6d4', '#8B5CF6']
const defaultRange = resolvePresetRange('today') || { from: '', to: '' }

function variableLabel(v) {
  const name = v?.displayName || v?.name || ''
  if (v?.registerAddress) return `${name} (${v.registerAddress})`
  return name
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

  const [sourceId, setSourceId] = useState('')
  const [sourceKind, setSourceKind] = useState('device')
  const [slaveId, setSlaveId] = useState('')
  const [slaves, setSlaves] = useState([])
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [deviceVariables, setDeviceVariables] = useState([])
  const [selectedVars, setSelectedVars] = useState([])
  const [chartData, setChartData] = useState([])
  const [tableRows, setTableRows] = useState([])
  const [chartLoading, setChartLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const devices = lookups?.devices ?? []
  const gateways = lookups?.gateways ?? []

  const sourceOptions = useMemo(() => [
    ...devices.map((d) => ({ value: `device:${d.id}`, label: d.name })),
    ...gateways.map((g) => ({ value: `gateway:${g.id}`, label: `${g.name} (Gateway)` })),
  ], [devices, gateways])

  const resolveDeviceId = useCallback(() => {
    if (!sourceId) return ''
    if (sourceKind === 'device') return sourceId
    const underGateway = devices.filter((d) => d.gatewayId === sourceId)
    return underGateway[0]?.id ?? ''
  }, [sourceId, sourceKind, devices])

  const deviceId = resolveDeviceId()

  const slaveOptions = useMemo(
    () => slaves.map((s) => ({ value: s.id, label: s.name })),
    [slaves],
  )
  const variableOptions = useMemo(
    () => deviceVariables.map((v) => ({ value: v.name, label: variableLabel(v) })),
    [deviceVariables],
  )

  useEffect(() => {
    if (!sourceId && devices[0]?.id) {
      setSourceId(devices[0].id)
      setSourceKind('device')
    }
  }, [devices, sourceId])

  useEffect(() => {
    if (!deviceId) {
      setSlaves([])
      setSlaveId('')
      setDeviceVariables([])
      setSelectedVars([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const slaveList = list(await emsApi.getDeviceConfig(deviceId)).map((s) => ({
          id: s.id,
          name: s.name ?? s.slaveName ?? s.id,
        }))
        if (cancelled) return
        setSlaves(slaveList)
        setSlaveId(slaveList[0]?.id ?? '')
      } catch {
        if (!cancelled) {
          setSlaves([])
          setSlaveId('')
        }
      }
    })()
    return () => { cancelled = true }
  }, [deviceId])

  useEffect(() => {
    if (!deviceId || !slaveId) {
      setDeviceVariables([])
      setSelectedVars([])
      return
    }
    let cancelled = false
    fetchDeviceVariables(deviceId, slaveId).then((vars) => {
      if (cancelled) return
      const names = vars.map((v) => v.name).filter(Boolean)
      setDeviceVariables(vars)
      setSelectedVars((prev) => {
        const kept = prev.filter((n) => names.includes(n))
        if (kept.length) return kept
        return names.slice(0, 1)
      })
    }).catch(() => {
      if (!cancelled) {
        setDeviceVariables([])
        setSelectedVars([])
      }
    })
    return () => { cancelled = true }
  }, [deviceId, slaveId])

  const loadData = useCallback(async () => {
    if (!deviceId || selectedVars.length === 0) {
      showToast(!deviceId ? 'Please select a device' : 'Please select at least one variable', 'warning')
      return
    }
    if (!dateFrom || !dateTo) {
      showToast('Please select a date range', 'warning')
      return
    }
    setChartLoading(true)
    try {
      const series = await Promise.all(
        selectedVars.map(async (variableName) => {
          const res = await emsApi.getSensorHistory({
            deviceId,
            variableName,
            startDate: dateFrom,
            endDate: `${dateTo}T23:59:59.999`,
            limit: 200,
          })
          const points = Array.isArray(res?.data) ? res.data : list(res)
          return { key: variableName, points }
        }),
      )

      const byTime = new Map()
      series.forEach(({ key, points }) => {
        ;[...points].reverse().forEach((p) => {
          const ts = new Date(p.receivedTime ?? p.timestamp).getTime()
          if (Number.isNaN(ts)) return
          if (!byTime.has(ts)) {
            byTime.set(ts, {
              time: new Date(ts).toLocaleString([], {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              }),
            })
          }
          byTime.get(ts)[key] = p.value
        })
      })
      const chart = Array.from(byTime.entries()).sort((a, b) => a[0] - b[0]).map(([, row]) => row)
      setChartData(chart)

      const rows = selectedVars.map((name) => {
        const values = chart.map((d) => d[name]).filter((x) => x != null)
        const meta = deviceVariables.find((v) => v.name === name)
        if (!values.length) {
          return { key: name, label: variableLabel(meta || { name }), min: '—', max: '—', avg: '—', last: '—' }
        }
        return {
          key: name,
          label: variableLabel(meta || { name }),
          min: Math.min(...values).toFixed(2),
          max: Math.max(...values).toFixed(2),
          avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
          last: values[values.length - 1],
        }
      })
      setTableRows(rows)
      setLoaded(true)
    } catch {
      setChartData([])
      setTableRows([])
      showToast('Failed to load historical data', 'error')
    } finally {
      setChartLoading(false)
    }
  }, [deviceId, selectedVars, dateFrom, dateTo, deviceVariables, showToast])

  const sourceName = sourceKind === 'gateway'
    ? (gateways.find((g) => g.id === sourceId)?.name ?? '')
    : (devices.find((d) => d.id === sourceId)?.name ?? '')

  const handleExport = async () => {
    if (!deviceId) {
      showToast('Please select a device', 'warning')
      return
    }
    try {
      await emsApi.downloadSensorCsv({
        deviceId,
        slaveId: slaveId || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo ? `${dateTo}T23:59:59.999` : undefined,
      })
      showToast('Download started', 'success')
    } catch (e) {
      if (!tableRows.length || !chartData.length) {
        showToast(e.message || 'No data to export', 'warning')
        return
      }
      const deviceName = sourceName || ''
      const slaveName = slaves.find((s) => s.id === slaveId)?.name || ''
      const wideRows = chartData.map((row) => {
        const readings = selectedVars.map((v) => ({
          variableName: v,
          value: row[v] ?? '',
        }))
        return {
          deviceName,
          slaveName,
          timestamp: row.time,
          readings,
        }
      })
      downloadDeviceDataCsv(wideRows, { deviceName, slaveName })
      showToast('Export started', 'success')
    }
  }

  const handleDeleteData = async () => {
    if (!deviceId) {
      showToast('Please select a device', 'warning')
      return
    }
    if (!confirm(`Delete sensor readings for this device from ${dateFrom} to ${dateTo}?`)) return
    try {
      const res = await emsApi.deleteSensorData({
        deviceId,
        startDate: dateFrom,
        endDate: dateTo ? `${dateTo}T23:59:59.999` : dateTo,
      })
      setChartData([])
      setTableRows([])
      setLoaded(false)
      showToast(`Deleted ${res?.deleted ?? 0} reading(s)`, 'success')
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const onSourceChange = (val) => {
    if (!val) {
      setSourceId('')
      setSourceKind('device')
      return
    }
    const [kind, id] = val.split(':')
    setSourceKind(kind === 'gateway' ? 'gateway' : 'device')
    setSourceId(id)
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Historical Data</h2>
            <p className="breadcrumb">Organization / Historical Data</p>
          </div>
        </div>

        <div className="card p-4 mb-5 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <SearchableSelect
              label="Device"
              className="w-52"
              value={sourceId ? `${sourceKind}:${sourceId}` : ''}
              options={sourceOptions}
              placeholder="Select Device"
              onChange={onSourceChange}
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
              placeholder={deviceId ? 'Select slave' : 'Select device first'}
              disabled={!deviceId || !slaveOptions.length}
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
            <button type="button" className="btn-primary" onClick={loadData} disabled={chartLoading}>
              {chartLoading ? 'Loading...' : 'Load'}
            </button>
            <button type="button" className="btn-primary" onClick={handleExport}>
              <Download size={14} /> Download Data
            </button>
          </div>

          {sourceKind === 'gateway' && sourceId && !deviceId && (
            <p className="text-[10px] text-warning-600">No devices linked to this gateway</p>
          )}
        </div>

        {loaded ? (
          <>
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
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        name={variableLabel(deviceVariables.find((v) => v.name === name) || { name })}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
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
                    <tr>
                      {['Variable Name', 'Min', 'Max', 'Average', 'Last Value'].map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-surface-500">No data available in table</td></tr>
                    ) : tableRows.map((row) => (
                      <tr key={row.key}>
                        <td className="font-medium text-surface-800">{row.label}</td>
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
          </>
        ) : (
          !chartLoading && (
            <div className="card p-16 text-center text-surface-500 text-sm">
              Select filters and click Load to view historical data.
            </div>
          )
        )}
      </div>
    </PageState>
  )
}
