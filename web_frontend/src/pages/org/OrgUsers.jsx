import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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

  const openAdd = () => {
    setForm({ name: '', email: '', phone: '', password: '', status: 'Active' })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({ name: row.name, email: row.email, phone: row.phone === '—' ? '' : row.phone, password: '', status: row.status })
    setModal('edit')
  }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'add') {
        await emsApi.createUser({
          fullName: form.name,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          role: 'USER',
        })
      } else {
        await emsApi.updateUser(selected.id, {
          fullName: form.name,
          email: form.email,
          phone: form.phone || undefined,
        })
        if (form.status !== selected.status) {
          await emsApi.updateUserStatus(selected.id, uiStatusToApi(form.status))
        }
      }
      showToast(modal === 'add' ? 'User created' : 'User updated', 'success')
      close()
      reload()
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
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)}><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)}><Trash2 size={14} /></button>
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
              <TextInput label="Password" type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            )}
            {modal === 'edit' && (
              <SelectInput label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={['Active', 'Inactive']} />
            )}
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
