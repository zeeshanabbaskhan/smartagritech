import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import CredentialsModal from '../../components/ui/CredentialsModal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, TextareaInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapOrganization } from '../../utils/mappers'
import { uiStatusToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blank = {
  name: '',
  description: '',
  status: 'Active',
  adminFullName: '',
  adminEmail: '',
  adminPassword: '',
  adminPhone: '',
}

export default function AdminOrganizations() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getOrganizations({ limit: 100 })).map(mapOrganization),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState(null)

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({ ...blank, name: row.name, description: row.description, status: row.status })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'add') {
        const body = {
          name: form.name,
          description: form.description,
          status: uiStatusToApi(form.status),
        }
        if (form.adminEmail?.trim() || form.adminPassword) {
          body.adminFullName = form.adminFullName || undefined
          body.adminEmail = form.adminEmail
          body.adminPassword = form.adminPassword
          body.adminPhone = form.adminPhone || undefined
        }
        const res = await emsApi.createOrganization(body)
        close()
        reload()
        if (res?.credentials) {
          setCredentials(res.credentials)
          showToast('Organization created — share org admin credentials', 'success')
        } else {
          showToast('Organization created', 'success')
        }
      } else {
        await emsApi.updateOrganization(selected.id, {
          name: form.name,
          description: form.description,
          status: uiStatusToApi(form.status),
        })
        showToast('Organization updated', 'success')
        close()
        reload()
      }
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
          size={modal === 'add' ? 'lg' : 'md'}
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

            {modal === 'add' && (
              <div className="pt-3 border-t border-surface-200 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-surface-800 uppercase tracking-wide">Org Admin login (optional)</h4>
                  <p className="text-[11px] text-surface-400 mt-0.5">
                    Create an Org Admin for this organization. Email and password will be shown once after create so you can hand them over.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextInput
                    label="Admin full name"
                    placeholder="e.g. Site Admin"
                    value={form.adminFullName}
                    onChange={(e) => setForm((f) => ({ ...f, adminFullName: e.target.value }))}
                  />
                  <TextInput
                    label="Admin phone"
                    placeholder="+92-300-0000000"
                    value={form.adminPhone}
                    onChange={(e) => setForm((f) => ({ ...f, adminPhone: e.target.value }))}
                  />
                </div>
                <TextInput
                  label="Admin email"
                  type="email"
                  placeholder="admin@company.com"
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                />
                <TextInput
                  label="Admin password"
                  type="text"
                  placeholder="Minimum 8 characters"
                  value={form.adminPassword}
                  onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                />
              </div>
            )}
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
              <p className="text-[11px] text-surface-400 pt-2 border-t border-surface-100">
                Org Admin passwords are only shown once at creation. Manage admins under Users if needed.
              </p>
            </div>
          )}
        </Modal>

        <CredentialsModal
          open={Boolean(credentials)}
          onClose={() => setCredentials(null)}
          title="Organization admin credentials"
          subtitle="Give these to the organization admin so they can access the Org portal."
          email={credentials?.email}
          password={credentials?.password}
          extraFields={[
            ...(credentials?.organizationName ? [['Organization', credentials.organizationName]] : []),
            ...(credentials?.role ? [['Role', credentials.role]] : []),
          ]}
        />
      </div>
    </PageState>
  )
}
