import { useState, useEffect, useCallback } from 'react'
import PageState from '../../components/ui/PageState'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import TimeRangeChips from '../../components/shared/TimeRangeChips'
import { useDevices } from '../../context/DeviceContext'
import emsApi from '../../api/emsApi'
import { onSocketEvent, subscribeDevice } from '../../services/socketService'
import { latestToReadings, SUMMARY_CARDS } from '../../utils/sensorReadings'

export default function DashboardDetailPage({ title = 'Dashboard Detail', breadcrumb = 'Live sensor readings' }) {
  const { selectedDeviceId, selectedSlaveId, selectedDevice } = useDevices()
  const [timeRange, setTimeRange] = useState('24h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [readings, setReadings] = useState([])
  const [summary, setSummary] = useState(null)

  const load = useCallback(async () => {
    if (!selectedDeviceId) {
      setLoading(false)
      setReadings([])
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
      setReadings(latestToReadings(latestRes))
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

  const summaryCards = SUMMARY_CARDS
    .map(([key, label]) => ({ key, label, block: summary?.[key] }))
    .filter(({ block }) => block?.value != null)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="breadcrumb">
            {breadcrumb}
            {selectedDevice?.name ? ` · ${selectedDevice.name}` : ''}
          </p>
        </div>
        <TimeRangeChips value={timeRange} onChange={setTimeRange} />
      </div>

      <DeviceSlaveSelector onChange={load} />

      <PageState loading={loading} error={error} onRetry={load} empty={!selectedDeviceId} emptyMessage="No device assigned. Add or select a device first.">
        {readings.length === 0 ? (
          <div className="card p-8 text-center text-sm text-surface-500">
            No live readings for this device yet. Ingest data to see configured variables here.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {readings.map(({ variableName, value, unit }) => (
              <div key={variableName} className="card p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">{variableName}</p>
                <p className="text-lg font-bold text-surface-900 dark:text-surface-100 mt-1 tabular-nums">
                  {value ?? '—'}
                  {unit ? <span className="text-xs text-surface-400 ml-1">{unit}</span> : null}
                </p>
              </div>
            ))}
          </div>
        )}

        {summaryCards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {summaryCards.map(({ key, label, block }) => (
              <div key={key} className="card p-4">
                <p className="text-xs text-surface-500">{label}</p>
                <p className="text-xl font-bold mt-1">{block?.value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </PageState>
    </div>
  )
}
