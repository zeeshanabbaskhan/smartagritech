import { useState } from 'react'
import { Trash2, Eye } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import emsApi, { list } from '../../api/emsApi'
import { mapNotificationRow } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

export default function UserNotifications() {
  const { showToast } = useToast()
  const [selected, setSelected] = useState(null)

  const { data, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getNotifications({ limit: 50 })
    return { rows: list(res).map(mapNotificationRow) }
  }, [])

  const handleDeleteAll = async () => {
    if (!(data?.rows?.length)) return
    if (!confirm('Delete all notifications?')) return
    try {
      await emsApi.deleteAllNotifications()
      reload()
    } catch (e) {
      showToast(e.message || 'Delete all failed', 'error')
    }
  }

  const handleDelete = async (row) => {
    try {
      await emsApi.deleteNotification(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const columns = [
    { key: 'triggerName', label: 'Trigger Name' },
    { key: 'deviceName', label: 'Device Name' },
    { key: 'description', label: 'Description' },
    { key: 'time', label: 'Time', render: (v) => <span className="text-xs text-surface-500 font-mono">{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Alarm Notifications</h2>
            <p className="breadcrumb">Manage Alarm Notifications &ndash; List</p>
          </div>
        </div>

        <div className="mb-3">
          <button type="button" className="btn-danger" onClick={handleDeleteAll}>
            <Trash2 size={14} /> Delete All
          </button>
        </div>

        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          searchPlaceholder="Search notifications..."
          emptyMessage="No data available in table"
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => setSelected(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal open={!!selected} onClose={() => setSelected(null)} title="Notification Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Trigger Name', selected.triggerName],
                ['Device Name', selected.deviceName],
                ['Description', selected.description],
                ['Time', selected.time],
              ].map(([label, val]) => (
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
