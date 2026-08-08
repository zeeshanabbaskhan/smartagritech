import { useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { FormField, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { SearchableSelect } from '../../components/ui/DataCenterFilterBar'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapScheduledTask } from '../../utils/mappers'
import { uiRepeatToApi, uiStatusToApi } from '../../utils/apiForm'

const REPEAT_OPTIONS = ['One Time', 'Daily', 'Weekly', 'Monthly']

const blank = {
  deviceId: '',
  slaveId: '',
  variableId: '',
  variableName: '',
  action: 'OFF',
  time: '00:00',
  repeat: 'One Time',
  status: 'Active',
}

/** Normalize API / legacy times to HH:mm for <input type="time">. */
function toHhMm(val) {
  if (!val) return '00:00'
  const s = String(val).trim()
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (m24) return `${m24[1].padStart(2, '0')}:${m24[2]}`
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (m12) {
    let h = parseInt(m12[1], 10)
    const min = m12[2]
    const ap = m12[3].toUpperCase()
    if (ap === 'PM' && h < 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${min}`
  }
  return '00:00'
}

function variableLabel(v) {
  const name = v.displayName || v.name || v.variableName || '—'
  return v.registerAddress ? `${name} (${v.registerAddress})` : name
}

export default function UserSchedule() {
  const { devices } = useDevices()
  const { showToast } = useToast()
  const [deviceFilter, setDeviceFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [formSlaves, setFormSlaves] = useState([])
  const [formVariables, setFormVariables] = useState([])
  const [loadingSlaves, setLoadingSlaves] = useState(false)
  const [loadingVars, setLoadingVars] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const { data, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getScheduledTasks({ limit: 100 })
    return { rows: list(res).map(mapScheduledTask) }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadSlaves = async () => {
      if (!form.deviceId || (modal !== 'add' && modal !== 'edit')) {
        setFormSlaves([])
        return
      }
      setLoadingSlaves(true)
      try {
        const slaves = list(await emsApi.getDeviceConfig(form.deviceId))
        if (cancelled) return
        setFormSlaves(slaves)
        setForm((f) => {
          if (f.slaveId && slaves.some((s) => s.id === f.slaveId)) return f
          return { ...f, slaveId: slaves[0]?.id ?? '', variableId: '', variableName: '' }
        })
      } catch {
        if (!cancelled) {
          setFormSlaves([])
          showToast('Failed to load slaves for location', 'error')
        }
      } finally {
        if (!cancelled) setLoadingSlaves(false)
      }
    }
    loadSlaves()
    return () => { cancelled = true }
  }, [form.deviceId, modal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    const loadVars = async () => {
      if (!form.deviceId || !form.slaveId || (modal !== 'add' && modal !== 'edit')) {
        setFormVariables([])
        return
      }
      setLoadingVars(true)
      try {
        const rows = list(await emsApi.getDeviceVariables(form.deviceId, form.slaveId))
        if (cancelled) return
        setFormVariables(rows)
        setForm((f) => {
          if (f.variableId && rows.some((v) => v.id === f.variableId)) return f
          if (f.variableName && rows.some((v) => (v.name || v.variableName) === f.variableName)) {
            const match = rows.find((v) => (v.name || v.variableName) === f.variableName)
            return {
              ...f,
              variableId: match?.id ?? '',
              variableName: match?.name || match?.variableName || f.variableName,
            }
          }
          const first = rows[0]
          return {
            ...f,
            variableId: first?.id ?? '',
            variableName: first?.name || first?.variableName || '',
          }
        })
      } catch {
        if (!cancelled) {
          setFormVariables([])
          showToast('Failed to load variables for slave', 'error')
        }
      } finally {
        if (!cancelled) setLoadingVars(false)
      }
    }
    loadVars()
    return () => { cancelled = true }
  }, [form.deviceId, form.slaveId, modal]) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setForm({ ...blank, deviceId: devices[0]?.id ?? '' })
    setErrors({})
    setModal('add')
  }

  const openEdit = (row) => {
    setSelected(row)
    const raw = row._raw ?? {}
    setForm({
      deviceId: row.deviceId ?? '',
      slaveId: raw.deviceConfigSlaveId ?? '',
      variableId: raw.deviceConfigVariableId ?? '',
      variableName: row.variable ?? row.name ?? '',
      action: row.action === 'ON' ? 'ON' : 'OFF',
      time: toHhMm(row.time),
      repeat: (row.frequency === 'Once' ? 'One Time' : null)
        || (REPEAT_OPTIONS.includes(row.frequency) ? row.frequency : null)
        || (REPEAT_OPTIONS.includes(row.repeat) ? row.repeat : null)
        || 'One Time',
      status: row.status ?? 'Active',
    })
    setErrors({})
    setModal('edit')
  }

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null); setErrors({}) }

  const validate = () => {
    const next = {}
    if (!form.deviceId) next.deviceId = 'Location is required'
    if (!form.slaveId) next.slaveId = 'Slave is required'
    if (!form.variableName?.trim() && !form.variableId) next.variableName = 'Variable is required'
    if (!form.time) next.time = 'Scheduled time is required'
    if (!form.repeat) next.repeat = 'Repeat option is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      showToast('Please fill all required fields', 'error')
      return
    }
    setSaving(true)
    try {
      const body = {
        deviceId: form.deviceId,
        deviceConfigSlaveId: form.slaveId || undefined,
        deviceConfigVariableId: form.variableId || undefined,
        variableName: form.variableName.trim(),
        action: form.action === 'ON' ? 'ON' : 'OFF',
        scheduledTime: toHhMm(form.time),
        repeatType: uiRepeatToApi(form.repeat),
        status: uiStatusToApi(form.status),
      }
      if (modal === 'add') {
        await emsApi.createScheduledTask(body)
        showToast('Scheduled task created', 'success')
      } else {
        await emsApi.updateScheduledTask(selected.id, body)
        showToast('Scheduled task updated', 'success')
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
    if (!confirm(`Delete task for "${row.device}"?`)) return
    try {
      await emsApi.deleteScheduledTask(row.id)
      showToast('Scheduled task deleted', 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const rows = (data?.rows ?? [])
    .filter((r) => !deviceFilter || r.deviceId === deviceFilter || r.device === deviceFilter)
    .map((r) => ({
      ...r,
      slave: r.device,
      repeat: r.frequency === 'Once' ? 'One Time' : r.frequency,
    }))

  const columns = [
    { key: 'slave', label: 'Slave' },
    { key: 'variable', label: 'Variable' },
    { key: 'action', label: 'Action', render: (v) => <span className={`badge ${v === 'ON' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'time', label: 'Scheduled Time' },
    { key: 'repeat', label: 'Repeat Option' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
  ]

  const locationOptions = devices.map((d) => ({ value: d.id, label: d.name }))
  const slaveOptions = formSlaves.map((s) => ({
    value: s.id,
    label: s.name ?? s.slaveName ?? s.id,
  }))
  const variableOptions = formVariables.map((v) => ({
    value: v.id,
    label: variableLabel(v),
  }))

  const isForm = modal === 'add' || modal === 'edit'
  const formTitle = modal === 'edit' ? 'Edit Schedule Task' : 'Add Schedule Task'

  if (isForm) {
    return (
      <PageState loading={false} error={null}>
        <div>
          <div className="page-header">
            <div>
              <h2 className="page-title">Manage Schedule Task</h2>
              <p className="breadcrumb">Manage Schedule Task - {formTitle}</p>
            </div>
            <button type="button" className="btn-secondary" onClick={close}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          <div className="card p-5 max-w-xl space-y-4">
            <SelectInput
              label="Location"
              required
              placeholder="Select location"
              value={form.deviceId}
              error={errors.deviceId}
              onChange={(e) => setForm((f) => ({
                ...f,
                deviceId: e.target.value || locationOptions[0]?.value || '',
                slaveId: '',
                variableId: '',
                variableName: '',
              }))}
              options={locationOptions}
            />

            <FormField label="Slave" required error={errors.slaveId}>
              <SearchableSelect
                className="w-full"
                value={form.slaveId}
                options={slaveOptions}
                placeholder={loadingSlaves ? 'Loading slaves…' : 'Select slave'}
                disabled={!form.deviceId || loadingSlaves}
                clearable={false}
                onChange={(v) => setForm((f) => ({
                  ...f,
                  slaveId: v || slaveOptions[0]?.value || '',
                  variableId: '',
                  variableName: '',
                }))}
              />
            </FormField>

            <FormField label="Variable" required error={errors.variableName}>
              <SearchableSelect
                className="w-full"
                value={form.variableId}
                options={variableOptions}
                placeholder={
                  !form.slaveId
                    ? 'Select slave first'
                    : loadingVars
                      ? 'Loading variables…'
                      : 'Select variable'
                }
                disabled={!form.slaveId || loadingVars}
                clearable={false}
                onChange={(v) => {
                  const match = formVariables.find((x) => x.id === v)
                  setForm((f) => ({
                    ...f,
                    variableId: v || '',
                    variableName: match?.name || match?.variableName || '',
                  }))
                }}
              />
            </FormField>

            <ToggleInput
              label="Variable Action"
              description={form.action === 'ON' ? 'ON' : 'OFF'}
              checked={form.action === 'ON'}
              onChange={(on) => setForm((f) => ({ ...f, action: on ? 'ON' : 'OFF' }))}
            />

            <FormField label="Scheduled Time" required error={errors.time}>
              <input
                type="time"
                className="input"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </FormField>

            <SelectInput
              label="Repeat Option"
              required
              value={form.repeat}
              error={errors.repeat}
              onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))}
              options={REPEAT_OPTIONS}
            />

            <ToggleInput
              label="Enable/Disable Task"
              description={form.status === 'Active' ? 'Enabled' : 'Disabled'}
              checked={form.status === 'Active'}
              onChange={(v) => setForm((f) => ({ ...f, status: v ? 'Active' : 'Inactive' }))}
            />

            <div className="pt-2">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || loadingSlaves || loadingVars}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </PageState>
    )
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Schedule Task</h2>
            <p className="breadcrumb">Manage Schedule Task &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Schedule Task
          </button>
        </div>

        <div className="card p-4 mb-5">
          <div className="w-56">
            <label className="label">Location</label>
            <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
              <option value="">All locations</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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

        <Modal open={modal === 'view'} onClose={close} title="Task Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Location', selected.device],
                ['Variable', selected.variable],
                ['Action', selected.action],
                ['Scheduled Time', selected.time],
                ['Repeat Option', selected.frequency === 'Once' ? 'One Time' : selected.frequency],
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
