import { useState } from 'react'
import { Eye, Pencil, Trash2, Plus } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapIntervalHistory } from '../../utils/mappers'

const blank = { variableName: '', slaveName: '', totalUnit: '', tariff: '', startDate: '', endDate: '' }

export default function UserIntervalHistory() {
  const { devices, slaves } = useDevices()
  const { showToast } = useToast()
  const [deviceFilter, setDeviceFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const { data, loading, error, reload } = useFetch(async () => {
    const rows = list(await emsApi.getIntervalHistory({ limit: 100 })).map((h) => {
      const m = mapIntervalHistory(h)
      return {
        ...m,
        variableName: m.variable,
        slaveName: m.slave,
        totalUnit: m.unit,
        startDate: m.from?.slice?.(0, 10) ?? m.from,
        endDate: m.to?.slice?.(0, 10) ?? m.to,
      }
    })
    return { rows }
  }, [])

  const openAdd = () => {
    setForm({ ...blank, slaveName: slaves[0]?.name ?? slaves[0]?.slaveName ?? devices[0]?.name ?? '' })
    setModal('add')
  }
  const openEdit = (row) => { setSelected(row); setForm({ ...blank, ...row }); setModal('edit') }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.variableName) return
    setSaving(true)
    try {
      const body = {
        variableName: form.variableName,
        slaveName: form.slaveName,
        totalUnit: form.totalUnit !== '' ? Number(form.totalUnit) : undefined,
        tariff: form.tariff !== '' ? Number(form.tariff) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      }
      if (modal === 'edit' && selected?.id) {
        await emsApi.deleteIntervalHistory(selected.id).catch(() => {})
      }
      await emsApi.createIntervalHistory(body)
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete interval "${row.variableName}"?`)) return
    try {
      await emsApi.deleteIntervalHistory(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const filtered = (data?.rows ?? []).filter((r) => !deviceFilter || r.slaveName === deviceFilter)

  const columns = [
    { key: 'variableName', label: 'Variable Name' },
    { key: 'slaveName', label: 'Slave Name' },
    { key: 'totalUnit', label: 'Total Unit' },
    { key: 'tariff', label: 'Tariff' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
  ]

  const slaveOptions = (slaves.length ? slaves : devices).map((s) => ({
    value: s.name ?? s.slaveName ?? s.id,
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
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          )}
        >
          <div className="space-y-4">
            <TextInput
              label="Variable Name"
              required
              placeholder="e.g. Active Power"
              value={form.variableName}
              onChange={(e) => setForm((f) => ({ ...f, variableName: e.target.value }))}
            />
            <SelectInput
              label="Slave Name"
              required
              placeholder="Select device"
              value={form.slaveName}
              onChange={(e) => setForm((f) => ({ ...f, slaveName: e.target.value }))}
              options={slaveOptions}
            />
            <TextInput label="Total Unit" value={form.totalUnit} onChange={(e) => setForm((f) => ({ ...f, totalUnit: e.target.value }))} />
            <TextInput label="Tariff" value={form.tariff} onChange={(e) => setForm((f) => ({ ...f, tariff: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" value={form.startDate || ''} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" className="input" value={form.endDate || ''} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Interval Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Variable Name', selected.variableName],
                ['Slave Name', selected.slaveName],
                ['Total Unit', selected.totalUnit],
                ['Tariff', selected.tariff],
                ['Start Date', selected.startDate],
                ['End Date', selected.endDate],
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
