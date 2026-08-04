import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Eye, List } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDeviceTemplate } from '../../utils/mappers'

export default function OrgDeviceTemplates() {
  const navigate = useNavigate()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getDeviceTemplates({ limit: 100 })).map(mapDeviceTemplate),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)

  const openView = (row) => {
    setSelected(row)
    setModal('view')
  }

  const close = () => {
    setModal(null)
    setSelected(null)
  }

  const columns = [
    { key: 'name', label: 'Template Name' },
    { key: 'variables', label: 'Variables Count', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'devices', label: 'Devices Using It', render: (v) => <span className="badge badge-neutral">{v}</span> },
    {
      key: 'method',
      label: 'Communication Method',
      render: (v) => (
        <span className={`badge ${v === 'Modbus TCP' ? 'badge-success' : 'badge-warning'}`}>{v}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Last Updated',
      render: (v) => <span className="text-xs text-surface-400">{v}</span>,
    },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Device Templates</h2>
            <p className="breadcrumb">Organization / Device Templates</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search templates..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View">
                <Eye size={14} />
              </button>
              <button
                type="button"
                className="btn-ghost p-1.5 text-info-600"
                onClick={() => navigate(`/org/device-templates/${row.id}/slaves`)}
                title="Slaves & Variables"
              >
                <List size={14} />
              </button>
            </>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Template Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Template Name', selected.name],
                ['Variables', selected.variables],
                ['Devices', selected.devices],
                ['Method', selected.method],
                ['Created', selected.createdAt],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
              <p className="text-xs text-surface-500 pt-2">
                Use the list icon to add slaves and register-address variables for MQTT mapping.
              </p>
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
