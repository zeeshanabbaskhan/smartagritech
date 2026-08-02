import { useState } from 'react'
import { Eye, Pencil, Trash2, Plus } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapSlabRate } from '../../utils/mappers'

const blank = { slaveId: '', unitFrom: '', unitTo: '', rate: '', onPeakRate: '', offPeakRate: '' }

export default function UserSlabRates() {
  const { devices, slaves } = useDevices()
  const { showToast } = useToast()
  const [deviceFilter, setDeviceFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getSlabRates({ limit: 100 })).map(mapSlabRate),
    []
  )

  const openAdd = () => {
    setForm({ ...blank, slaveId: slaves[0]?.id ?? '' })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      slaveId: row.slaveId ?? '',
      unitFrom: row.unitFrom ?? '',
      unitTo: row.unitTo ?? '',
      rate: row.rate ?? '',
      onPeakRate: row._raw?.onPeakRate ?? '',
      offPeakRate: row._raw?.offPeakRate ?? '',
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.slaveId) return
    setSaving(true)
    try {
      const body = {
        deviceConfigSlaveId: form.slaveId,
        unitFrom: parseFloat(form.unitFrom),
        unitTo: parseFloat(form.unitTo),
        rate: parseFloat(form.rate),
        onPeakRate: form.onPeakRate !== '' ? parseFloat(form.onPeakRate) : undefined,
        offPeakRate: form.offPeakRate !== '' ? parseFloat(form.offPeakRate) : undefined,
      }
      if (modal === 'add') await emsApi.createSlabRate(body)
      else await emsApi.updateSlabRate(selected.id, body)
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
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const filtered = (rows ?? [])
    .filter((r) => !deviceFilter || r.slave === deviceFilter || r.slaveName === deviceFilter)
    .map((r) => ({
      ...r,
      onPeakRate: r._raw?.onPeakRate ?? '—',
      offPeakRate: r._raw?.offPeakRate ?? '—',
    }))

  const columns = [
    { key: 'slave', label: 'Slave' },
    { key: 'unitFrom', label: 'Unit From' },
    { key: 'unitTo', label: 'Unit To' },
    { key: 'rate', label: 'Rate' },
    { key: 'onPeakRate', label: 'On-Peak Rate' },
    { key: 'offPeakRate', label: 'Off-Peak Rate' },
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
            <h2 className="page-title">Manage Slab Rates</h2>
            <p className="breadcrumb">Manage Slab Rates &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Slab Rate</button>
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
          title={modal === 'add' ? 'Add Slab Rate' : 'Edit Slab Rate'}
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
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Unit From" value={form.unitFrom} onChange={(e) => setForm((f) => ({ ...f, unitFrom: e.target.value }))} />
              <TextInput label="Unit To" value={form.unitTo} onChange={(e) => setForm((f) => ({ ...f, unitTo: e.target.value }))} />
            </div>
            <TextInput label="Rate" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="On-Peak Rate" value={form.onPeakRate} onChange={(e) => setForm((f) => ({ ...f, onPeakRate: e.target.value }))} />
              <TextInput label="Off-Peak Rate" value={form.offPeakRate} onChange={(e) => setForm((f) => ({ ...f, offPeakRate: e.target.value }))} />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Slab Rate Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Slave', selected.slave],
                ['Unit From', selected.unitFrom],
                ['Unit To', selected.unitTo],
                ['Rate', selected.rate],
                ['On-Peak Rate', selected._raw?.onPeakRate ?? '—'],
                ['Off-Peak Rate', selected._raw?.offPeakRate ?? '—'],
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
