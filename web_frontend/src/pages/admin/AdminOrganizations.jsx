import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, TextareaInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapOrganization } from '../../utils/mappers'
import { uiStatusToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

export default function AdminOrganizations() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getOrganizations({ limit: 100 })).map(mapOrganization),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', status: 'Active' })
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm({ name: '', description: '', status: 'Active' }); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({ name: row.name, description: row.description, status: row.status })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = { name: form.name, description: form.description, status: uiStatusToApi(form.status) }
      if (modal === 'add') await emsApi.createOrganization(body)
      else await emsApi.updateOrganization(selected.id, body)
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete organization "${row.name}"?`)) return
    try {
      await emsApi.deleteOrganization(row.id)
      showToast('Organization deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Organization was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Organization Name' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'createdAt', label: 'Created At' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Organizations</h2>
            <p className="breadcrumb">Admin / Organizations</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Organization
          </button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search organizations..."
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
          title={modal === 'add' ? 'Add Organization' : 'Edit Organization'}
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
              <TextInput label="Organization Name" required placeholder="e.g. CF Smart Technology" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <SelectInput label="Status" required value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={['Active', 'Inactive']} />
            </div>
            <TextareaInput label="Description" placeholder="Brief description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Organization Details">
          {selected && (
            <div className="space-y-3">
              {[['ID', selected.id], ['Name', selected.name], ['Description', selected.description], ['Status', selected.status], ['Theme', selected.theme], ['Created At', selected.createdAt]].map(([label, value]) => (
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
