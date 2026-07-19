import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import CredentialsModal from '../../components/ui/CredentialsModal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapUser } from '../../utils/mappers'
import { uiStatusToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

export default function OrgUsers() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getUsers({ limit: 100 })).map((u) => mapUser(u)),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', status: 'Active' })
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState(null)

  const openAdd = () => {
    setForm({ name: '', email: '', phone: '', password: '', status: 'Active' })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({ name: row.name, email: row.email, phone: row.phone === '—' ? '' : row.phone, password: '', status: row.status })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'add') {
        const res = await emsApi.createUser({
          fullName: form.name,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          role: 'USER',
        })
        close()
        reload()
        setCredentials(res?.credentials || { email: form.email, password: form.password, role: 'USER' })
        showToast('User created — share the login credentials', 'success')
      } else {
        await emsApi.updateUser(selected.id, {
          fullName: form.name,
          email: form.email,
          phone: form.phone || undefined,
        })
        if (form.status !== selected.status) {
          await emsApi.updateUserStatus(selected.id, uiStatusToApi(form.status))
        }
        showToast('User updated', 'success')
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
    if (!confirm(`Deactivate user "${row.name}"?`)) return
    try {
      await emsApi.updateUserStatus(row.id, 'DELETED')
      showToast('User deactivated', 'success')
    } catch (e) {
      if (e.status === 404) showToast('User was already removed', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'createdAt', label: 'Created' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Team Users</h2>
            <p className="breadcrumb">Organization / Users</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add User</button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search users..."
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
          title={modal === 'add' ? 'Add User' : 'Edit User'}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <TextInput label="Full Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextInput label="Email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <TextInput label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            {modal === 'add' && (
              <TextInput
                label="Password"
                type="text"
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Shown after create for sharing with the user"
              />
            )}
            {modal === 'edit' && (
              <SelectInput label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={['Active', 'Inactive']} />
            )}
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="User Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Name', selected.name],
                ['Email', selected.email],
                ['Phone', selected.phone],
                ['Status', selected.status],
                ['Created At', selected.createdAt],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
              <p className="text-[11px] text-surface-400 pt-2 border-t border-surface-100">
                Password is not stored in plaintext. Credentials are shown once right after create.
              </p>
            </div>
          )}
        </Modal>

        <CredentialsModal
          open={Boolean(credentials)}
          onClose={() => setCredentials(null)}
          title="User portal credentials"
          subtitle="Give these to the team member so they can sign in to the User portal."
          email={credentials?.email}
          password={credentials?.password}
          extraFields={[['Role', credentials?.role || 'USER']]}
        />
      </div>
    </PageState>
  )
}
