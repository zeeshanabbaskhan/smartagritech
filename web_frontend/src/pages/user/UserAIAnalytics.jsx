import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import DataTable from '../../components/ui/DataTable'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi from '../../api/emsApi'
import { latestToReadings } from '../../utils/sensorReadings'
import { formatTs } from '../../utils/analyticsHelpers'

const TABS = ['Next 10 Minutes', 'Next 5 Hours', 'Next 7 Days', 'Custom']
const VARIABLE_OPTIONS = ['Voltage Phase A', 'Current Phase A', 'Active Power', 'Power Factor', 'Frequency']
const VAR_MAP = {
  'Voltage Phase A': 'VoltageA',
  'Current Phase A': 'CurrentA',
  'Active Power': 'ActivePower',
  'Power Factor': 'PowerFactor',
  Frequency: 'Frequency',
}
const HORIZON_MAP = {
  'Next 10 Minutes': 'TEN_MIN',
  'Next 5 Hours': 'FIVE_HR',
  'Next 7 Days': 'SEVEN_DAY',
  Custom: 'CUSTOM',
}

export default function UserAIAnalytics() {
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [tab, setTab] = useState('Next 10 Minutes')
  const [variables, setVariables] = useState([])
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { data, loading, error, reload } = useFetch(async () => {
    if (!selectedDeviceId) return { rows: [], chart: [{ t: 'T0', v: 0 }] }
    const q = { deviceId: selectedDeviceId, slaveId: selectedSlaveId || undefined }
    const latestRes = await emsApi.getLatestReadings(q).catch(() => null)
    const readings = latestToReadings(latestRes)
    const selectedKeys = variables.length
      ? variables.map((v) => VAR_MAP[v] || v)
      : readings.map((r) => r.variableName)

    const rows = readings
      .filter((r) => !selectedKeys.length || selectedKeys.some((k) => String(r.variableName).toLowerCase().includes(String(k).toLowerCase())
        || String(k).toLowerCase().includes(String(r.variableName).replace(/\s+/g, '').toLowerCase())))
      .map((r) => ({
        variable: r.variableName,
        value: r.value != null ? String(r.value) : '—',
        time: formatTs(r.lastUpdatedAt) || '—',
      }))

    const primaryVar = variables[0] ? (VAR_MAP[variables[0]] || variables[0]) : (rows[0]?.variable || 'PowerConsumption')
    const predParams = {
      deviceId: selectedDeviceId,
      variableName: primaryVar,
      horizon: HORIZON_MAP[tab] || 'TEN_MIN',
    }
    if (tab === 'Custom') {
      if (customFrom) predParams.from = customFrom
      if (customTo) predParams.to = customTo
    }
    const predRes = await emsApi.getAiPredictions(predParams).catch(() => null)
    const predictions = predRes?.data?.predictions ?? predRes?.data ?? []
    const chart = (Array.isArray(predictions) && predictions.length
      ? predictions
      : rows.map((r, i) => ({ t: `T${i}`, v: Number(r.value) || 0 }))
    ).map((p, i) => ({
      t: p.time ?? p.t ?? formatTs(p.timestamp) ?? `T${i}`,
      v: Number(p.value ?? p.v ?? 0) || 0,
    }))

    return { rows, chart: chart.length ? chart : [{ t: 'T0', v: 0 }] }
  }, [selectedDeviceId, selectedSlaveId, variables, tab, customFrom, customTo])

  const toggleVariable = (v) => {
    setVariables((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  const columns = [
    { key: 'variable', label: 'Variable Name' },
    { key: 'value', label: 'Display Value' },
    { key: 'time', label: 'Received Time' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h2 className="page-title">AI Analytics</h2>
            <p className="breadcrumb">AI Analytics &ndash; AI Analytics Readings</p>
          </div>
        </div>

        <div className="flex items-center gap-6 border-b border-surface-200 dark:border-surface-800 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`pb-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-500 hover:text-surface-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <label className="label">From</label>
              <input
                type="datetime-local"
                className="input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="w-48">
              <label className="label">To</label>
              <input
                type="datetime-local"
                className="input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[280px]">
            <DeviceSlaveSelector onChange={reload} />
          </div>
          <div className="flex-1 min-w-56">
            <label className="label">Variables</label>
            {variables.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 input h-auto py-1.5">
                {variables.map((v) => (
                  <span key={v} className="badge badge-info flex items-center gap-1">
                    {v}
                    <button type="button" onClick={() => toggleVariable(v)} className="hover:text-danger-600">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <select className="select" value="" onChange={(e) => e.target.value && toggleVariable(e.target.value)}>
                <option value="">Select Variables (Multiple - No Limits)</option>
                {VARIABLE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DataTable
            columns={columns}
            data={data?.rows ?? []}
            searchPlaceholder="Search readings..."
            pageSize={50}
            emptyMessage="No data available in table"
          />
          <div className="card p-4">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data?.chart ?? [{ t: 'T0', v: 0 }]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Line type="monotone" dataKey="v" stroke="#F5A623" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </PageState>
  )
}
