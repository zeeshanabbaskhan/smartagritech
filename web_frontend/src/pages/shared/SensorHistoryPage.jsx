import { useState, useEffect, useCallback, useRef } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import PageState from '../../components/ui/PageState'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import TimeRangeChips from '../../components/shared/TimeRangeChips'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { flattenSensorRows } from '../../utils/sensorReadings'

export default function SensorHistoryPage({ title = 'Sensor History', breadcrumb = 'Raw sensor data' }) {
  const { selectedDeviceId, selectedSlaveId, selectedDevice } = useDevices()
  const { showToast } = useToast()
  const [timeRange, setTimeRange] = useState('24h')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const pageRef = useRef(1)

  const load = useCallback(async (reset = true) => {
    if (!selectedDeviceId) {
      setRows([])
      setHasMore(false)
      return
    }
    const page = reset ? 1 : pageRef.current
    setLoading(true)
    setError(null)
    try {
      const q = { deviceId: selectedDeviceId, timeRange, page, limit: 50 }
      // Do not filter by slave — many ingests store rows with null deviceConfigSlaveId
      const res = await emsApi.getSensorReadings(q)
      const batch = flattenSensorRows(list(res))
      setRows((prev) => (reset ? batch : [...prev, ...batch]))
      const nextPage = page + 1
      pageRef.current = nextPage
      setHasMore(res?.hasMore ?? batch.length >= 50)
    } catch (e) {
      setError(e.message || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [selectedDeviceId, timeRange])

  useEffect(() => {
    pageRef.current = 1
    load(true)
  }, [selectedDeviceId, timeRange, load])

  const handleDownload = async () => {
    if (!selectedDeviceId) return
    try {
      const q = { deviceId: selectedDeviceId, timeRange }
      const vars = rows[0]?.variableName
      if (vars) q.variableName = vars
      else q.variableName = 'PowerConsumption'
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
          <p className="breadcrumb">
            {breadcrumb}
            {selectedDevice?.name ? ` · ${selectedDevice.name}` : ''}
          </p>
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
        {!loading && selectedDeviceId && rows.length === 0 && (
          <div className="card p-6 mt-4 text-center text-sm text-surface-500">
            No sensor history in this time range for the selected device.
          </div>
        )}
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
