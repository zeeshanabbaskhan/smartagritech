import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Eye, Pencil, Trash2, Plus } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { FormField, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { SearchableSelect } from '../../components/ui/DataCenterFilterBar'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapIntervalHistory } from '../../utils/mappers'
import { fetchDeviceVariables } from '../../utils/sensorReadings'

const blank = {
  deviceId: '',
  slaveId: '',
  variableName: '',
  unitVariableName: '',
  startDateTime: '',
  endDateTime: '',
  active: true,
}

function variableLabel(v) {
  const display = v.displayName || v.name
  const code = v.registerAddress
    || (v.displayName && v.name && v.name !== v.displayName ? v.name : '')
  return code ? `${display} (${code})` : display
}

function unitVariableLabel(v) {
  if (v.displayName) return v.displayName
  if (v.unit) return v.unit
  return v.name
}

function toDatetimeLocal(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) {
    const s = String(value)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(0, 10)}T00:00`
    return ''
  }
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pickDefaultUnitVariable(vars) {
  if (!vars.length) return ''
  const scored = vars.find((v) =>
    /powerconsumption|energy|kwh|units/i.test(`${v.name} ${v.displayName || ''} ${v.unit || ''}`),
  )
  return scored?.name ?? vars[0].name
}

export default function UserIntervalHistory() {
  const { devices } = useDevices()
  const { showToast } = useToast()
  const [deviceFilter, setDeviceFilter] = useState('')
  const [view, setView] = useState('list') // list | add | edit
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [formSlaves, setFormSlaves] = useState([])
  const [formVariables, setFormVariables] = useState([])
  const [loadingSlaves, setLoadingSlaves] = useState(false)
  const [loadingVars, setLoadingVars] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [viewModal, setViewModal] = useState(null)

  const { data: rows, loading, error, reload } = useFetch(async () => {
    const params = { limit: 200 }
    if (deviceFilter) params.deviceId = deviceFilter
    return list(await emsApi.getIntervalHistory(params)).map(mapIntervalHistory)
  }, [deviceFilter])

  useEffect(() => {
    let cancelled = false
    const loadSlaves = async () => {
      if (!form.deviceId || (view !== 'add' && view !== 'edit')) {
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
          return {
            ...f,
            slaveId: slaves[0]?.id ?? '',
            variableName: '',
            unitVariableName: '',
          }
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
  }, [form.deviceId, view]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    const loadVars = async () => {
      if (!form.deviceId || !form.slaveId || (view !== 'add' && view !== 'edit')) {
        setFormVariables([])
        return
      }
      setLoadingVars(true)
      try {
        const vars = await fetchDeviceVariables(form.deviceId, form.slaveId)
        if (cancelled) return
        setFormVariables(vars)
        setForm((f) => {
          const names = vars.map((v) => v.name)
          const variableName = f.variableName && names.includes(f.variableName)
            ? f.variableName
            : (vars[0]?.name ?? '')
          const unitVariableName = f.unitVariableName && names.includes(f.unitVariableName)
            ? f.unitVariableName
            : pickDefaultUnitVariable(vars)
          if (variableName === f.variableName && unitVariableName === f.unitVariableName) return f
          return { ...f, variableName, unitVariableName }
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
  }, [form.deviceId, form.slaveId, view]) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    const now = new Date()
    const end = new Date(now.getTime() + 60 * 60 * 1000)
    setSelected(null)
    setForm({
      ...blank,
      deviceId: devices[0]?.id ?? '',
      startDateTime: toDatetimeLocal(now),
      endDateTime: toDatetimeLocal(end),
      active: true,
    })
    setErrors({})
    setView('add')
  }

  const openEdit = (row) => {
    setSelected(row)
    const rawStart = row._raw?.startDate ?? row.startDateTime ?? row.startDate
    const rawEnd = row._raw?.endDate ?? row.endDateTime ?? row.endDate
    setForm({
      deviceId: row.deviceId ?? '',
      slaveId: row.slaveId ?? '',
      variableName: row.variableName ?? row.variable ?? '',
      unitVariableName: row.unitVariableName || row.variableName || row.variable || '',
      startDateTime: toDatetimeLocal(rawStart),
      endDateTime: toDatetimeLocal(rawEnd),
      active: true,
    })
    setErrors({})
    setView('edit')
  }

  const openView = (row) => setViewModal(row)
  const closeForm = () => {
    setView('list')
    setSelected(null)
    setErrors({})
    setForm(blank)
  }

  const validate = () => {
    const next = {}
    if (!form.deviceId) next.deviceId = 'Location is required'
    if (!form.slaveId) next.slaveId = 'Slave is required'
    if (!form.variableName) next.variableName = 'Variable is required'
    if (!form.unitVariableName) next.unitVariableName = 'Unit Variable is required'
    if (!form.startDateTime) next.startDateTime = 'Start Date Time is required'
    if (!form.endDateTime) next.endDateTime = 'End Date Time is required'
    else if (form.startDateTime && form.endDateTime < form.startDateTime) {
      next.endDateTime = 'Must be on or after start date time'
    }
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
        deviceConfigSlaveId: form.slaveId,
        variableName: form.variableName,
        unitVariableName: form.unitVariableName,
        startDate: new Date(form.startDateTime).toISOString(),
        endDate: new Date(form.endDateTime).toISOString(),
      }
      if (view === 'edit' && selected?.id) {
        await emsApi.deleteIntervalHistory(selected.id)
      }
      await emsApi.createIntervalHistory(body)
      showToast(view === 'add' ? 'Interval computed and saved' : 'Interval updated', 'success')
      closeForm()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete interval "${row.variableName || row.variable}"?`)) return
    try {
      await emsApi.deleteIntervalHistory(row.id)
      showToast('Interval deleted', 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const columns = [
    { key: 'variableName', label: 'Variable Name' },
    { key: 'location', label: 'Location' },
    { key: 'slaveName', label: 'Slave Name' },
    { key: 'totalUnit', label: 'Total Unit' },
    { key: 'tariff', label: 'Tariff' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
  ]

  const locationOptions = devices.map((d) => ({ value: d.id, label: d.name }))
  const slaveOptions = useMemo(
    () => formSlaves.map((s) => ({
      value: s.id,
      label: s.name ?? s.slaveName ?? s.id,
    })),
    [formSlaves],
  )
  const variableOptions = useMemo(
    () => formVariables.map((v) => ({ value: v.name, label: variableLabel(v) })),
    [formVariables],
  )
  const unitVariableOptions = useMemo(
    () => formVariables.map((v) => ({ value: v.name, label: unitVariableLabel(v) })),
    [formVariables],
  )

  if (view === 'add' || view === 'edit') {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Interval History</h2>
            <p className="breadcrumb">
              Manage Interval History &ndash; {view === 'add' ? 'Add Interval' : 'Edit Interval'}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={closeForm}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        <div className="card p-5 max-w-2xl space-y-4">
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
              variableName: '',
              unitVariableName: '',
            }))}
            options={locationOptions}
          />

          <FormField label="Slave" required error={errors.slaveId}>
            <SearchableSelect
              className="w-full"
              value={form.slaveId}
              options={slaveOptions}
              placeholder={loadingSlaves ? 'Loading slaves...' : 'Select slave'}
              disabled={!form.deviceId || loadingSlaves}
              clearable={false}
              onChange={(v) => setForm((f) => ({
                ...f,
                slaveId: v || slaveOptions[0]?.value || '',
                variableName: '',
                unitVariableName: '',
              }))}
            />
          </FormField>

          <FormField label="Variable" required error={errors.variableName}>
            <SearchableSelect
              className="w-full"
              value={form.variableName}
              options={variableOptions}
              placeholder={loadingVars ? 'Loading variables...' : 'Select variable'}
              disabled={!form.slaveId || loadingVars}
              clearable={false}
              onChange={(v) => setForm((f) => ({
                ...f,
                variableName: v || variableOptions[0]?.value || '',
              }))}
            />
          </FormField>

          <FormField label="Unit Variable" required error={errors.unitVariableName}>
            <SearchableSelect
              className="w-full"
              value={form.unitVariableName}
              options={unitVariableOptions}
              placeholder={loadingVars ? 'Loading variables...' : 'Select unit variable'}
              disabled={!form.slaveId || loadingVars}
              clearable={false}
              onChange={(v) => setForm((f) => ({
                ...f,
                unitVariableName: v || unitVariableOptions[0]?.value || '',
              }))}
            />
          </FormField>

          <FormField label="Start Date Time" required error={errors.startDateTime}>
            <input
              type="datetime-local"
              className={`input ${errors.startDateTime ? 'border-danger-600 ring-2 ring-danger-600/20' : ''}`}
              value={form.startDateTime}
              onChange={(e) => setForm((f) => ({ ...f, startDateTime: e.target.value }))}
            />
          </FormField>

          <FormField label="End Date Time" required error={errors.endDateTime}>
            <input
              type="datetime-local"
              className={`input ${errors.endDateTime ? 'border-danger-600 ring-2 ring-danger-600/20' : ''}`}
              value={form.endDateTime}
              onChange={(e) => setForm((f) => ({ ...f, endDateTime: e.target.value }))}
            />
          </FormField>

          <ToggleInput
            label="Active"
            checked={form.active}
            onChange={(v) => setForm((f) => ({ ...f, active: v }))}
          />

          <p className="text-xs text-surface-400">
            Total units and tariff are calculated from the unit variable readings and slab rates for the selected range.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
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
    )
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Interval History</h2>
            <p className="breadcrumb">Manage Interval History &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Interval
          </button>
        </div>

        <div className="card p-4 mb-5">
          <div className="w-56">
            <label className="label">Location</label>
            <select
              className="select"
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
            >
              <option value="">All locations</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search intervals..."
          emptyMessage="No data available in table"
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal open={!!viewModal} onClose={() => setViewModal(null)} title="Interval Details" size="sm">
          {viewModal && (
            <div className="space-y-3">
              {[
                ['Variable Name', viewModal.variableName || viewModal.variable],
                ['Location', viewModal.location],
                ['Slave Name', viewModal.slaveName || viewModal.slave],
                ['Total Unit', viewModal.totalUnit || viewModal.unit],
                ['Tariff', viewModal.tariff],
                ['Start Date', viewModal.startDate || viewModal.from],
                ['End Date', viewModal.endDate || viewModal.to],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm gap-4">
                  <span className="text-surface-400">{label}</span>
                  <span className="text-surface-900 dark:text-surface-100 font-medium text-right">{val}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
