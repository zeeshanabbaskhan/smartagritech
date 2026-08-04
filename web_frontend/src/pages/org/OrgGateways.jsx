import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye, RefreshCw } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapGateway } from '../../utils/mappers'

export default function OrgGateways() {
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getGateways({ limit: 100 })).map(mapGateway),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [syncing, setSyncing] = useState(null)

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSync = async (row) => {
    setSyncing(row.id)
    try {
      await emsApi.getGateway(row.id)
      reload()
    } catch (_) {}
    setSyncing(null)
  }

  const columns = [
    { key: 'name', label: 'Gateway Name' },
    { key: 'serial', label: 'Serial Number', render: (v) => <span className="font-mono text-xs text-surface-400">{v}</span> },
    { key: 'model', label: 'Model' },
    { key: 'devices', label: 'Connected Devices', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">My Gateways</h2>
            <p className="breadcrumb">Organization / Gateways</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search gateways..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button
                type="button"
                className={`btn-ghost p-1.5 ${syncing === row.id ? 'text-primary-600' : 'text-info-600'}`}
                onClick={() => handleSync(row)}
                title="Sync"
              >
                <RefreshCw size={14} className={syncing === row.id ? 'animate-spin' : ''} />
              </button>
            </>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Gateway Details">
          {selected && (
            <div className="space-y-3">
              {[['Name', selected.name], ['Serial Number', selected.serial], ['Model', selected.model], ['Connected Devices', selected.devices], ['Status', selected.status], ['Organization', selected.org]].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-36 flex-shrink-0">{label}</span>
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
