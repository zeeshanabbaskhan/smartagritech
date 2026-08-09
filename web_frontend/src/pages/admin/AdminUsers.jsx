import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import CredentialsModal from '../../components/ui/CredentialsModal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, LogIn, KeyRound } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapUser, mapOrganization } from '../../utils/mappers'
import { uiStatusToApi, uiRoleToApi } from '../../utils/apiForm'
import { ROLE_UI_LABELS, apiRoleToLabel } from '../../utils/roles'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

/** Roles assignable on create/edit (SUPER_ADMIN accounts are not modified here). */
const ASSIGNABLE_ROLES = [ROLE_UI_LABELS.ORG_ADMIN, ROLE_UI_LABELS.USER]

const blank = {
  name: '',
  email: '',
  password: '',
  phone: '',
  organizationId: '',
  role: ROLE_UI_LABELS.USER,
  status: 'Active',
  changePassword: false,
  newPassword: '',
  confirmPassword: '',
}

/** One-time temp password for sharing (never stored plaintext). */
const genTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
  let out = ''
  const arr = new Uint32Array(12)
  crypto.getRandomValues(arr)
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length]
  return out
}

export default function AdminUsers() {
  const { showToast } = useToast()
  const { impersonateUser } = useAuth()
  const navigate = useNavigate()
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
  const [credentials, setCredentials] = useState(null)
  const [loggingInId, setLoggingInId] = useState(null)

  const openAdd = () => {
    setForm({ ...blank, password: genTempPassword() })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      email: row.email,
      password: '',
      phone: row.phone === '—' ? '' : row.phone,
      organizationId: row.organizationId ?? '',
      role: row.role === ROLE_UI_LABELS.SUPER_ADMIN ? ROLE_UI_LABELS.SUPER_ADMIN : row.role,
      status: row.status,
      changePassword: false,
      newPassword: '',
      confirmPassword: '',
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null); setForm(blank) }

  const isSuperTarget = (row) => {
    const role = String(row?.roleRaw || row?._raw?.role || row?.role || '').toUpperCase()
    return role === 'SUPER_ADMIN' || role === 'ADMIN' || row?.role === ROLE_UI_LABELS.SUPER_ADMIN
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'add') {
        if (!form.password || form.password.length < 8) {
          showToast('Password must be at least 8 characters', 'error')
          return
        }
        const res = await emsApi.createUser({
          fullName: form.name,
          email: form.email,
          password: form.password,
          role: uiRoleToApi(form.role),
          organizationId: form.organizationId || undefined,
          phone: form.phone || undefined,
        })
        close()
        reload()
        setCredentials(
          res?.credentials || {
            email: form.email,
            password: form.password,
            role: uiRoleToApi(form.role),
          }
        )
        showToast('User created — share the login credentials', 'success')
      } else {
        if (isSuperTarget(selected)) {
          showToast('Cannot modify SUPER_ADMIN accounts', 'error')
          return
        }

        if (form.changePassword) {
          const next = form.newPassword.trim()
          if (next.length < 8) {
            showToast('New password must be at least 8 characters', 'error')
            return
          }
          if (next !== form.confirmPassword.trim()) {
            showToast('New password and confirmation do not match', 'error')
            return
          }
        }

        await emsApi.updateUser(selected.id, {
          fullName: form.name,
          phone: form.phone || undefined,
          role: uiRoleToApi(form.role),
          status: uiStatusToApi(form.status),
          organizationId: form.organizationId || null,
        })

        let creds = null
        if (form.changePassword) {
          const res = await emsApi.resetUserPassword(selected.id, form.newPassword.trim())
          creds = res?.credentials || {
            email: form.email || selected.email,
            password: form.newPassword.trim(),
            role: uiRoleToApi(form.role),
          }
        }

        close()
        reload()
        if (creds) {
          setCredentials(creds)
          showToast('User updated — share the new password', 'success')
        } else {
          showToast('User updated', 'success')
        }
      }
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (isSuperTarget(row)) {
      showToast('Cannot delete SUPER_ADMIN accounts', 'error')
      return
    }
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

  const canLoginAs = (row) => {
    const role = String(row.roleRaw || row._raw?.role || '').toUpperCase()
    const status = String(row.statusRaw || row._raw?.status || '').toUpperCase()
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return false
    if (status === 'INACTIVE' || status === 'DELETED') return false
    if (row.status === 'Inactive') return false
    return true
  }

  const handleLoginAs = async (row) => {
    if (!canLoginAs(row)) {
      showToast('Cannot login as this account', 'error')
      return
    }
    if (!confirm(`Login as "${row.name}" (${row.role})?`)) return
    setLoggingInId(row.id)
    try {
      const session = await impersonateUser(row.id)
      showToast(`Logged in as ${session.name}`, 'success')
      navigate(`/${session.role}`)
    } catch (e) {
      showToast(e.message || 'Login failed', 'error')
    } finally {
      setLoggingInId(null)
    }
  }

  const enableChangePassword = () => {
    const generated = genTempPassword()
    setForm((f) => ({
      ...f,
      changePassword: true,
      newPassword: generated,
      confirmPassword: generated,
    }))
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'org', label: 'Organization' },
    { key: 'role', label: 'Role', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'createdAt', label: 'Created' },
  ]

  const editRoleOptions = isSuperTarget(selected)
    ? [ROLE_UI_LABELS.SUPER_ADMIN]
    : ASSIGNABLE_ROLES

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
              <span className="inline-flex w-7 shrink-0 justify-center">
                {canLoginAs(row) ? (
                  <button
                    type="button"
                    className="btn-ghost p-1.5 text-primary-600"
                    onClick={() => handleLoginAs(row)}
                    title="Login as this user"
                    disabled={loggingInId === row.id}
                  >
                    <LogIn size={14} className={loggingInId === row.id ? 'animate-pulse' : ''} />
                  </button>
                ) : (
                  <span className="invisible select-none p-1.5 inline-flex" aria-hidden>
                    <LogIn size={14} />
                  </span>
                )}
              </span>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <p className="text-xs text-surface-500 mt-3">
          <LogIn size={11} className="inline mr-1 text-primary-600" />
          Use the login icon to open that user&apos;s portal as Super Admin.
        </p>

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add User' : 'Edit User'}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || (modal === 'edit' && isSuperTarget(selected))}
              >
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Full Name" required placeholder="e.g. Miss Maryam"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={modal === 'edit' && isSuperTarget(selected)} />
              <TextInput label="Phone Number" placeholder="+92-300-0000000"
                value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                disabled={modal === 'edit' && isSuperTarget(selected)} />
            </div>
            <TextInput label="Email Address" required type="email" placeholder="user@example.com"
              value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={modal === 'edit'} />

            {modal === 'add' && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <TextInput
                    label="Password"
                    required
                    type="text"
                    placeholder="Minimum 8 characters — shown after create for sharing"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary mb-0.5"
                  onClick={() => setForm((f) => ({ ...f, password: genTempPassword() }))}
                >
                  Generate
                </button>
              </div>
            )}

            <SelectInput
              label="Organization"
              required={modal === 'add'}
              value={form.organizationId}
              onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
              placeholder="Select organization"
              options={orgs.map((o) => ({ value: o.id, label: o.name }))}
              disabled={modal === 'edit' && isSuperTarget(selected)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput
                label="Role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                options={modal === 'add' ? ASSIGNABLE_ROLES : editRoleOptions}
                disabled={modal === 'edit' && isSuperTarget(selected)}
              />
              <SelectInput
                label="Status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                options={['Active', 'Inactive']}
                disabled={modal === 'edit' && isSuperTarget(selected)}
              />
            </div>

            {modal === 'edit' && !isSuperTarget(selected) && (
              <div className="pt-3 border-t border-surface-200 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-surface-800 uppercase tracking-wide flex items-center gap-1.5">
                      <KeyRound size={13} className="text-primary-600" />
                      Change password
                    </h4>
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      Passwords are hashed and cannot be retrieved. A new password is shown once after save.
                    </p>
                  </div>
                  {!form.changePassword ? (
                    <button type="button" className="btn-secondary flex-shrink-0" onClick={enableChangePassword}>
                      Set new password
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost flex-shrink-0 text-xs"
                      onClick={() => setForm((f) => ({
                        ...f,
                        changePassword: false,
                        newPassword: '',
                        confirmPassword: '',
                      }))}
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {form.changePassword && (
                  <>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <TextInput
                          label="New password"
                          required
                          type="text"
                          placeholder="Minimum 8 characters"
                          value={form.newPassword}
                          onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-secondary mb-0.5"
                        onClick={() => {
                          const generated = genTempPassword()
                          setForm((f) => ({
                            ...f,
                            newPassword: generated,
                            confirmPassword: generated,
                          }))
                        }}
                      >
                        Generate
                      </button>
                    </div>
                    <TextInput
                      label="Confirm new password"
                      required
                      type="text"
                      placeholder="Re-enter new password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    />
                  </>
                )}
              </div>
            )}

            {modal === 'edit' && isSuperTarget(selected) && (
              <p className="text-[11px] text-surface-400 pt-2 border-t border-surface-100">
                SUPER_ADMIN accounts cannot be edited from this screen.
              </p>
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
              <p className="text-[11px] text-surface-400 pt-2 border-t border-surface-100">
                Password is not stored in plaintext. Use Edit → Change password to issue a new one — credentials are shown once after create/reset.
              </p>
            </div>
          )}
        </Modal>

        <CredentialsModal
          open={Boolean(credentials)}
          onClose={() => setCredentials(null)}
          title="User portal credentials"
          subtitle="Give these to the user so they can access their portal. Copy now — the password is not shown again."
          email={credentials?.email}
          password={credentials?.password}
          extraFields={credentials?.role ? [['Role', apiRoleToLabel(credentials.role) || credentials.role]] : []}
        />
      </div>
    </PageState>
  )
}
