import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapUser, mapOrganization } from '../../utils/mappers'
import { uiStatusToApi, uiRoleToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', email: '', password: '', phone: '', organizationId: '', role: 'Customer', status: 'Active' }

export default function AdminUsers() {
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const [usersRes, orgsRes] = await Promise.all([
      emsApi.getUsers({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    const orgs = list(orgsRes).map(mapOrganization)
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]))
    const rows = list(usersRes).map((u) => mapUser(u, orgMap[u.organizationId]))
    return { rows, orgs }
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
      email: row.email,
      password: '',
      phone: row.phone === '—' ? '' : row.phone,
      organizationId: row.organizationId ?? '',
      role: row.role,
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'add') {
        await emsApi.createUser({
          fullName: form.name,
          email: form.email,
          password: form.password,
          role: uiRoleToApi(form.role),
          organizationId: form.organizationId,
          phone: form.phone || undefined,
        })
      } else {
        await emsApi.updateUser(selected.id, {
          fullName: form.name,
          phone: form.phone || undefined,
          role: uiRoleToApi(form.role),
          status: uiStatusToApi(form.status),
          organizationId: form.organizationId,
        })
      }
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete user "${row.name}"?`)) return
    try {
      await emsApi.updateUserStatus(row.id, 'DELETED')
      showToast('User deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('User was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'org', label: 'Organization' },
    { key: 'role', label: 'Role', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'createdAt', label: 'Created' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Users</h2>
            <p className="breadcrumb">Admin / Users</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add User
          </button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
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
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Full Name" required placeholder="e.g. Miss Maryam"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <TextInput label="Phone Number" placeholder="+92-300-0000000"
                value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <TextInput label="Email Address" required type="email" placeholder="user@example.com"
              value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={modal === 'edit'} />
            {modal === 'add' && (
              <TextInput label="Password" required type="password" placeholder="Minimum 8 characters"
                value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            )}
            <SelectInput label="Organization" required
              value={form.organizationId} onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
              placeholder="Select organization"
              options={orgs.map((o) => ({ value: o.id, label: o.name }))} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Role" value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                options={['Super Admin', 'Org Admin', 'Customer']} />
              <SelectInput label="Status" value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                options={['Active', 'Inactive']} />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="User Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Name', selected.name],
                ['Email', selected.email],
                ['Phone', selected.phone],
                ['Organization', selected.org],
                ['Role', selected.role],
                ['Status', selected.status],
                ['Created At', selected.createdAt],
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
