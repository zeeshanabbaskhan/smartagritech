import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Plus, Pencil, Trash2, Cpu, Users } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapUser, mapOrganization } from '../../utils/mappers'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const EMPTY = { name: '', description: '', organizationId: '', deviceIds: [], slaveIds: [], userIds: [] }

function fmtDate(d) {
  if (!d) return '—'
  const s = typeof d === 'string' ? d : d.toISOString?.() ?? String(d)
  return s.length > 16 ? s.slice(0, 16).replace('T', ' ') : s
}

/**
 * Shared Device Groups CRUD for admin + org.
 * @param {{ scope?: 'admin' | 'org' }} props
 */
export default function DeviceGroupsPage({ scope = 'admin' }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const isAdmin = scope === 'admin' || user?.role === 'admin'
  const devicesPath = isAdmin ? '/admin/devices' : '/org/devices'
  const [orgFilter, setOrgFilter] = useState('')

  const { data, loading, error, reload } = useFetch(async () => {
    const orgParams = isAdmin && orgFilter ? { organizationId: orgFilter } : {}
    const [groupsRes, devicesRes, usersRes, orgsRes, accessRes] = await Promise.all([
      emsApi.getDeviceGroups({ limit: 100, ...orgParams }),
      emsApi.getDevices({ limit: 200, ...orgParams }),
      emsApi.getUsers({ limit: 200, ...orgParams }),
      isAdmin ? emsApi.getOrganizations({ limit: 100 }) : Promise.resolve({ data: [] }),
      isAdmin ? Promise.resolve({ data: [] }) : emsApi.getAccessGroups({ limit: 100 }).catch(() => ({ data: [] })),
    ])

    // Org admins may only group devices the platform admin granted them through
    // an admin-created access group. No such grant => all org devices allowed.
    const adminAllowedDeviceIds = new Set()
    list(accessRes)
      .filter((g) => g.createdByRole === 'SUPER_ADMIN')
      .forEach((g) => (g.deviceIds || []).forEach((id) => adminAllowedDeviceIds.add(id)))
    const orgs = list(orgsRes).map(mapOrganization)
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]))
    const devices = list(devicesRes).map(mapDevice)
    const users = list(usersRes).map((u) => mapUser(u, orgMap[u.organizationId] || u.organization?.name))
    const groups = list(groupsRes).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description || '',
      organizationId: g.organizationId,
      org: orgMap[g.organizationId] || g.organization?.name || '—',
      deviceIds: g.deviceIds || [],
      slaveIds: g.slaveIds || [],
      slaves: g.slaves || [],
      userIds: g.userIds || [],
      createdBy: g.createdByRole === 'SUPER_ADMIN' ? 'Admin' : g.createdByRole ? 'Organization' : '—',
      createdAt: fmtDate(g.createdAt),
      _raw: g,
    }))
    return { groups, devices, users, orgs, adminAllowedDeviceIds: [...adminAllowedDeviceIds] }
  }, [isAdmin, orgFilter])

  const groups = data?.groups ?? []
  const devices = data?.devices ?? []
  const users = data?.users ?? []
  const orgs = data?.orgs ?? []
  const adminAllowedDeviceIds = data?.adminAllowedDeviceIds ?? []
  const hasDeviceCeiling = !isAdmin && adminAllowedDeviceIds.length > 0

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const orgDevices = useMemo(() => {
    const oid = form.organizationId || user?.organizationId
    let scoped = oid ? devices.filter((d) => d.organizationId === oid) : devices
    if (hasDeviceCeiling) {
      const allowed = new Set(adminAllowedDeviceIds)
      scoped = scoped.filter((d) => allowed.has(d.id))
    }
    return scoped
  }, [devices, form.organizationId, user?.organizationId, hasDeviceCeiling, adminAllowedDeviceIds])

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
      description: row.description || '',
      organizationId: row.organizationId,
      deviceIds: [...(row.deviceIds || [])],
      slaveIds: [...(row.slaveIds || [])],
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

  const toggleSlave = (id) => {
    setForm((prev) => ({
      ...prev,
      slaveIds: (prev.slaveIds || []).includes(id)
        ? prev.slaveIds.filter((x) => x !== id)
        : [...(prev.slaveIds || []), id],
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
    const hasMembers = (form.deviceIds?.length || 0) + (form.slaveIds?.length || 0) > 0
    if (!hasMembers) {
      showToast('Select at least one slave or device', 'error')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        organizationId,
        deviceIds: form.deviceIds,
        slaveIds: form.slaveIds,
        userIds: form.userIds,
      }
      if (modal === 'create') await emsApi.createDeviceGroup(body)
      else await emsApi.updateDeviceGroup(selected.id, body)
      showToast(modal === 'create' ? 'Device group created' : 'Device group updated', 'success')
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
      await emsApi.deleteDeviceGroup(deleteTarget.id)
      showToast('Device group deleted', 'success')
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
      key: 'description',
      label: 'Description',
      render: (v) => <span className="text-xs text-surface-400">{v || '—'}</span>,
    },
    {
      key: 'members',
      label: 'Slaves & Devices',
      render: (_, row) => {
        const nSlv = row.slaveIds?.length || 0
        const nDev = row.deviceIds?.length || 0
        if (nSlv && nDev) {
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="badge badge-info" title={`${nSlv} slave(s)`}>{nSlv} slave{nSlv !== 1 ? 's' : ''}</span>
              <span className="badge badge-neutral" title={`${nDev} device(s)`}>{nDev} dev</span>
            </div>
          )
        }
        if (nSlv) return <span className="badge badge-info">{nSlv} slave{nSlv !== 1 ? 's' : ''}</span>
        return <span className="badge badge-neutral">{nDev} device{nDev !== 1 ? 's' : ''}</span>
      },
    },
    {
      key: 'userIds',
      label: 'Users',
      render: (ids) => (
        <span className="badge badge-info" title={`${ids?.length || 0} user${(ids?.length || 0) !== 1 ? 's' : ''}`}>
          {ids?.length || 0}
        </span>
      ),
    },
    ...(isAdmin ? [{ key: 'createdBy', label: 'Created By', render: (v) => <span className="text-xs text-surface-600 dark:text-surface-300 whitespace-nowrap">{v || '—'}</span> }] : []),
    { key: 'createdAt', label: 'Created At' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-xl">
              <Boxes size={20} className="text-primary-600" />
            </div>
            <div>
              <h2 className="page-title">Device Groups</h2>
              <p className="breadcrumb">
                {isAdmin ? 'Admin / Device Groups' : 'Organization / Device Groups'}
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
          emptyMessage="No device groups yet. Create one to get started."
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
          title={modal === 'create' ? 'Create Device Group' : 'Edit Device Group'}
          size="md"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={
                  saving
                  || !form.name.trim()
                  || ((!form.deviceIds?.length) && (!form.slaveIds?.length))
                  || (isAdmin && !form.organizationId)
                }
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
              placeholder="e.g. Washing Area, Boilers, G1..."
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextInput
              label="Description"
              placeholder="e.g. All washing machines on ground floor"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            {isAdmin && (
              <SelectInput
                label="Organization"
                required
                value={form.organizationId}
                onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value, deviceIds: [], slaveIds: [], userIds: [] }))}
                options={[
                  { value: '', label: 'Select organization…' },
                  ...orgs.map((o) => ({ value: o.id, label: o.name })),
                ]}
              />
            )}

            {(form.organizationId || !isAdmin) && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">
                      Add Slaves & Devices
                      <span className="text-danger-600 font-bold ml-0.5">*</span>
                    </label>
                    <span className="text-xs text-primary-600 font-bold">
                      {(form.slaveIds?.length || 0) + (form.deviceIds?.length || 0)} selected
                    </span>
                  </div>
                  {hasDeviceCeiling && (
                    <p className="text-[11px] text-surface-400 mb-2">
                      Limited to the {adminAllowedDeviceIds.length} device{adminAllowedDeviceIds.length !== 1 ? 's' : ''} granted to your organization by the platform admin.
                    </p>
                  )}
                  {orgDevices.length === 0 ? (
                    <div className="p-3 inset-panel space-y-3">
                      <p className="text-xs text-surface-500">
                        No devices available. Add a device first, then come back to create this group.
                      </p>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          close()
                          navigate(devicesPath)
                        }}
                      >
                        <Cpu size={14} /> Go to Devices
                      </button>
                    </div>
                  ) : (
                    <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-64 overflow-y-auto">
                      {orgDevices.map((d) => {
                        const dSlaves = d.slaves || d.configSlaves || d._raw?.configSlaves || []
                        return (
                          <div key={d.id} className="bg-white dark:bg-surface-900 divide-y divide-surface-50 dark:divide-surface-800/60">
                            {/* Device header */}
                            <div className="flex items-center gap-3 px-3 py-2 bg-surface-50/80 dark:bg-surface-800/40">
                              <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-surface-300 text-primary-600"
                                  checked={form.deviceIds.includes(d.id)}
                                  onChange={() => toggleDevice(d.id)}
                                />
                                <Cpu size={13} className="text-primary-600 flex-shrink-0" />
                                <span className="text-xs font-bold text-surface-900 dark:text-surface-100">{d.name}</span>
                                <span className="text-[10px] text-surface-400">({dSlaves.length} slaves)</span>
                              </label>
                              <span className={`badge text-[9px] ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                                {d.status}
                              </span>
                            </div>

                            {/* Slaves under device */}
                            {dSlaves.length > 0 && (
                              <div className="pl-6 pr-3 py-1 space-y-1 bg-surface-50/30 dark:bg-surface-950/20">
                                {dSlaves.map((slv) => (
                                  <label
                                    key={slv.id}
                                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-surface-100/60 dark:hover:bg-surface-800/60 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      className="rounded border-surface-300 text-primary-600"
                                      checked={(form.slaveIds || []).includes(slv.id)}
                                      onChange={() => toggleSlave(slv.id)}
                                    />
                                    <span className="text-xs text-surface-700 dark:text-surface-200 flex-1">
                                      {slv.name}
                                      {slv.isDefault && (
                                        <span className="ml-1.5 text-[9px] text-surface-400 font-normal">(Default)</span>
                                      )}
                                    </span>
                                    <span className="badge badge-info text-[8px] py-0 px-1.5">Slave</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {orgDevices.length > 0 && form.deviceIds.length === 0 && (!form.slaveIds || form.slaveIds.length === 0) && (
                    <p className="text-[11px] text-danger-600 mt-1.5 font-semibold">Select at least one slave or device</p>
                  )}
                </div>
                <div>
                  <label className="label">
                    Add Users
                    <span className="ml-1 text-surface-400 font-normal">({form.userIds.length})</span>
                  </label>
                  {orgUsers.length === 0 ? (
                    <p className="text-xs text-surface-500 p-3 inset-panel">No users found.</p>
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
              </>
            )}
          </div>
        </Modal>

        <Modal
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          size="sm"
          variant="danger"
          title="Delete Device Group"
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
