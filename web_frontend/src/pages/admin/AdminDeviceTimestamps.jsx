import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDeviceTimestamp, mapDevice } from '../../utils/mappers'

export default function AdminDeviceTimestamps() {
  const { data: rows, loading, error, reload } = useFetch(async () => {
    const [tsRes, devicesRes] = await Promise.all([
      emsApi.getDeviceTimestamps({ limit: 200 }),
      emsApi.getDevices({ limit: 100 }),
    ])
    const deviceOrgMap = Object.fromEntries(
      list(devicesRes).map((d) => [d.id, mapDevice(d).org])
    )
    return list(tsRes).map((t) => mapDeviceTimestamp(t, deviceOrgMap[t.deviceId]))
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const uptimeBar = (pct) => {
    const num = parseFloat(pct)
    const color = num >= 95 ? 'bg-success-600' : num >= 80 ? 'bg-warning-600' : 'bg-danger-600'
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: pct }} />
        </div>
        <span className="text-xs">{pct}</span>
      </div>
    )
  }

  const columns = [
    { key: 'device', label: 'Device Name' },
    { key: 'org', label: 'Organization' },
    { key: 'lastOnline', label: 'Last Seen Online' },
    { key: 'lastData', label: 'Last Data Received' },
    { key: 'uptime', label: 'Total Uptime', render: (v) => uptimeBar(v) },
    { key: 'downtime', label: 'Total Downtime' },
    { key: 'status', label: 'Status', render: (v) =>
      <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Device Timestamps</h2>
            <p className="breadcrumb">Admin / System / Device Timestamps</p>
          </div>
          <span className="text-xs text-surface-500 bg-surface-100 px-3 py-1.5 rounded-lg border border-surface-200">
            System generated — read only
          </span>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search devices..."
          actions={(row) => (
            <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Device Timestamp Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Device Name', selected.device],
                ['Organization', selected.org],
                ['Last Seen Online', selected.lastOnline],
                ['Last Data Received', selected.lastData],
                ['Total Uptime', selected.uptime],
                ['Total Downtime', selected.downtime],
                ['Status', selected.status],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-40 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
