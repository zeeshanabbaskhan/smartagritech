import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapScheduledTask, mapOrganization, mapDevice } from '../../utils/mappers'
import { uiStatusToApi, uiRepeatToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blankForm = {
  organizationId: '',
  deviceId: '',
  device: '',
  variable: '',
  action: 'OFF',
  time: '08:30 AM',
  repeat: 'Daily',
  status: 'Active',
}

export default function AdminScheduleTasks() {
  const { showToast } = useToast()
  const { data: meta, loading: metaLoading } = useFetch(async () => {
    const [orgsRes, devicesRes] = await Promise.all([
      emsApi.getOrganizations({ limit: 100 }),
      emsApi.getDevices({ limit: 100 }),
    ])
    return {
      organizations: list(orgsRes).map(mapOrganization),
      devices: list(devicesRes).map(mapDevice),
    }
  }, [])

  const { data: rows, loading, error, reload } = useFetch(async () => {
    const [tasksRes, orgsRes] = await Promise.all([
      emsApi.getScheduledTasks({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    const orgMap = Object.fromEntries(list(orgsRes).map((o) => [o.id, mapOrganization(o).name]))
    return list(tasksRes).map((t, i) => {
      const mapped = mapScheduledTask(t)
      return {
        ...mapped,
        serial: mapped.serial ?? (list(tasksRes).length - i),
        org: orgMap[t.organizationId] ?? mapped.org,
        organizationId: t.organizationId,
      }
    })
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)

  const devicesForOrg = (meta?.devices ?? []).filter((d) =>
    !form.organizationId || d.organizationId === form.organizationId
  )

  const openAdd = () => { setForm(blankForm); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      organizationId: row.organizationId ?? '',
      deviceId: row.deviceId ?? '',
      device: row.device,
      variable: row.variable || row.name || '',
      action: row.action === 'ON' || row.action === 'OFF' ? row.action : (row.taskType === 'Turn Off' ? 'OFF' : 'ON'),
      time: row.time || '08:30 AM',
      repeat: row.repeat || row.frequency || 'Daily',
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.deviceId || !form.variable.trim()) return
    setSaving(true)
    try {
      const orgId = form.organizationId
        || meta?.devices.find((d) => d.id === form.deviceId)?.organizationId
        || meta?.organizations?.[0]?.id
      const body = {
        organizationId: orgId,
        deviceId: form.deviceId,
        variableName: form.variable.trim(),
        action: form.action,
        scheduledTime: form.time,
        repeatType: uiRepeatToApi(form.repeat),
        status: uiStatusToApi(form.status),
      }
      if (modal === 'add') {
        await emsApi.createScheduledTask(body)
        showToast('Scheduled task created successfully')
      } else {
        await emsApi.updateScheduledTask(selected.id, body)
        showToast('Scheduled task updated successfully')
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
    if (!confirm(`Delete task for "${row.device} - ${row.variable}"?`)) return
    try {
      await emsApi.deleteScheduledTask(row.id)
      showToast('Task deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Task was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'serial', label: 'Serial No.' },
    {
      key: 'variable',
      label: 'Device Variable',
      sortable: false,
      render: (_, row) => <span>{row.device} - {row.variable || row.name}</span>,
    },
    {
      key: 'action',
      label: 'Action',
      render: (v) => <span className={`badge ${v === 'ON' ? 'badge-success' : 'badge-neutral'}`}>{v}</span>,
    },
    { key: 'time', label: 'Scheduled Time' },
    { key: 'repeat', label: 'Repeat Type' },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span>,
    },
    { key: 'createdBy', label: 'Created by' },
  ]

  return (
    <PageState loading={loading || metaLoading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Tasks</h2>
            <p className="breadcrumb">Manage Scheduled Tasks &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Scheduled Task
          </button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search tasks..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Scheduled Task' : 'Edit Scheduled Task'}
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
            <SelectInput
              label="Organization"
              required
              placeholder="Select organization"
              value={form.organizationId}
              onChange={(e) => setForm((f) => ({
                ...f,
                organizationId: e.target.value,
                deviceId: '',
                device: '',
              }))}
              options={(meta?.organizations ?? []).map((o) => ({ value: o.id, label: o.name }))}
            />
            <SelectInput
              label="Device"
              required
              placeholder="Select device"
              value={form.deviceId}
              onChange={(e) => {
                const d = devicesForOrg.find((x) => x.id === e.target.value)
                  || meta?.devices.find((x) => x.id === e.target.value)
                setForm((f) => ({
                  ...f,
                  deviceId: e.target.value,
                  device: d?.name ?? '',
                  organizationId: f.organizationId || d?.organizationId || '',
                }))
              }}
              options={devicesForOrg.map((d) => ({ value: d.id, label: d.name }))}
            />
            <TextInput
              label="Variable"
              required
              placeholder="e.g. Furnace"
              value={form.variable}
              onChange={(e) => setForm((f) => ({ ...f, variable: e.target.value }))}
            />
            <SelectInput
              label="Action"
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              options={['ON', 'OFF']}
            />
            <div>
              <label className="label">Scheduled Time</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 08:30 AM"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
            <SelectInput
              label="Repeat Type"
              value={form.repeat}
              onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))}
              options={['Daily', 'Weekly', 'Monthly', 'Once']}
            />
            <ToggleInput
              label="Status (Active)"
              checked={form.status === 'Active'}
              onChange={(v) => setForm((f) => ({ ...f, status: v ? 'Active' : 'Inactive' }))}
            />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Scheduled Task Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Serial No.', selected.serial],
                ['Device', selected.device],
                ['Variable', selected.variable || selected.name],
                ['Action', selected.action],
                ['Scheduled Time', selected.time],
                ['Repeat Type', selected.repeat || selected.frequency],
                ['Status', selected.status],
                ['Created by', selected.createdBy],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-32 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
