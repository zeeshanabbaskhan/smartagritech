import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, Play } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapScheduledTask, mapDevice } from '../../utils/mappers'
import { uiStatusToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const SCHEDULE_OPTIONS = [
  { label: 'Daily 06:00', time: '06:00', repeat: 'DAILY' },
  { label: 'Daily 08:00', time: '08:00', repeat: 'DAILY' },
  { label: 'Daily 10:00', time: '10:00', repeat: 'DAILY' },
  { label: 'Daily 18:00', time: '18:00', repeat: 'DAILY' },
  { label: 'Mon 09:00', time: '09:00', repeat: 'WEEKLY' },
  { label: 'Wed 09:00', time: '09:00', repeat: 'WEEKLY' },
  { label: 'Fri 09:00', time: '09:00', repeat: 'WEEKLY' },
  { label: '1st 10:00', time: '10:00', repeat: 'ONCE' },
  { label: '15th 10:00', time: '10:00', repeat: 'ONCE' },
]

const emptyForm = (deviceId) => ({
  name: '',
  deviceId: deviceId ?? '',
  variableName: 'Switch',
  action: 'ON',
  schedule: 'Daily 08:00',
  status: 'Active',
})

export default function OrgScheduleTasks() {
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const [tasksRes, devicesRes] = await Promise.all([
      emsApi.getScheduledTasks({ limit: 100 }),
      emsApi.getDevices({ limit: 100 }),
    ])
    return {
      rows: list(tasksRes).map(mapScheduledTask),
      devices: list(devicesRes).map(mapDevice),
    }
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(null)

  const rows = data?.rows ?? []
  const devices = data?.devices ?? []

  const openAdd = () => { setForm(emptyForm(devices[0]?.id)); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      deviceId: row.deviceId,
      variableName: row.variable,
      action: row.action,
      schedule: row.schedule,
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const scheduleMeta = SCHEDULE_OPTIONS.find((s) => s.label === form.schedule) ?? SCHEDULE_OPTIONS[1]

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        deviceId: form.deviceId,
        variableName: form.variableName || form.name || 'Switch',
        action: form.action,
        scheduledTime: scheduleMeta.time,
        repeatType: scheduleMeta.repeat,
        status: uiStatusToApi(form.status),
      }
      if (modal === 'add') await emsApi.createScheduledTask(body)
      else await emsApi.updateScheduledTask(selected.id, body)
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
    } catch (e) {
      if (e.status === 404) showToast('Task was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const handleRunNow = async (row) => {
    setRunning(row.id)
    try {
      await emsApi.toggleScheduledTask(row.id)
      reload()
    } catch (_) {}
    setRunning(null)
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const columns = [
    { key: 'name', label: 'Task Name' },
    { key: 'device', label: 'Device', render: (v) => <span className="text-xs text-surface-700">{v}</span> },
    { key: 'schedule', label: 'Schedule', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'lastRun', label: 'Last Run', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Schedule Tasks</h2>
            <p className="breadcrumb">Organization / Schedule Tasks</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Task</button>
        </div>

        <DataTable columns={columns} data={rows} searchPlaceholder="Search tasks..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className={`btn-ghost p-1.5 text-success-600 ${running === row.id ? 'opacity-50' : ''}`} onClick={() => handleRunNow(row)} title="Toggle" disabled={running === row.id}>
                <Play size={14} className={running === row.id ? 'animate-pulse' : ''} />
              </button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal open={modal === 'add' || modal === 'edit'} onClose={close}
          title={modal === 'add' ? 'Add Schedule Task' : 'Edit Schedule Task'}
          footer={<><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}</button></>}>
          <div className="space-y-4">
            <TextInput label="Task Name" placeholder="e.g. Weekly Energy Report" value={form.name} onChange={f('name')} />
            <SelectInput label="Device" required value={form.deviceId} onChange={f('deviceId')}
              options={devices.map((d) => ({ value: d.id, label: d.name }))} />
            <SelectInput label="Schedule" value={form.schedule} onChange={f('schedule')}
              options={SCHEDULE_OPTIONS.map((s) => s.label)} />
            <SelectInput label="Status" value={form.status} onChange={f('status')} options={['Active', 'Inactive']} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Task Details">
          {selected && (
            <div className="space-y-3">
              {[['Task Name', selected.name], ['Device', selected.device], ['Schedule', selected.schedule], ['Status', selected.status], ['Last Run', selected.lastRun]].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-24 flex-shrink-0">{label}</span>
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
