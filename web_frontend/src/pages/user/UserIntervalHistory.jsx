import { useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, Plus } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapIntervalHistory } from '../../utils/mappers'

const blank = {
  deviceId: '',
  slaveId: '',
  variableName: '',
  startDate: '',
  endDate: '',
}

export default function UserIntervalHistory() {
  const { devices } = useDevices()
  const { showToast } = useToast()
  const [deviceFilter, setDeviceFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [formSlaves, setFormSlaves] = useState([])
  const [loadingSlaves, setLoadingSlaves] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const { data: rows, loading, error, reload } = useFetch(async () => {
    const params = { limit: 200 }
    if (deviceFilter) params.deviceId = deviceFilter
    return list(await emsApi.getIntervalHistory(params)).map(mapIntervalHistory)
  }, [deviceFilter])

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
          return { ...f, slaveId: slaves[0]?.id ?? '' }
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

  const openAdd = () => {
    setForm({ ...blank, deviceId: devices[0]?.id ?? '' })
    setErrors({})
    setModal('add')
  }

  const openEdit = (row) => {
    setSelected(row)
    setForm({
      deviceId: row.deviceId ?? '',
      slaveId: row.slaveId ?? '',
      variableName: row.variableName ?? row.variable ?? '',
      startDate: row.startDate || '',
      endDate: row.endDate || '',
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
    if (!form.variableName?.trim()) next.variableName = 'Variable name is required'
    if (!form.startDate) next.startDate = 'Start date is required'
    if (!form.endDate) next.endDate = 'End date is required'
    else if (form.startDate && form.endDate < form.startDate) next.endDate = 'Must be on or after start date'
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
        variableName: form.variableName.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      }
      if (modal === 'edit' && selected?.id) {
        await emsApi.deleteIntervalHistory(selected.id)
      }
      await emsApi.createIntervalHistory(body)
      showToast(modal === 'add' ? 'Interval computed and saved' : 'Interval updated', 'success')
      close()
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
  const slaveOptions = formSlaves.map((s) => ({
    value: s.id,
    label: s.name ?? s.slaveName ?? s.id,
  }))

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Interval History</h2>
            <p className="breadcrumb">Manage Interval History &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Interval</button>
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

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Interval' : 'Edit Interval'}
          footer={(
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || loadingSlaves}>
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          )}
        >
          <div className="space-y-4">
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
              }))}
              options={locationOptions}
            />
            <SelectInput
              label="Slave"
              required
              placeholder={loadingSlaves ? 'Loading slaves...' : 'Select slave'}
              value={form.slaveId}
              error={errors.slaveId}
              disabled={!form.deviceId || loadingSlaves}
              onChange={(e) => setForm((f) => ({
                ...f,
                slaveId: e.target.value || slaveOptions[0]?.value || '',
              }))}
              options={slaveOptions}
            />
            <TextInput
              label="Variable Name"
              required
              placeholder="e.g. Active Power"
              value={form.variableName}
              error={errors.variableName}
              onChange={(e) => setForm((f) => ({ ...f, variableName: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate || ''}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
                {errors.startDate && <p className="text-xs text-danger-600 mt-1">{errors.startDate}</p>}
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.endDate || ''}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
                {errors.endDate && <p className="text-xs text-danger-600 mt-1">{errors.endDate}</p>}
              </div>
            </div>
            <p className="text-xs text-surface-400">
              Total units and tariff are calculated from sensor readings and slab rates for the selected range.
            </p>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Interval Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Variable Name', selected.variableName || selected.variable],
                ['Location', selected.location],
                ['Slave Name', selected.slaveName || selected.slave],
                ['Total Unit', selected.totalUnit || selected.unit],
                ['Tariff', selected.tariff],
                ['Start Date', selected.startDate || selected.from],
                ['End Date', selected.endDate || selected.to],
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
