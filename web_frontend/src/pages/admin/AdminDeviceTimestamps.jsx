import DataTable from '../../components/ui/DataTable'
import PageState, { useFetch } from '../../components/ui/PageState'
import emsApi, { list } from '../../api/emsApi'
import { mapDeviceTimestamp } from '../../utils/mappers'

export default function AdminDeviceTimestamps() {
  const { data: rows, loading, error, reload } = useFetch(async () => {
    const tsRes = await emsApi.getDeviceTimestamps({ limit: 200 })
    return list(tsRes).map((t) => mapDeviceTimestamp(t))
  }, [])

  const columns = [
    { key: 'device', label: 'Device Name' },
    { key: 'lastDate', label: 'Last Date Activity' },
    { key: 'lastActive', label: 'Last Active' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-neutral'}`}>{v}</span>,
    },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Device Timestamps</h2>
            <p className="breadcrumb">Device Timestamps &ndash; Manage Device Timestamps</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchable={false}
          pageSize={10}
        />
      </div>
    </PageState>
  )
}
