import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapLinkageRecord, mapDevice } from '../../utils/mappers'

export default function AdminLinkageRecords() {
  const [deviceFilter, setDeviceFilter] = useState('')

  const { data: filters, loading: filtersLoading, error: filtersError, reload: reloadFilters } = useFetch(async () => {
    const devicesRes = await emsApi.getDevices({ limit: 100 })
    return { devices: list(devicesRes).map(mapDevice) }
  }, [])

  const { data: rows, loading, error, reload } = useFetch(async () => {
    const params = { limit: 100 }
    if (deviceFilter) params.deviceId = deviceFilter
    const [res, devicesRes] = await Promise.all([
      emsApi.getLinkageHistory(params),
      filters?.devices ? Promise.resolve(null) : emsApi.getDevices({ limit: 100 }),
    ])
    const devices = filters?.devices ?? list(devicesRes).map(mapDevice)
    const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]))
    return list(res).map((r) => mapLinkageRecord(r, deviceMap[r.deviceId]))
  }, [deviceFilter])

  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const columns = [
    { key: 'name', label: 'Linkage Name' },
    { key: 'srcDevice', label: 'Source Device' },
    { key: 'srcVar', label: 'Source Variable' },
    { key: 'condition', label: 'Condition', render: (v) => <span className="font-mono badge badge-info">{v}</span> },
    { key: 'threshold', label: 'Threshold', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'tgtDevice', label: 'Target Device' },
    { key: 'action', label: 'Action', render: (v) => <span className={`badge ${v === 'Turn On' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'createdAt', label: 'Created At' },
  ]

  return (
    <PageState loading={filtersLoading || loading} error={filtersError || error} onRetry={() => { reloadFilters(); reload() }}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Linkage Records</h2>
            <p className="breadcrumb">Admin / Linkage Records</p>
          </div>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-40">
              <label className="label">Filter by Device</label>
              <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
                <option value="">All Devices</option>
                {(filters?.devices ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search linkages..."
          actions={(row) => (
            <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Linkage Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Name', selected.name],
                ['Source Device', selected.srcDevice],
                ['Source Variable', selected.srcVar],
                ['Condition', selected.condition],
                ['Threshold', selected.threshold],
                ['Target Device', selected.tgtDevice],
                ['Action', selected.action],
                ['Status', selected.status],
                ['Created', selected.createdAt],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-32 flex-shrink-0">{label}</span>
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
