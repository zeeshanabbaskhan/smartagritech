import { useState } from 'react'
import { Eye } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import emsApi, { list } from '../../api/emsApi'
import { mapScheduledTask } from '../../utils/mappers'

export default function UserSchedule() {
  const { selectedDeviceId, selectedDevice } = useDevices()

  const { data, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getScheduledTasks({
      limit: 100,
      ...(selectedDeviceId ? { deviceId: selectedDeviceId } : {}),
    })
    return { rows: list(res).map(mapScheduledTask) }
  }, [selectedDeviceId])

  const [viewing, setViewing] = useState(null)
  const rows = (data?.rows ?? []).map((r) => ({
    ...r,
    type: r.taskType,
    freq: r.frequency,
    nextRun: r.nextRun,
  }))

  const columns = [
    { key: 'name', label: 'Task Name' },
    { key: 'device', label: 'Device' },
    { key: 'type', label: 'Task Type' },
    { key: 'freq', label: 'Frequency' },
    { key: 'nextRun', label: 'Next Run', render: (v) => <span className="text-xs font-mono text-surface-400">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Scheduled Tasks</h2>
            <p className="breadcrumb">User / Schedule</p>
          </div>
          <div className="text-xs text-surface-500 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5">
            Device: <span className="text-surface-800 font-medium">{selectedDevice?.name ?? '—'}</span>
          </div>
        </div>

        <DeviceSlaveSelector onChange={reload} />

        <DataTable columns={columns} data={rows} searchPlaceholder="Search tasks..."
          actions={(row) => (
            <button type="button" className="btn-ghost p-1.5 rounded" title="View" onClick={() => setViewing(row)}><Eye size={14} /></button>
          )}
        />

        <Modal open={!!viewing} onClose={() => setViewing(null)} title="Task Details" size="sm">
          {viewing && (
            <div className="space-y-3">
              {[['Task Name', viewing.name], ['Device', viewing.device], ['Task Type', viewing.type], ['Frequency', viewing.freq], ['Next Run', viewing.nextRun], ['Status', viewing.status]].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-surface-400">{label}</span>
                  <span className="text-surface-900 font-medium">{val}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
