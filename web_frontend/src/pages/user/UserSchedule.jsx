import { useState } from 'react'
import { Eye, Pencil, Trash2, Plus } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { TextInput, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapScheduledTask } from '../../utils/mappers'
import { uiRepeatToApi, uiStatusToApi } from '../../utils/apiForm'

const blank = { slaveId: '', variable: '', action: 'OFF', time: '08:00 AM', repeat: 'Daily', status: 'Active' }

export default function UserSchedule() {
  const { devices, slaves, selectedDeviceId } = useDevices()
  const { showToast } = useToast()
  const [deviceFilter, setDeviceFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const { data, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getScheduledTasks({ limit: 100 })
    return { rows: list(res).map(mapScheduledTask) }
  }, [])

  const openAdd = () => {
    setForm({
      ...blank,
      slaveId: slaves[0]?.id ?? '',
    })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      slaveId: row._raw?.deviceConfigSlaveId ?? row.deviceId ?? '',
      variable: row.variable ?? row.name ?? '',
      action: row.action ?? 'OFF',
      time: row.time ?? '08:00 AM',
      repeat: row.frequency ?? 'Daily',
      status: row.status ?? 'Active',
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.variable.trim()) return
    setSaving(true)
    try {
      const body = {
        deviceId: selectedDeviceId || devices[0]?.id,
        deviceConfigSlaveId: form.slaveId || undefined,
        variableName: form.variable,
        action: form.action,
        scheduledTime: form.time,
        repeatType: uiRepeatToApi(form.repeat),
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
    if (!confirm(`Delete task for "${row.device}"?`)) return
    try {
      await emsApi.deleteScheduledTask(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const rows = (data?.rows ?? [])
    .filter((r) => !deviceFilter || r.device === deviceFilter || r.deviceId === deviceFilter)
    .map((r) => ({
      ...r,
      slave: r.device,
      repeat: r.frequency,
    }))

  const columns = [
    { key: 'slave', label: 'Slave' },
    { key: 'variable', label: 'Variable' },
    { key: 'action', label: 'Action', render: (v) => <span className={`badge ${v === 'ON' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'time', label: 'Scheduled Time' },
    { key: 'repeat', label: 'Repeat Type' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
  ]

  const slaveOptions = (slaves.length ? slaves : devices).map((s) => ({
    value: s.id,
    label: s.name ?? s.slaveName ?? s.id,
  }))

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Schedule</h2>
            <p className="breadcrumb">Manage Scheduled &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Scheduled Task</button>
        </div>

        <div className="card p-4 mb-5">
          <div className="w-56">
            <label className="label">Device</label>
            <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
              <option value="">All locations</option>
              {devices.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search tasks..."
          emptyMessage="No data available in table"
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
          title={modal === 'add' ? 'Add Scheduled Task' : 'Edit Scheduled Task'}
          footer={(
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          )}
        >
          <div className="space-y-4">
            <SelectInput
              label="Slave"
              required
              placeholder="Select device"
              value={form.slaveId}
              onChange={(e) => setForm((f) => ({ ...f, slaveId: e.target.value }))}
              options={slaveOptions}
            />
            <TextInput
              label="Variable"
              required
              placeholder="e.g. Active Power"
              value={form.variable}
              onChange={(e) => setForm((f) => ({ ...f, variable: e.target.value }))}
            />
            <SelectInput
              label="Action"
              value={form.action}
              onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              options={['ON', 'OFF']}
            />
            <TextInput
              label="Scheduled Time"
              placeholder="e.g. 08:30 AM"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            />
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

        <Modal open={modal === 'view'} onClose={close} title="Task Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Slave', selected.device],
                ['Variable', selected.variable],
                ['Action', selected.action],
                ['Scheduled Time', selected.time],
                ['Repeat Type', selected.frequency],
                ['Status', selected.status],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-surface-400">{label}</span>
                  <span className="text-surface-900 font-medium">{val}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
