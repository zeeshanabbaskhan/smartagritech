import { useState, useEffect, useCallback } from 'react'
import PageState from '../../components/ui/PageState'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import TimeRangeChips from '../../components/shared/TimeRangeChips'
import { useDevices } from '../../context/DeviceContext'
import emsApi, { one } from '../../api/emsApi'
import { onSocketEvent, subscribeDevice } from '../../services/socketService'

const READING_KEYS = [
  ['VoltageA', 'V'], ['VoltageB', 'V'], ['VoltageC', 'V'],
  ['CurrentA', 'A'], ['CurrentB', 'A'], ['CurrentC', 'A'],
  ['ActivePower', 'kW'], ['ReactivePower', 'kVar'], ['ApparentPower', 'kVA'],
  ['PowerConsumption', 'kWh'], ['ExportPower', 'kWh'], ['PowerFactor', ''],
  ['Frequency', 'Hz'], ['THD_V', '%'], ['THD_I', '%'],
]

export default function DashboardDetailPage({ title = 'Dashboard Detail', breadcrumb = 'Live sensor readings' }) {
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [timeRange, setTimeRange] = useState('24h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [latest, setLatest] = useState({})
  const [summary, setSummary] = useState(null)

  const load = useCallback(async () => {
    if (!selectedDeviceId) {
      setLoading(false)
      setLatest({})
      setSummary(null)
      return
    }
    setLoading(true)
    setError(null)
    subscribeDevice(selectedDeviceId)
    try {
      const q = { deviceId: selectedDeviceId, timeRange }
      if (selectedSlaveId) q.slaveId = selectedSlaveId
      const [latestRes, summaryRes] = await Promise.all([
        emsApi.getLatestReadings(q),
        emsApi.getDashboardSummary(q),
      ])
      setLatest(one(latestRes) ?? latestRes?.data ?? {})
      setSummary(summaryRes?.data ?? null)
    } catch (e) {
      setError(e.message || 'Failed to load readings')
    } finally {
      setLoading(false)
    }
  }, [selectedDeviceId, selectedSlaveId, timeRange])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    return onSocketEvent((event, data) => {
      if (event === 'reading:new' && data?.deviceId === selectedDeviceId) load()
    })
  }, [selectedDeviceId, load])

  const valueFor = (key) => {
    const readings = latest.readings ?? latest.values ?? []
    if (Array.isArray(readings)) {
      const hit = readings.find((r) => r.variableName === key)
      if (hit) return `${hit.value}${hit.unit ? ` ${hit.unit}` : ''}`
    }
    if (latest[key] != null) return String(latest[key])
    const block = summary?.[key === 'PowerConsumption' ? 'totalPowerConsumption' : key]
    if (block?.value != null) return String(block.value)
    return '—'
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="breadcrumb">{breadcrumb}</p>
        </div>
        <TimeRangeChips value={timeRange} onChange={setTimeRange} />
      </div>

      <DeviceSlaveSelector onChange={load} />

      <PageState loading={loading} error={error} onRetry={load} empty={!selectedDeviceId} emptyMessage="No device assigned. Add or select a device first.">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {READING_KEYS.map(([key, unit]) => (
            <div key={key} className="card p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">{key}</p>
              <p className="text-lg font-bold text-surface-900 dark:text-surface-100 mt-1 tabular-nums">
                {valueFor(key)}
                {!valueFor(key).includes(' ') && unit ? <span className="text-xs text-surface-400 ml-1">{unit}</span> : null}
              </p>
            </div>
          ))}
        </div>

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {[
              ['totalPowerConsumption', 'Total Consumption'],
              ['powerFactor', 'Power Factor'],
              ['voltageImbalance', 'Voltage Imbalance'],
            ].map(([k, label]) => (
              <div key={k} className="card p-4">
                <p className="text-xs text-surface-500">{label}</p>
                <p className="text-xl font-bold mt-1">{summary[k]?.value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </PageState>
    </div>
  )
}
