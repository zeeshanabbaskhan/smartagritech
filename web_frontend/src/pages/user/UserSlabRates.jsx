import { useState } from 'react'
import { Eye, Zap, Receipt, Plus, Pencil, Trash2 } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput } from '../../components/ui/FormFields'
import emsApi, { list } from '../../api/emsApi'
import { mapSlabRate } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const blank = { deviceConfigSlaveId: '', unitFrom: '', unitTo: '', rate: '' }

export default function UserSlabRates() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getSlabRates({ limit: 100 })).map(mapSlabRate),
    []
  )
  const [viewing, setViewing] = useState(null)
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const totalUnits = (rows ?? []).reduce((sum, r) => sum + (Number(r.totalUnit) || 0), 0)
  const avgRate = rows?.length ? rows.reduce((s, r) => s + (Number(r.rate) || 0), 0) / rows.length : 0
  const estimatedBill = Math.round(totalUnits * avgRate)

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => { setSelected(row); setForm({ deviceConfigSlaveId: row.slaveId, unitFrom: row.unitFrom, unitTo: row.unitTo, rate: row.rate }); setModal('edit') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        deviceConfigSlaveId: form.deviceConfigSlaveId,
        unitFrom: parseFloat(form.unitFrom),
        unitTo: parseFloat(form.unitTo),
        rate: parseFloat(form.rate),
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
    if (!confirm('Delete this slab rate?')) return
    try {
      await emsApi.deleteSlabRate(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const columns = [
    { key: 'variableName', label: 'Variable Name' },
    { key: 'slaveName', label: 'Slave / Device Name' },
    { key: 'totalUnit', label: 'Total Units', render: (v) => `${Number(v).toLocaleString()} kWh` },
    { key: 'tariff', label: 'Tariff Rate' },
    { key: 'startDate', label: 'Billing Period Start' },
    { key: 'endDate', label: 'Billing Period End' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Slab Rates</h2>
            <p className="breadcrumb">User / Slab Rates</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Slab Rate</button>
        </div>

        <DataTable columns={columns} data={rows ?? []} searchable={false}
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5 rounded" title="View" onClick={() => setViewing(row)}><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 rounded" title="Edit" onClick={() => openEdit(row)}><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5 rounded" title="Delete" onClick={() => handleDelete(row)}><Trash2 size={14} /></button>
            </>
          )}
        />

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4"><Receipt size={16} className="text-primary-600" /><h3 className="text-sm font-semibold text-surface-800">Estimated Monthly Bill</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-surface-500 mb-1"><Zap size={13} /><span className="text-xs uppercase tracking-wide">Total Units</span></div>
              <p className="text-xl font-bold text-surface-900">{totalUnits.toLocaleString()}</p>
              <p className="text-xs text-surface-500 mt-0.5">kWh</p>
            </div>
            <div className="bg-surface-50 rounded-lg p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-surface-500 mb-1">Rate</p>
              <p className="text-xl font-bold text-surface-900">PKR {avgRate.toFixed(0)}</p>
              <p className="text-xs text-surface-500 mt-0.5">per unit</p>
            </div>
            <div className="bg-success-600/10 border border-success-600/30 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-success-600 mb-1"><Receipt size={13} /><span className="text-xs uppercase tracking-wide">Estimated Bill</span></div>
              <p className="text-xl font-bold text-success-600">PKR {estimatedBill.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <Modal open={!!viewing} onClose={() => setViewing(null)} title="Slab Rate Details" size="sm">
          {viewing && (
            <div className="space-y-3">
              {[['Variable Name', viewing.variableName], ['Device', viewing.slaveName], ['Total Units', `${Number(viewing.totalUnit).toLocaleString()} kWh`], ['Tariff Rate', viewing.tariff], ['Period Start', viewing.startDate], ['Period End', viewing.endDate]].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm"><span className="text-surface-400">{label}</span><span className="text-surface-900 font-medium">{val}</span></div>
              ))}
            </div>
          )}
        </Modal>

        <Modal open={modal === 'add' || modal === 'edit'} onClose={close} title={modal === 'add' ? 'Add Slab Rate' : 'Edit Slab Rate'}
          footer={<><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
          <div className="space-y-4">
            <TextInput label="Device Config Slave ID" required value={form.deviceConfigSlaveId} onChange={(e) => setForm((f) => ({ ...f, deviceConfigSlaveId: e.target.value }))} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TextInput label="Unit From" type="number" value={form.unitFrom} onChange={(e) => setForm((f) => ({ ...f, unitFrom: e.target.value }))} />
              <TextInput label="Unit To" type="number" value={form.unitTo} onChange={(e) => setForm((f) => ({ ...f, unitTo: e.target.value }))} />
              <TextInput label="Rate" type="number" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
            </div>
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
