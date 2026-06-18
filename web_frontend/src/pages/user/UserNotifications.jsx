import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Bell } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapNotificationRow } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

export default function UserNotifications() {
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getNotifications({ limit: 50 })
    return { rows: list(res).map(mapNotificationRow), total: res?.total ?? list(res).length }
  }, [])

  const handleMarkRead = async (row) => {
    if (row.read) return
    try {
      await emsApi.markNotificationRead(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Failed to mark as read', 'error')
    }
  }

  const columns = [
    { key: 'triggerName', label: 'Trigger Name' },
    { key: 'deviceName', label: 'Device' },
    { key: 'description', label: 'Description' },
    { key: 'time', label: 'Time', render: (v) => <span className="text-xs text-surface-500 font-mono">{v}</span> },
    {
      key: 'read',
      label: 'Status',
      render: (v) => <span className={`badge ${v ? 'badge-neutral' : 'badge-warning'}`}>{v ? 'Read' : 'Unread'}</span>,
    },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Notifications</h2>
            <p className="breadcrumb">User / Notifications</p>
          </div>
          <span className="badge badge-warning"><Bell size={12} /> {data?.total ?? 0} total</span>
        </div>
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          searchPlaceholder="Search notifications..."
          pageSize={15}
          actions={(row) => (
            !row.read && (
              <button type="button" className="btn-ghost text-xs px-2 py-1" onClick={() => handleMarkRead(row)}>Mark read</button>
            )
          )}
        />
      </div>
    </PageState>
  )
}
