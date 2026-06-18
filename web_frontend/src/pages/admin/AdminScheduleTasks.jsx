import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, Play, ToggleLeft, ToggleRight } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapScheduledTask, mapOrganization, mapDevice } from '../../utils/mappers'
import { uiStatusToApi, uiRepeatToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blankForm = {
  name: '', org: '', organizationId: '', device: '', deviceId: '', taskType: 'Turn On',
  frequency: 'Daily', time: '08:00', recipients: '', status: 'Active',
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
    return list(tasksRes).map((t) => ({
      ...mapScheduledTask(t),
      org: orgMap[t.organizationId] ?? '—',
      organizationId: t.organizationId,
    }))
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(blankForm); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      org: row.org,
      organizationId: row.organizationId ?? '',
      device: row.device,
      deviceId: row.deviceId ?? '',
      taskType: row.taskType || 'Turn On',
      frequency: row.frequency || 'Daily',
      time: row.time || '08:00',
      recipients: row.recipients || '',
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        organizationId: form.organizationId || meta?.organizations.find((o) => o.name === form.org)?.id,
        deviceId: form.deviceId || meta?.devices.find((d) => d.name === form.device)?.id,
        variableName: form.name,
        action: form.taskType === 'Turn Off' ? 'OFF' : 'ON',
        scheduledTime: form.time,
        repeatType: uiRepeatToApi(form.frequency),
        status: uiStatusToApi(form.status),
      }
      if (modal === 'add') {
        await emsApi.createScheduledTask(body)
        showToast('Schedule task created successfully')
      } else {
        await emsApi.updateScheduledTask(selected.id, body)
        showToast('Schedule task updated successfully')
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
    if (!confirm(`Delete task "${row.name}"?`)) return
    try {
      await emsApi.deleteScheduledTask(row.id)
      showToast('Task deleted', 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const handleToggle = async (row) => {
    try {
      await emsApi.toggleScheduledTask(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Toggle failed', 'error')
    }
  }

  const handleRunNow = (row) => {
    showToast(`Task "${row.name}" queued for execution`)
  }

  const columns = [
    { key: 'name', label: 'Task Name' },
    { key: 'org', label: 'Organization' },
    { key: 'device', label: 'Device' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'status', label: 'Status', render: (v) =>
      <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'lastRun', label: 'Last Run' },
  ]

  return (
    <PageState loading={loading || metaLoading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Schedule Tasks</h2>
            <p className="breadcrumb">Admin / System / Schedule Tasks</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Task</button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search tasks..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 text-primary-600 hover:text-primary-300" onClick={() => handleRunNow(row)} title="Run Now">
                <Play size={14} />
              </button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => handleToggle(row)} title="Toggle Status">
                {row.status === 'Active'
                  ? <ToggleRight size={14} className="text-success-600" />
                  : <ToggleLeft size={14} className="text-surface-500" />}
              </button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Schedule Task' : 'Edit Schedule Task'}
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
            <TextInput label="Task Name" required placeholder="e.g. Daily Energy Report"
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <SelectInput label="Organization" required placeholder="Select organization"
              value={form.organizationId} onChange={(e) => {
                const org = meta?.organizations.find((o) => o.id === e.target.value)
                setForm((f) => ({ ...f, organizationId: e.target.value, org: org?.name ?? '' }))
              }}
              options={(meta?.organizations ?? []).map((o) => ({ value: o.id, label: o.name }))} />
            <SelectInput label="Device" required placeholder="Select device"
              value={form.deviceId} onChange={(e) => {
                const d = meta?.devices.find((x) => x.id === e.target.value)
                setForm((f) => ({ ...f, deviceId: e.target.value, device: d?.name ?? '' }))
              }}
              options={(meta?.devices ?? []).map((d) => ({ value: d.id, label: d.name }))} />
            <SelectInput label="Task Type" value={form.taskType}
              onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value }))}
              options={['Turn On', 'Turn Off', 'Energy Report', 'Alarm Summary', 'Data Export', 'Custom']} />
            <SelectInput label="Frequency" value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              options={['Daily', 'Weekly', 'Monthly']} />
            <div>
              <label className="label">Time</label>
              <input type="time" className="input" value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
            </div>
            <TextInput label="Email Recipients" placeholder="email1@x.com, email2@x.com"
              value={form.recipients} onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))} />
            <ToggleInput label="Status (Active)" checked={form.status === 'Active'}
              onChange={(v) => setForm((f) => ({ ...f, status: v ? 'Active' : 'Inactive' }))} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Schedule Task Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Task Name', selected.name],
                ['Organization', selected.org],
                ['Device', selected.device],
                ['Schedule', selected.schedule],
                ['Status', selected.status],
                ['Last Run', selected.lastRun],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-32 flex-shrink-0">{label}</span>
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
