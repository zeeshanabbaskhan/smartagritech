import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapGateway, mapOrganization } from '../../utils/mappers'
import { uiGatewayStatusToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', serial: '', model: 'CF-G200', organizationId: '', status: 'Online' }

export default function AdminGateways() {
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const [gatewaysRes, orgsRes] = await Promise.all([
      emsApi.getGateways({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    const orgs = list(orgsRes).map(mapOrganization)
    return { rows: list(gatewaysRes).map(mapGateway), orgs }
  }, [])

  const rows = data?.rows ?? []
  const orgs = data?.orgs ?? []

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      serial: row.serial,
      model: row.model === '—' ? 'CF-G200' : row.model,
      organizationId: row.organizationId ?? '',
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        serialNumber: form.serial,
        model: form.model,
        status: uiGatewayStatusToApi(form.status),
        organizationId: form.organizationId,
      }
      if (modal === 'add') await emsApi.createGateway(body)
      else await emsApi.updateGateway(selected.id, {
        name: body.name,
        serialNumber: body.serialNumber,
        model: body.model,
        status: body.status,
      })
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete gateway "${row.name}"?`)) return
    try {
      await emsApi.deleteGateway(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const columns = [
    { key: 'name', label: 'Gateway Name' },
    { key: 'serial', label: 'Serial Number', render: (v) => <span className="font-mono text-xs text-surface-400">{v}</span> },
    { key: 'model', label: 'Model' },
    { key: 'org', label: 'Organization' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
    { key: 'lastSeen', label: 'Last Seen' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Gateways</h2>
            <p className="breadcrumb">Admin / Gateways</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Gateway
          </button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search gateways..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Gateway' : 'Edit Gateway'}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Gateway Name" required placeholder="e.g. CF-GW-001"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <TextInput label="Serial Number" required placeholder="e.g. SN-10021"
                value={form.serial} onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))} />
            </div>
            <SelectInput label="Organization" required
              value={form.organizationId} onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
              placeholder="Select organization"
              options={orgs.map((o) => ({ value: o.id, label: o.name }))}
              disabled={modal === 'edit'} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Model" value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                options={['CF-G100', 'CF-G200', 'CF-G300']} />
              <SelectInput label="Status" value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                options={['Online', 'Offline']} />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Gateway Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Name', selected.name],
                ['Serial', selected.serial],
                ['Model', selected.model],
                ['Organization', selected.org],
                ['Status', selected.status],
                ['Last Seen', selected.lastSeen],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
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
