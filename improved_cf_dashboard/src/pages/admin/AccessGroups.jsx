import { useState, useMemo } from 'react'
import { ShieldCheck, Plus, Edit2, Trash2, Cpu, Users } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { useAccessGroups } from '../../context/AccessGroupContext'
import { organizations, devices as devicesData, users as usersData } from '../../data/dummy'

const EMPTY_FORM = { name: '', org: '', deviceIds: [], userIds: [] }

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

export default function AccessGroups() {
  const { groups, createGroup, updateGroup, deleteGroup } = useAccessGroups()
  const [allDevices]  = useState(loadDevices)
  const [allUsers]    = useState(loadUsers)

  const [modalMode,   setModalMode]   = useState(null)   // 'create' | 'edit' | null
  const [editId,      setEditId]      = useState(null)
  const [deleteId,    setDeleteId]    = useState(null)
  const [form,        setForm]        = useState(EMPTY_FORM)

  // Devices available for selected org
  const orgDevices = useMemo(
    () => allDevices.filter(d => d.org === form.org),
    [allDevices, form.org]
  )

  // Users available for selected org
  const orgUsers = useMemo(
    () => allUsers.filter(u => u.org === form.org),
    [allUsers, form.org]
  )

  function openCreate() {
    setForm(EMPTY_FORM)
    setModalMode('create')
  }

  function openEdit(row) {
    setForm({
      name: row.name,
      org: row.org,
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
    if (!form.name.trim() || !form.org) return
    if (modalMode === 'create') {
      createGroup({
        name: form.name.trim(),
        org: form.org,
        deviceIds: form.deviceIds,
        userIds: form.userIds,
        createdBy: 'admin'
      })
    } else {
      updateGroup(editId, {
        name: form.name.trim(),
        org: form.org,
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

  function handleOrgChange(org) {
    setForm(prev => ({ ...prev, org, deviceIds: [], userIds: [] }))
  }

  const deleteTarget = groups.find(g => g.id === deleteId)

  const columns = [
    { key: 'name',      label: 'Group Name',    sortable: true },
    { key: 'org',       label: 'Organization',  sortable: true },
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
    { key: 'createdBy', label: 'Created By',  render: v => <span className="capitalize">{v}</span> },
    { key: 'createdAt', label: 'Created At',  sortable: true },
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
              Manage device groups across all organizations for privilege-scoped dashboards
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
          searchPlaceholder="Search groups by name or org..."
          pageSize={10}
          actions={actions}
          emptyMessage="No access groups yet. Create one to get started."
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
              disabled={!form.name.trim() || !form.org}
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
              placeholder="e.g. Production Floor"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Organization */}
          <div>
            <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5">
              Organization <span className="text-danger-500">*</span>
            </label>
            <select
              className="input text-sm w-full"
              value={form.org}
              onChange={e => handleOrgChange(e.target.value)}
            >
              <option value="">Select organization…</option>
              {organizations.map(o => (
                <option key={o.id} value={o.name}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* Device and User selection */}
          {form.org && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Devices column */}
              <div>
                <label className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5">
                  Assign Devices
                  <span className="ml-1 text-surface-400 font-normal">
                    ({form.deviceIds.length} selected)
                  </span>
                </label>
                {orgDevices.length === 0 ? (
                  <p className="text-xs text-surface-400 p-3 bg-surface-50 rounded-lg">
                    No devices found for {form.org}.
                  </p>
                ) : (
                  <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-48 overflow-y-auto">
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
                    ({form.userIds.length} selected)
                  </span>
                </label>
                {orgUsers.length === 0 ? (
                  <p className="text-xs text-surface-400 p-3 bg-surface-50 rounded-lg">
                    No users found for {form.org}.
                  </p>
                ) : (
                  <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-48 overflow-y-auto">
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
          )}
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
