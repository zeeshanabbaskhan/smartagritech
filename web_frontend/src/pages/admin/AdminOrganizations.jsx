import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import CredentialsModal from '../../components/ui/CredentialsModal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, TextareaInput, SelectInput } from '../../components/ui/FormFields'
import HierarchyEditor from '../../components/facility/HierarchyEditor'
import { Plus, Pencil, Trash2, Eye, LogIn, ListTree, Building2, Sparkles, KeyRound, UserMinus, Users } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapOrganization, mapUser } from '../../utils/mappers'
import { mapTreeFromApi, flattenTreeForApi } from '../../data/facilitiesHierarchy'
import { uiStatusToApi } from '../../utils/apiForm'
import { ROLE_UI_LABELS, apiRoleToLabel } from '../../utils/roles'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const blank = {
  name: '',
  description: '',
  status: 'Active',
  adminFullName: '',
  adminEmail: '',
  adminPassword: '',
  adminPhone: '',
}

const MEMBER_ROLE_OPTIONS = [ROLE_UI_LABELS.ORG_ADMIN, ROLE_UI_LABELS.USER]

const blankMember = {
  mode: 'create', // 'create' | 'assign'
  fullName: '',
  email: '',
  password: '',
  phone: '',
  role: ROLE_UI_LABELS.USER,
  existingUserId: '',
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

export default function AdminOrganizations() {
  const { showToast } = useToast()
  const { impersonateOrganization } = useAuth()
  const navigate = useNavigate()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getOrganizations({ limit: 100 })).map(mapOrganization),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState(null)
  const [loggingInId, setLoggingInId] = useState(null)

  // Facility Structure (per-org) — SUPER_ADMIN can scope by organizationId
  const [hierarchyMode, setHierarchyMode] = useState('auto') // 'auto' | 'manual'
  const [hierarchyTree, setHierarchyTree] = useState([])
  const [hierarchyLoading, setHierarchyLoading] = useState(false)

  // Members (edit / view)
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberForm, setMemberForm] = useState(blankMember)
  const [memberSaving, setMemberSaving] = useState(false)
  const [assignCandidates, setAssignCandidates] = useState([])

  // Password reset modal (replaces window.prompt)
  const [passwordResetMember, setPasswordResetMember] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)

  const loadMembers = async (organizationId) => {
    if (!organizationId) {
      setMembers([])
      return
    }
    setMembersLoading(true)
    try {
      const res = await emsApi.getUsers({ organizationId, limit: 200 })
      setMembers(list(res).map((u) => mapUser(u)))
    } catch (_) {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  const loadAssignCandidates = async (organizationId) => {
    try {
      const res = await emsApi.getUsers({ limit: 200 })
      const all = list(res)
      setAssignCandidates(
        all
          .filter((u) => {
            const role = String(u.role || '').toUpperCase()
            if (role === 'SUPER_ADMIN' || role === 'ADMIN') return false
            return u.organizationId !== organizationId
          })
          .map((u) => mapUser(u))
      )
    } catch (_) {
      setAssignCandidates([])
    }
  }

  const openAdd = () => {
    setForm(blank)
    setHierarchyMode('auto')
    setHierarchyTree([])
    setMembers([])
    setMemberForm(blankMember)
    setModal('add')
  }
  const openEdit = async (row) => {
    setSelected(row)
    setForm({ ...blank, name: row.name, description: row.description, status: row.status })
    setHierarchyMode('auto')
    setHierarchyTree([])
    setMemberForm({ ...blankMember, password: genTempPassword() })
    setModal('edit')
    setHierarchyLoading(true)
    loadMembers(row.id)
    loadAssignCandidates(row.id)
    try {
      const res = await emsApi.getFacilityTree({ organizationId: row.id })
      const tree = mapTreeFromApi(Array.isArray(res?.data) ? res.data : [])
      setHierarchyTree(tree)
      if (tree.length) setHierarchyMode('manual')
    } catch (_) {
      setHierarchyTree([])
    } finally {
      setHierarchyLoading(false)
    }
  }
  const openView = async (row) => {
    setSelected(row)
    setModal('view')
    await loadMembers(row.id)
  }
  const close = () => {
    setModal(null)
    setSelected(null)
    setMembers([])
    setMemberForm(blankMember)
  }

  const saveHierarchyFor = async (organizationId) => {
    if (!organizationId || hierarchyMode !== 'manual') return
    try {
      await emsApi.replaceFacilityTree({ organizationId, nodes: flattenTreeForApi(hierarchyTree) })
    } catch (e) {
      showToast(e.message || 'Organization saved, but facility structure failed', 'error')
    }
  }

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
        const newOrgId = res?.data?.id ?? res?.id
        await saveHierarchyFor(newOrgId)
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
        await saveHierarchyFor(selected.id)
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

  const handleLoginAs = async (row) => {
    if (!confirm(`Login as Org Admin for "${row.name}"?`)) return
    setLoggingInId(row.id)
    try {
      const session = await impersonateOrganization(row.id)
      showToast(`Logged in as ${row.name}`, 'success')
      navigate(`/${session.role}`)
    } catch (e) {
      showToast(e.message || 'Login failed', 'error')
    } finally {
      setLoggingInId(null)
    }
  }

  const roleToApi = (label) => (
    label === ROLE_UI_LABELS.ORG_ADMIN ? 'ORG_ADMIN' : 'USER'
  )

  const handleAddMember = async () => {
    if (!selected?.id) return
    setMemberSaving(true)
    try {
      if (memberForm.mode === 'assign') {
        if (!memberForm.existingUserId) {
          showToast('Select a user to assign', 'error')
          return
        }
        await emsApi.updateUser(memberForm.existingUserId, {
          organizationId: selected.id,
          role: roleToApi(memberForm.role),
        })
        showToast('User assigned to organization', 'success')
      } else {
        if (!memberForm.email?.trim() || !memberForm.password || !memberForm.fullName?.trim()) {
          showToast('Name, email, and password are required', 'error')
          return
        }
        if (memberForm.password.length < 8) {
          showToast('Password must be at least 8 characters', 'error')
          return
        }
        const res = await emsApi.createUser({
          fullName: memberForm.fullName.trim(),
          email: memberForm.email.trim(),
          password: memberForm.password,
          phone: memberForm.phone || undefined,
          role: roleToApi(memberForm.role),
          organizationId: selected.id,
        })
        setCredentials(
          res?.credentials || {
            email: memberForm.email.trim(),
            password: memberForm.password,
            role: roleToApi(memberForm.role),
            organizationName: selected.name,
          }
        )
        showToast('Member created — share login credentials', 'success')
      }
      setMemberForm({ ...blankMember, password: genTempPassword() })
      await loadMembers(selected.id)
      await loadAssignCandidates(selected.id)
    } catch (e) {
      showToast(e.message || 'Could not add member', 'error')
    } finally {
      setMemberSaving(false)
    }
  }

  const handleChangeMemberRole = async (member, nextLabel) => {
    try {
      await emsApi.updateUser(member.id, { role: roleToApi(nextLabel) })
      showToast(`Role updated to ${nextLabel}`, 'success')
      await loadMembers(selected.id)
    } catch (e) {
      showToast(e.message || 'Role update failed', 'error')
    }
  }

  const handleRemoveMember = async (member) => {
    if (!confirm(`Remove "${member.name}" from this organization?`)) return
    try {
      await emsApi.updateUser(member.id, { organizationId: null })
      showToast('Member removed from organization', 'success')
      await loadMembers(selected.id)
      await loadAssignCandidates(selected.id)
    } catch (e) {
      showToast(e.message || 'Remove failed', 'error')
    }
  }

  const openResetMemberPassword = (member) => {
    setPasswordResetMember(member)
    setResetPassword('')
  }

  const closeResetMemberPassword = () => {
    if (resetSaving) return
    setPasswordResetMember(null)
    setResetPassword('')
  }

  const submitResetMemberPassword = async () => {
    if (!passwordResetMember) return
    const password = resetPassword.trim() || genTempPassword()
    if (password.length < 8) {
      showToast('Password must be at least 8 characters', 'error')
      return
    }
    setResetSaving(true)
    try {
      const res = await emsApi.resetUserPassword(passwordResetMember.id, password)
      setPasswordResetMember(null)
      setResetPassword('')
      setCredentials(
        res?.credentials || {
          email: passwordResetMember.email,
          password,
          role: passwordResetMember.roleRaw || roleToApi(passwordResetMember.role),
          organizationName: selected?.name,
        }
      )
      showToast('Password reset — share the new credentials', 'success')
    } catch (e) {
      showToast(e.message || 'Password reset failed', 'error')
    } finally {
      setResetSaving(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Organization Name' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'createdAt', label: 'Created At' },
  ]

  const membersPanel = (
    <div className="pt-4 border-t border-surface-200 space-y-3">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-primary-600" />
        <h4 className="text-xs font-bold text-surface-800 uppercase tracking-wide">Organization members</h4>
      </div>
      <p className="text-[11px] text-surface-400">
        Passwords are hashed and cannot be retrieved later. New or reset passwords are shown once in a credentials dialog.
      </p>

      {membersLoading ? (
        <p className="text-xs text-surface-400">Loading members…</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-surface-500">No members yet.</p>
      ) : (
        <div className="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-50 dark:bg-surface-800/60 text-surface-500 uppercase tracking-wide">
              <tr>
                <th className="text-left font-bold px-3 py-2">Name</th>
                <th className="text-left font-bold px-3 py-2">Email</th>
                <th className="text-left font-bold px-3 py-2">Role</th>
                {modal === 'edit' && <th className="text-right font-bold px-3 py-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-surface-100 dark:border-surface-700">
                  <td className="px-3 py-2 text-surface-800 dark:text-surface-200">{m.name}</td>
                  <td className="px-3 py-2 font-mono text-surface-700 dark:text-surface-300">{m.email}</td>
                  <td className="px-3 py-2">
                    {modal === 'edit' ? (
                      <select
                        className="text-xs rounded border border-surface-200 dark:border-surface-600 bg-transparent px-1.5 py-1"
                        value={m.role}
                        onChange={(e) => handleChangeMemberRole(m, e.target.value)}
                      >
                        {MEMBER_ROLE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge badge-info">{m.role}</span>
                    )}
                  </td>
                  {modal === 'edit' && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <button
                          type="button"
                          className="btn-ghost p-1.5 text-primary-600"
                          title="Reset password (shown once)"
                          onClick={() => openResetMemberPassword(m)}
                        >
                          <KeyRound size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost p-1.5 text-danger-600"
                          title="Remove from organization"
                          onClick={() => handleRemoveMember(m)}
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'edit' && (
        <div className="space-y-3 p-3 rounded-lg border border-dashed border-surface-300 dark:border-surface-600">
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 text-xs font-bold py-1.5 rounded-md border ${memberForm.mode === 'create' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30' : 'border-surface-200 text-surface-600'}`}
              onClick={() => setMemberForm((f) => ({ ...blankMember, mode: 'create', password: f.password || genTempPassword() }))}
            >
              Create new user
            </button>
            <button
              type="button"
              className={`flex-1 text-xs font-bold py-1.5 rounded-md border ${memberForm.mode === 'assign' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/30' : 'border-surface-200 text-surface-600'}`}
              onClick={() => setMemberForm((f) => ({ ...f, mode: 'assign' }))}
            >
              Assign existing
            </button>
          </div>

          {memberForm.mode === 'create' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput
                  label="Full name"
                  required
                  value={memberForm.fullName}
                  onChange={(e) => setMemberForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="e.g. Site Operator"
                />
                <TextInput
                  label="Phone"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+92-300-0000000"
                />
              </div>
              <TextInput
                label="Email"
                type="email"
                required
                value={memberForm.email}
                onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@company.com"
              />
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <TextInput
                    label="Default password"
                    type="text"
                    required
                    value={memberForm.password}
                    onChange={(e) => setMemberForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Shown once after create"
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary mb-0.5"
                  onClick={() => setMemberForm((f) => ({ ...f, password: genTempPassword() }))}
                >
                  Generate
                </button>
              </div>
            </>
          ) : (
            <SelectInput
              label="Existing user"
              required
              placeholder="Select user not in this org"
              value={memberForm.existingUserId}
              onChange={(e) => setMemberForm((f) => ({ ...f, existingUserId: e.target.value }))}
              options={assignCandidates.map((u) => ({
                value: u.id,
                label: `${u.name} · ${u.email}${u.org && u.org !== '—' ? ` (${u.org})` : ''}`,
              }))}
            />
          )}

          <SelectInput
            label="Role in this organization"
            value={memberForm.role}
            onChange={(e) => setMemberForm((f) => ({ ...f, role: e.target.value }))}
            options={MEMBER_ROLE_OPTIONS}
          />

          <button
            type="button"
            className="btn-primary w-full"
            disabled={memberSaving}
            onClick={handleAddMember}
          >
            {memberSaving ? 'Saving…' : memberForm.mode === 'assign' ? 'Assign to organization' : 'Create & add member'}
          </button>
        </div>
      )}
    </div>
  )

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
              <button
                type="button"
                className="btn-ghost p-1.5 text-primary-600"
                onClick={() => handleLoginAs(row)}
                title="Login as Org Admin"
                disabled={loggingInId === row.id || row.status === 'Inactive'}
              >
                <LogIn size={14} className={loggingInId === row.id ? 'animate-pulse' : ''} />
              </button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <p className="text-xs text-surface-500 mt-3">
          <LogIn size={11} className="inline mr-1 text-primary-600" />
          Use the login icon in Actions to open that organization&apos;s Org Admin portal.
        </p>

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Organization' : 'Edit Organization'}
          size="xl"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
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

            {modal === 'edit' && membersPanel}

            <div className="pt-4 border-t border-surface-200">
              <div className="flex items-center gap-2 mb-1.5">
                <ListTree size={14} className="text-primary-600" />
                <label className="text-xs font-bold text-surface-800 dark:text-surface-200 uppercase tracking-wide">Facility Structure</label>
              </div>
              <p className="text-xs text-surface-500 mb-3">
                Set up buildings, floors, and departments so this organization&apos;s Custom Dashboards can drill down building-wise, floor-wise, and department-wise. Choose auto to leave the existing structure untouched.
              </p>

              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setHierarchyMode('auto')}
                  className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border text-left ${hierarchyMode === 'auto' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30' : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'}`}
                >
                  <Sparkles size={14} className={hierarchyMode === 'auto' ? 'text-primary-600' : 'text-surface-400'} />
                  <span className="text-xs font-bold text-surface-700 dark:text-surface-300">Leave as-is</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHierarchyMode('manual')}
                  className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border text-left ${hierarchyMode === 'manual' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30' : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'}`}
                >
                  <Building2 size={14} className={hierarchyMode === 'manual' ? 'text-primary-600' : 'text-surface-400'} />
                  <span className="text-xs font-bold text-surface-700 dark:text-surface-300">Set this up now</span>
                </button>
              </div>

              {hierarchyLoading ? (
                <p className="text-xs text-surface-400">Loading facility structure…</p>
              ) : hierarchyMode === 'manual' && (
                <HierarchyEditor buildings={hierarchyTree} onChange={setHierarchyTree} orgName={form.name} />
              )}
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Organization Details" size="lg">
          {selected && (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {[['ID', selected.id], ['Name', selected.name], ['Description', selected.description], ['Status', selected.status], ['Theme', selected.theme], ['Created At', selected.createdAt]].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
              {membersPanel}
              <p className="text-[11px] text-surface-400 pt-2 border-t border-surface-100">
                Passwords are never stored in plaintext. Use Edit → reset password to issue a new one-time credential.
              </p>
            </div>
          )}
        </Modal>

        <Modal
          open={Boolean(passwordResetMember)}
          onClose={closeResetMemberPassword}
          title="Reset password"
          size="md"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={closeResetMemberPassword} disabled={resetSaving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitResetMemberPassword} disabled={resetSaving}>
                {resetSaving ? 'Resetting…' : 'Reset password'}
              </button>
            </>
          }
        >
          {passwordResetMember && (
            <div className="space-y-4">
              <div className="space-y-1 text-xs">
                <div className="flex gap-4">
                  <span className="text-surface-500 w-20 flex-shrink-0">Email</span>
                  <span className="font-semibold text-surface-800 dark:text-surface-100">{passwordResetMember.email}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-surface-500 w-20 flex-shrink-0">Name</span>
                  <span className="text-surface-800 dark:text-surface-200">{passwordResetMember.name}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-surface-500 w-20 flex-shrink-0">Role</span>
                  <span className="text-surface-800 dark:text-surface-200">{passwordResetMember.role}</span>
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <TextInput
                    label="Password"
                    type="text"
                    placeholder="leave blank to auto-generate"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary mb-0.5"
                  onClick={() => setResetPassword(genTempPassword())}
                  disabled={resetSaving}
                >
                  Generate
                </button>
              </div>
              <p className="text-[11px] text-surface-400">
                If filled, password must be at least 8 characters. The new password is shown once after reset.
              </p>
            </div>
          )}
        </Modal>

        <CredentialsModal
          open={Boolean(credentials)}
          onClose={() => setCredentials(null)}
          title="Portal login credentials"
          subtitle="Give these to the user so they can sign in. Copy now — the password is shown only once and cannot be retrieved later."
          email={credentials?.email}
          password={credentials?.password}
          extraFields={[
            ...(credentials?.organizationName ? [['Organization', credentials.organizationName]] : []),
            ...(credentials?.role ? [['Role', apiRoleToLabel(credentials.role) || credentials.role]] : []),
          ]}
        />
      </div>
    </PageState>
  )
}
