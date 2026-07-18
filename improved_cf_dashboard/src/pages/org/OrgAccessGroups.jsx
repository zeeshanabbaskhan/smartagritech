import { useState, useMemo } from 'react'
import { ShieldCheck, Plus, Edit2, Trash2, Cpu, Users } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { useAccessGroups } from '../../context/AccessGroupContext'
import { useAuth } from '../../context/AuthContext'
import { devices as devicesData, users as usersData } from '../../data/dummy'

const EMPTY_FORM = { name: '', deviceIds: [], userIds: [] }

function loadDevices() {
  try {
    const saved = localStorage.getItem('cf-ems-devices')
    return saved ? JSON.parse(saved) : devicesData
  } catch {
    return devicesData
  }
}

function loadUsers() {
  try {
    const saved = localStorage.getItem('cf-ems-users')
    return saved ? JSON.parse(saved) : usersData
  } catch {
    return usersData
  }
}

export default function OrgAccessGroups() {
  const { user } = useAuth()
  const orgName   = user?.name || 'Ambition'
  const { groups: allGroups, createGroup, updateGroup, deleteGroup } = useAccessGroups()

  const [allDevices] = useState(loadDevices)
  const [allUsers]   = useState(loadUsers)

  // Get allowed device IDs assigned by Super Admin for this organization
  const adminAllowedDeviceIds = useMemo(() => {
    const adminGroups = allGroups.filter(g => g.org === orgName && g.createdBy === 'admin')
    if (adminGroups.length === 0) return null // No admin restrictions, show all devices
    const ids = new Set()
    adminGroups.forEach(g => {
      g.deviceIds?.forEach(id => ids.add(id))
    })
    return Array.from(ids)
  }, [allGroups, orgName])

  // Filter orgDevices to only include devices allowed by Super Admin
  const orgDevices = useMemo(() => {
    const orgFiltered = allDevices.filter(d => d.org === orgName)
    if (adminAllowedDeviceIds === null) return orgFiltered
    return orgFiltered.filter(d => adminAllowedDeviceIds.includes(d.id))
  }, [allDevices, orgName, adminAllowedDeviceIds])

  const orgUsers     = useMemo(() => allUsers.filter(u => u.org === orgName), [allUsers, orgName])
  const groups       = useMemo(() => allGroups.filter(g => g.org === orgName && g.createdBy === 'org'), [allGroups, orgName])

  const [modalMode, setModalMode] = useState(null)   // 'create' | 'edit' | null
  const [editId,    setEditId]    = useState(null)
  const [deleteId,  setDeleteId]  = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)

  function openCreate() {
    setForm(EMPTY_FORM)
    setModalMode('create')
  }

  function openEdit(row) {
    setForm({
      name: row.name,
      deviceIds: [...row.deviceIds],
      userIds: [...(row.userIds || [])]
    })
    setEditId(row.id)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  function handleSave() {
    if (!form.name.trim()) return
    if (modalMode === 'create') {
      createGroup({
        name: form.name.trim(),
        org: orgName,
        deviceIds: form.deviceIds,
        userIds: form.userIds,
        createdBy: 'org'
      })
    } else {
      updateGroup(editId, {
        name: form.name.trim(),
        deviceIds: form.deviceIds,
        userIds: form.userIds
      })
    }
    closeModal()
  }

  function handleDelete() {
    deleteGroup(deleteId)
    setDeleteId(null)
  }

  function toggleDevice(id) {
    setForm(prev => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(id)
        ? prev.deviceIds.filter(x => x !== id)
        : [...prev.deviceIds, id],
    }))
  }

  function toggleUser(id) {
    setForm(prev => ({
      ...prev,
      userIds: prev.userIds.includes(id)
        ? prev.userIds.filter(x => x !== id)
        : [...prev.userIds, id],
    }))
  }

  const deleteTarget = groups.find(g => g.id === deleteId)

  const columns = [
    { key: 'name',      label: 'Group Name', sortable: true },
    {
      key: 'deviceIds',
      label: 'Devices',
      render: (ids) => (
        <span className="badge badge-neutral">{ids.length} device{ids.length !== 1 ? 's' : ''}</span>
      ),
    },
    {
      key: 'userIds',
      label: 'Users',
      render: (ids = []) => (
        <span className="badge badge-info">{ids.length} user{ids.length !== 1 ? 's' : ''}</span>
      ),
    },
    { key: 'createdAt', label: 'Created At', sortable: true },
  ]

  const actions = (row) => (
    <>
      <button
        type="button"
        onClick={() => openEdit(row)}
        className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
      >
        <Edit2 size={11} /> Edit
      </button>
      <button
        type="button"
        onClick={() => setDeleteId(row.id)}
        className="btn-ghost text-xs py-1 px-2 text-danger-600 hover:bg-danger-50 flex items-center gap-1"
      >
        <Trash2 size={11} /> Delete
      </button>
    </>
  )

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-xl">
            <ShieldCheck size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-surface-900 dark:text-surface-100 tracking-tight">
              Access Groups
            </h1>
            <p className="text-xs text-surface-400 mt-0.5">
              Create device sub-groups within <span className="font-bold text-surface-600">{orgName}</span> for scoped dashboard views
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus size={13} /> Create Group
        </button>
      </div>

      {/* Groups table */}
      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={groups}
          searchable
          searchPlaceholder="Search groups..."
          pageSize={10}
          actions={actions}
          emptyMessage="No access groups yet. Create one to filter your dashboard by device subset."
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        size="md"
        title={modalMode === 'create' ? 'Create Access Group' : 'Edit Access Group'}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="btn-secondary text-xs py-1.5 px-3">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {modalMode === 'create' ? 'Create Group' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Group name */}
          <div>
            <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5">
              Group Name <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              className="input text-sm w-full"
              placeholder="e.g. Floor A Meters"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Device and User selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Devices column */}
            <div>
              <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5">
                Assign Devices
                <span className="ml-1 text-surface-400 font-normal">
                  ({form.deviceIds.length} of {orgDevices.length} selected)
                </span>
              </label>
              {orgDevices.length === 0 ? (
                <p className="text-xs text-surface-400 p-3 bg-surface-50 rounded-lg">
                  No devices found for {orgName}.
                </p>
              ) : (
                <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-56 overflow-y-auto">
                  {orgDevices.map(d => (
                    <label
                      key={d.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                        checked={form.deviceIds.includes(d.id)}
                        onChange={() => toggleDevice(d.id)}
                      />
                      <Cpu size={13} className="text-surface-400 flex-shrink-0" />
                      <span className="text-sm text-surface-800 dark:text-surface-200 flex-1">{d.name}</span>
                      <span className={`badge text-[9px] flex-shrink-0 ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                        {d.status}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Users column */}
            <div>
              <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5">
                Assign Users
                <span className="ml-1 text-surface-400 font-normal">
                  ({form.userIds.length} of {orgUsers.length} selected)
                </span>
              </label>
              {orgUsers.length === 0 ? (
                <p className="text-xs text-surface-400 p-3 bg-surface-50 rounded-lg">
                  No users found for {orgName}.
                </p>
              ) : (
                <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-56 overflow-y-auto">
                  {orgUsers.map(u => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                        checked={form.userIds.includes(u.id)}
                        onChange={() => toggleUser(u.id)}
                      />
                      <Users size={13} className="text-surface-400 flex-shrink-0" />
                      <span className="text-sm text-surface-800 dark:text-surface-200 flex-1">{u.name}</span>
                      <span className="text-[10px] text-surface-400 flex-shrink-0">{u.role}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        size="sm"
        variant="danger"
        title="Delete Access Group"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteId(null)} className="btn-secondary text-xs py-1.5 px-3">
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className="btn-danger text-xs py-1.5 px-3">
              Delete
            </button>
          </div>
        }
      >
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Are you sure you want to delete{' '}
          <span className="font-bold">"{deleteTarget?.name}"</span>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
