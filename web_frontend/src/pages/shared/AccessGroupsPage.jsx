import { useMemo, useState } from 'react'
import { ShieldCheck, Plus, Pencil, Trash2, Cpu, Users } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapUser, mapOrganization } from '../../utils/mappers'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const EMPTY = { name: '', organizationId: '', deviceIds: [], userIds: [] }

function fmtDate(d) {
  if (!d) return '—'
  const s = typeof d === 'string' ? d : d.toISOString?.() ?? String(d)
  return s.length > 16 ? s.slice(0, 16).replace('T', ' ') : s
}

/**
 * Shared Access Groups CRUD for admin + org.
 * @param {{ scope?: 'admin' | 'org' }} props
 */
export default function AccessGroupsPage({ scope = 'admin' }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const isAdmin = scope === 'admin' || user?.role === 'admin'
  const [orgFilter, setOrgFilter] = useState('')

  const { data, loading, error, reload } = useFetch(async () => {
    const orgParams = isAdmin && orgFilter ? { organizationId: orgFilter } : {}
    const [groupsRes, devicesRes, usersRes, orgsRes] = await Promise.all([
      emsApi.getAccessGroups({ limit: 100, ...orgParams }),
      emsApi.getDevices({ limit: 200, ...orgParams }),
      emsApi.getUsers({ limit: 200, ...orgParams }),
      isAdmin ? emsApi.getOrganizations({ limit: 100 }) : Promise.resolve({ data: [] }),
    ])
    const orgs = list(orgsRes).map(mapOrganization)
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]))
    const devices = list(devicesRes).map(mapDevice)
    const users = list(usersRes).map((u) => mapUser(u, orgMap[u.organizationId] || u.organization?.name))
    const groups = list(groupsRes).map((g) => ({
      id: g.id,
      name: g.name,
      organizationId: g.organizationId,
      org: orgMap[g.organizationId] || g.organization?.name || '—',
      deviceIds: g.deviceIds || [],
      userIds: g.userIds || [],
      createdBy: g.createdByRole === 'SUPER_ADMIN' ? 'Admin' : g.createdByRole ? 'Organization' : '—',
      createdAt: fmtDate(g.createdAt),
      _raw: g,
    }))
    return { groups, devices, users, orgs }
  }, [isAdmin, orgFilter])

  const groups = data?.groups ?? []
  const devices = data?.devices ?? []
  const users = data?.users ?? []
  const orgs = data?.orgs ?? []

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const orgDevices = useMemo(() => {
    const oid = form.organizationId || user?.organizationId
    if (!oid) return devices
    return devices.filter((d) => d.organizationId === oid)
  }, [devices, form.organizationId, user?.organizationId])

  const orgUsers = useMemo(() => {
    const oid = form.organizationId || user?.organizationId
    if (!oid) return users
    return users.filter((u) => u.organizationId === oid)
  }, [users, form.organizationId, user?.organizationId])

  const openCreate = () => {
    setForm({
      ...EMPTY,
      organizationId: isAdmin ? (orgFilter || orgs[0]?.id || '') : (user?.organizationId || ''),
    })
    setSelected(null)
    setModal('create')
  }

  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      organizationId: row.organizationId,
      deviceIds: [...(row.deviceIds || [])],
      userIds: [...(row.userIds || [])],
    })
    setModal('edit')
  }

  const close = () => { setModal(null); setSelected(null); setForm(EMPTY) }

  const toggleDevice = (id) => {
    setForm((prev) => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(id)
        ? prev.deviceIds.filter((x) => x !== id)
        : [...prev.deviceIds, id],
    }))
  }

  const toggleUser = (id) => {
    setForm((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(id)
        ? prev.userIds.filter((x) => x !== id)
        : [...prev.userIds, id],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    const organizationId = isAdmin ? form.organizationId : user?.organizationId
    if (isAdmin && !organizationId) {
      showToast('Select an organization', 'error')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        organizationId,
        deviceIds: form.deviceIds,
        userIds: form.userIds,
      }
      if (modal === 'create') await emsApi.createAccessGroup(body)
      else await emsApi.updateAccessGroup(selected.id, body)
      showToast(modal === 'create' ? 'Access group created' : 'Access group updated', 'success')
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await emsApi.deleteAccessGroup(deleteTarget.id)
      showToast('Access group deleted', 'success')
      setDeleteTarget(null)
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Group Name' },
    ...(isAdmin ? [{ key: 'org', label: 'Organization' }] : []),
    {
      key: 'deviceIds',
      label: 'Devices',
      render: (ids) => (
        <span className="badge badge-neutral">{ids?.length || 0} device{(ids?.length || 0) !== 1 ? 's' : ''}</span>
      ),
    },
    {
      key: 'userIds',
      label: 'Users',
      render: (ids) => (
        <span className="badge badge-info">{ids?.length || 0} user{(ids?.length || 0) !== 1 ? 's' : ''}</span>
      ),
    },
    ...(isAdmin ? [{ key: 'createdBy', label: 'Created By', render: (v) => <span className="badge badge-neutral">{v}</span> }] : []),
    { key: 'createdAt', label: 'Created At' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-xl">
              <ShieldCheck size={20} className="text-primary-600" />
            </div>
            <div>
              <h2 className="page-title">Access Groups</h2>
              <p className="breadcrumb">
                {isAdmin ? 'Admin / Access Groups' : 'Organization / Access Groups'}
              </p>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={15} /> Create Group
          </button>
        </div>

        {isAdmin && (
          <div className="card p-3 mb-4 flex items-center gap-2">
            <span className="text-xs font-bold text-surface-500 uppercase">Organization</span>
            <select
              className="select text-xs py-1.5 px-2 w-auto"
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
            >
              <option value="">All organizations</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        <DataTable
          columns={columns}
          data={groups}
          searchPlaceholder="Search groups..."
          emptyMessage="No access groups yet. Create one to get started."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit">
                <Pencil size={14} />
              </button>
              <button type="button" className="btn-danger p-1.5" onClick={() => setDeleteTarget(row)} title="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
        />

        <Modal
          open={modal === 'create' || modal === 'edit'}
          onClose={close}
          title={modal === 'create' ? 'Create Access Group' : 'Edit Access Group'}
          size="md"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || (isAdmin && !form.organizationId)}
              >
                {saving ? 'Saving...' : modal === 'create' ? 'Create Group' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <TextInput
              label="Group Name"
              required
              placeholder="e.g. Production Floor"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {isAdmin && (
              <SelectInput
                label="Organization"
                required
                value={form.organizationId}
                onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value, deviceIds: [], userIds: [] }))}
                options={[
                  { value: '', label: 'Select organization…' },
                  ...orgs.map((o) => ({ value: o.id, label: o.name })),
                ]}
              />
            )}

            {(form.organizationId || !isAdmin) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Assign Devices
                    <span className="ml-1 text-surface-400 font-normal">({form.deviceIds.length})</span>
                  </label>
                  {orgDevices.length === 0 ? (
                    <p className="text-xs text-surface-400 p-3 bg-surface-50 rounded-lg">No devices found.</p>
                  ) : (
                    <div className="border border-surface-200 rounded-xl overflow-hidden divide-y divide-surface-100 max-h-48 overflow-y-auto">
                      {orgDevices.map((d) => (
                        <label key={d.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-50">
                          <input
                            type="checkbox"
                            className="rounded border-surface-300 text-primary-600"
                            checked={form.deviceIds.includes(d.id)}
                            onChange={() => toggleDevice(d.id)}
                          />
                          <Cpu size={13} className="text-surface-400 flex-shrink-0" />
                          <span className="text-sm text-surface-800 flex-1">{d.name}</span>
                          <span className={`badge text-[9px] ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                            {d.status}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">
                    Assign Users
                    <span className="ml-1 text-surface-400 font-normal">({form.userIds.length})</span>
                  </label>
                  {orgUsers.length === 0 ? (
                    <p className="text-xs text-surface-400 p-3 bg-surface-50 rounded-lg">No users found.</p>
                  ) : (
                    <div className="border border-surface-200 rounded-xl overflow-hidden divide-y divide-surface-100 max-h-48 overflow-y-auto">
                      {orgUsers.map((u) => (
                        <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-50">
                          <input
                            type="checkbox"
                            className="rounded border-surface-300 text-primary-600"
                            checked={form.userIds.includes(u.id)}
                            onChange={() => toggleUser(u.id)}
                          />
                          <Users size={13} className="text-surface-400 flex-shrink-0" />
                          <span className="text-sm text-surface-800 flex-1">{u.name}</span>
                          <span className="text-[10px] text-surface-400">{u.role}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>

        <Modal
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          size="sm"
          variant="danger"
          title="Delete Access Group"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          }
        >
          <p className="text-sm text-surface-700 dark:text-surface-300">
            Are you sure you want to delete <span className="font-bold">"{deleteTarget?.name}"</span>? This action cannot be undone.
          </p>
        </Modal>
      </div>
    </PageState>
  )
}
