import { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import PageState from '../../components/ui/PageState'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import TimeRangeChips from '../../components/shared/TimeRangeChips'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'

function flattenReadings(rows) {
  const out = []
  for (const row of rows) {
    const ts = row.timestamp ?? row.createdAt
    const readings = row.readings ?? []
    if (Array.isArray(readings) && readings.length) {
      readings.forEach((r) => {
        out.push({
          id: `${ts}-${r.variableName}`,
          timestamp: ts,
          variableName: r.variableName,
          value: r.value,
          unit: r.unit ?? '—',
        })
      })
    }
  }
  return out
}

export default function SensorHistoryPage({ title = 'Sensor History', breadcrumb = 'Raw sensor data' }) {
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const { showToast } = useToast()
  const [timeRange, setTimeRange] = useState('24h')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async (reset = true) => {
    if (!selectedDeviceId) return
    const p = reset ? 1 : page
    setLoading(true)
    setError(null)
    try {
      const q = { deviceId: selectedDeviceId, timeRange, page: p, limit: 50 }
      if (selectedSlaveId) q.slaveId = selectedSlaveId
      const res = await emsApi.getSensorReadings(q)
      const batch = flattenReadings(list(res))
      setRows((prev) => (reset ? batch : [...prev, ...batch]))
      setPage(p + 1)
      setHasMore(batch.length >= 50)
    } catch (e) {
      setError(e.message || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [selectedDeviceId, selectedSlaveId, timeRange, page])

  useEffect(() => {
    setPage(1)
    load(true)
  }, [selectedDeviceId, selectedSlaveId, timeRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async () => {
    if (!selectedDeviceId) return
    try {
      const q = { deviceId: selectedDeviceId, timeRange, variableName: 'PowerConsumption' }
      if (selectedSlaveId) q.slaveId = selectedSlaveId
      await emsApi.downloadSensorCsv(q)
      showToast('CSV download started', 'success')
    } catch (e) {
      showToast(e.message || 'Download failed', 'error')
    }
  }

  const columns = [
    { key: 'timestamp', label: 'Timestamp', render: (v) => <span className="font-mono text-xs">{String(v).slice(0, 19).replace('T', ' ')}</span> },
    { key: 'variableName', label: 'Variable' },
    { key: 'value', label: 'Value', render: (v) => <span className="font-mono text-primary-600">{v}</span> },
    { key: 'unit', label: 'Unit' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="breadcrumb">{breadcrumb}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => load(true)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" className="btn-primary text-xs" onClick={handleDownload} disabled={!selectedDeviceId}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <DeviceSlaveSelector onChange={() => load(true)} />
      <TimeRangeChips value={timeRange} onChange={setTimeRange} />

      <PageState loading={loading && !rows.length} error={error} onRetry={() => load(true)} empty={!selectedDeviceId} emptyMessage="Select a device to view sensor history.">
        <DataTable columns={columns} data={rows} searchPlaceholder="Search variables..." />
        {hasMore && (
          <div className="text-center mt-4">
            <button type="button" className="btn-secondary text-xs" onClick={() => load(false)} disabled={loading}>
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </PageState>
    </div>
  )
}
