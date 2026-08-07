import { useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, Plus } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { TextInput, SelectInput, RadioInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapSlabRate } from '../../utils/mappers'

const RATE_TYPES = [
  { value: 'default', label: 'Default Rate' },
  { value: 'time_based', label: 'Time-Based (On/Off Peak)' },
]

const blank = {
  deviceId: '',
  slaveId: '',
  unitFrom: '',
  unitTo: '',
  rateType: 'default',
  rate: '',
  onPeakRate: '',
  offPeakRate: '',
}

export default function UserSlabRates() {
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

  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getSlabRates({ limit: 100 })).map(mapSlabRate),
    []
  )

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
    const deviceId = devices[0]?.id ?? ''
    setForm({ ...blank, deviceId })
    setErrors({})
    setModal('add')
  }

  const openEdit = (row) => {
    setSelected(row)
    const rateType = row.rateType === 'time_based' ? 'time_based' : 'default'
    setForm({
      deviceId: row.deviceId ?? row.locationId ?? '',
      slaveId: row.slaveId ?? '',
      unitFrom: row.unitFrom ?? '',
      unitTo: row.unitTo ?? '',
      rateType,
      rate: rateType === 'default' ? (row.rate ?? '') : '',
      onPeakRate: row.onPeakRate ?? row._raw?.onPeakRate ?? '',
      offPeakRate: row.offPeakRate ?? row._raw?.offPeakRate ?? '',
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
    if (form.unitFrom === '' || Number.isNaN(parseFloat(form.unitFrom))) next.unitFrom = 'Unit From is required'
    if (form.unitTo === '' || Number.isNaN(parseFloat(form.unitTo))) next.unitTo = 'Unit To is required'
    else if (parseFloat(form.unitTo) <= parseFloat(form.unitFrom)) next.unitTo = 'Must be greater than Unit From'
    if (!form.rateType) next.rateType = 'Rate Type is required'
    if (form.rateType === 'default') {
      if (form.rate === '' || Number.isNaN(parseFloat(form.rate))) next.rate = 'Rate is required'
    } else {
      if (form.onPeakRate === '' || Number.isNaN(parseFloat(form.onPeakRate))) next.onPeakRate = 'On Peak Rate is required'
      if (form.offPeakRate === '' || Number.isNaN(parseFloat(form.offPeakRate))) next.offPeakRate = 'Off Peak Rate is required'
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
        unitFrom: parseFloat(form.unitFrom),
        unitTo: parseFloat(form.unitTo),
      }
      if (form.rateType === 'time_based') {
        body.onPeakRate = parseFloat(form.onPeakRate)
        body.offPeakRate = parseFloat(form.offPeakRate)
        body.rate = body.onPeakRate
      } else {
        body.rate = parseFloat(form.rate)
        body.onPeakRate = null
        body.offPeakRate = null
      }

      if (modal === 'add') await emsApi.createSlabRate(body)
      else await emsApi.updateSlabRate(selected.id, body)
      showToast(modal === 'add' ? 'Slab rate created' : 'Slab rate updated', 'success')
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete slab rate for "${row.slave}"?`)) return
    try {
      await emsApi.deleteSlabRate(row.id)
      showToast('Slab rate deleted', 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const filtered = (rows ?? [])
    .filter((r) => !deviceFilter || r.location === deviceFilter || r.deviceId === deviceFilter)
    .map((r) => ({
      ...r,
      onPeakRate: r.onPeakRate ?? '—',
      offPeakRate: r.offPeakRate ?? '—',
      rateDisplay: r.rateType === 'time_based'
        ? `On ${r.onPeakRate ?? '—'} / Off ${r.offPeakRate ?? '—'}`
        : (r.rate ?? '—'),
    }))

  const columns = [
    { key: 'location', label: 'Location' },
    { key: 'slave', label: 'Slave' },
    { key: 'unitFrom', label: 'Unit From' },
    { key: 'unitTo', label: 'Unit To' },
    { key: 'rateTypeLabel', label: 'Rate Type' },
    { key: 'rateDisplay', label: 'Rate' },
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
            <h2 className="page-title">Manage Slab Rates</h2>
            <p className="breadcrumb">Manage Slab Rates &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Slab Rate</button>
        </div>

        <div className="card p-4 mb-5">
          <div className="w-56">
            <label className="label">Location</label>
            <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
              <option value="">All locations</option>
              {devices.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search slab rates..."
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
          title={modal === 'add' ? 'Add Slab Rates' : 'Edit Slab Rates'}
          footer={(
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || loadingSlaves}>
                {saving ? 'Saving...' : 'Save'}
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
            <div className="grid grid-cols-2 gap-4">
              <TextInput
                label="Unit From"
                required
                type="number"
                value={form.unitFrom}
                error={errors.unitFrom}
                onChange={(e) => setForm((f) => ({ ...f, unitFrom: e.target.value }))}
              />
              <TextInput
                label="Unit To"
                required
                type="number"
                value={form.unitTo}
                error={errors.unitTo}
                onChange={(e) => setForm((f) => ({ ...f, unitTo: e.target.value }))}
              />
            </div>
            <RadioInput
              label="Rate Type"
              name="slab-rate-type"
              required
              value={form.rateType}
              error={errors.rateType}
              options={RATE_TYPES}
              onChange={(v) => setForm((f) => ({ ...f, rateType: v }))}
            />
            {form.rateType === 'default' ? (
              <TextInput
                label="Rate"
                required
                type="number"
                value={form.rate}
                error={errors.rate}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="On Peak Rate"
                  required
                  type="number"
                  value={form.onPeakRate}
                  error={errors.onPeakRate}
                  onChange={(e) => setForm((f) => ({ ...f, onPeakRate: e.target.value }))}
                />
                <TextInput
                  label="Off Peak Rate"
                  required
                  type="number"
                  value={form.offPeakRate}
                  error={errors.offPeakRate}
                  onChange={(e) => setForm((f) => ({ ...f, offPeakRate: e.target.value }))}
                />
              </div>
            )}
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Slab Rate Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Location', selected.location],
                ['Slave', selected.slave],
                ['Unit From', selected.unitFrom],
                ['Unit To', selected.unitTo],
                ['Rate Type', selected.rateTypeLabel],
                ['Rate', selected.rateType === 'time_based' ? '—' : selected.rate],
                ['On-Peak Rate', selected.onPeakRate ?? '—'],
                ['Off-Peak Rate', selected.offPeakRate ?? '—'],
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
