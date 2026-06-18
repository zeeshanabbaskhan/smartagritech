import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import emsApi, { list } from '../../api/emsApi'
import { mapIntervalHistory, bucketToChart } from '../../utils/mappers'

const variables = ['Active Power (kW)', 'Voltage Phase A (V)', 'Current Phase A (A)', 'Power Factor']
const intervals = ['15 min', '30 min', '1 hour', '1 day']
const VAR_MAP = {
  'Active Power (kW)': 'PowerConsumption',
  'Voltage Phase A (V)': 'VoltageA',
  'Current Phase A (A)': 'CurrentA',
  'Power Factor': 'PowerFactor',
}

export default function UserIntervalHistory() {
  const { selectedDeviceId, selectedDevice, selectedSlaveId } = useDevices()

  const { data: historyRows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getIntervalHistory({ limit: 100 })).map(mapIntervalHistory),
    []
  )

  const [variable, setVariable] = useState(variables[0])
  const [interval, setInterval] = useState('1 hour')
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false)

  const loadChart = useCallback(async () => {
    setChartLoading(true)
    try {
      if (!selectedDeviceId) { setChartData([]); return }
      const res = await emsApi.getSensorAggregate({
        deviceId: selectedDeviceId,
        slaveId: selectedSlaveId,
        variableName: VAR_MAP[variable],
        timeRange: '24h',
      })
      const points = bucketToChart(res?.data ?? [], 'value').map((p) => ({
        time: p.time,
        value: p.value,
        unit: variable.includes('Voltage') ? 'V' : variable.includes('Current') ? 'A' : variable.includes('Power F') ? '' : 'kW',
      }))
      setChartData(points)
    } catch {
      setChartData(historyRows?.map((h) => ({ time: h.from, value: h.unit, unit: '' })) ?? [])
    } finally {
      setChartLoading(false)
    }
  }, [variable, historyRows, selectedDeviceId, selectedSlaveId])

  useEffect(() => { loadChart() }, [loadChart])

  const tableColumns = [
    { key: 'time', label: 'Timestamp', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'value', label: 'Value' },
    { key: 'unit', label: 'Unit' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Interval History</h2>
            <p className="breadcrumb">User / Interval History</p>
          </div>
        </div>

        <DeviceSlaveSelector onChange={loadChart} />

        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label">Device</label>
              <input className="input w-40" value={selectedDevice?.name ?? '—'} readOnly />
            </div>
            <div>
              <label className="label">Variable</label>
              <select className="select w-48" value={variable} onChange={(e) => setVariable(e.target.value)}>
                {variables.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Interval</label>
              <select className="select w-32" value={interval} onChange={(e) => setInterval(e.target.value)}>
                {intervals.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">From Date</label>
              <input type="date" className="input w-40" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="label">To Date</label>
              <input type="date" className="input w-40" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={loadChart} disabled={chartLoading}>Load</button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-800 mb-1">{variable} — {selectedDevice?.name ?? '—'}</h3>
          <p className="text-xs text-surface-500 mb-4">Interval: {interval} · {fromDate}</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #ECEEE6', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#F5A623" radius={[3, 3, 0, 0]} name={variable} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-surface-700 mb-3">Data Records</h3>
          <DataTable columns={tableColumns} data={chartData} searchable={false} pageSize={12} />
        </div>
      </div>
    </PageState>
  )
}
