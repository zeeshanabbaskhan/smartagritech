import { useState } from 'react'
import { Eye, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import { useToast } from '../../context/ToastContext'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmTemplate } from '../../utils/mappers'

const methodBadge = (method) => {
  const m = { Email: 'badge-info', SMS: 'badge-warning', WhatsApp: 'badge-success' }
  return <span className={`badge ${m[method] || 'badge-neutral'}`}>{method}</span>
}

export default function UserAlarmTemplate() {
  const { selectedDevice, selectedDeviceId } = useDevices()
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const res = await emsApi.getAlarmTemplates({ limit: 100 })
    return {
      rows: list(res).map((t) => {
        const m = mapAlarmTemplate(t)
        return { ...m, method: 'Email', threshold: `${m.threshold}${m.variable?.includes('Voltage') ? 'V' : ''}` }
      }),
    }
  }, [])

  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const rows = data?.rows ?? []

  const openEdit = (row) => { setEditing(row); setForm({ ...row }) }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await emsApi.updateAlarmTemplate(form.id, {
        name: form.name,
        operator: form.operator,
        threshold: parseFloat(form.threshold),
        isActive: form.status === 'Active',
      })
      setEditing(null)
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (row) => {
    try {
      await emsApi.updateAlarmTemplate(row.id, { isActive: row.status !== 'Active' })
      reload()
    } catch (e) {
      showToast(e.message || 'Toggle failed', 'error')
    }
  }

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const columns = [
    { key: 'name', label: 'Trigger Name' },
    { key: 'variable', label: 'Variable' },
    { key: 'condition', label: 'Condition', render: (v) => <span className="font-mono text-surface-700">{v}</span> },
    { key: 'threshold', label: 'Threshold' },
    { key: 'method', label: 'Push Method', render: (v) => methodBadge(v) },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">Alarm Templates</h2>
            <p className="breadcrumb">User / Alarm Template</p>
          </div>
          <div className="text-xs text-surface-500 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5">
            Device: <span className="text-surface-800 font-medium">{selectedDevice?.name ?? '—'}</span>
          </div>
        </div>

        <DeviceSlaveSelector onChange={reload} />

        <DataTable columns={columns} data={rows} searchPlaceholder="Search alarms..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5 rounded" title="View" onClick={() => setViewing(row)}><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 rounded" title="Edit" onClick={() => openEdit(row)}><Edit2 size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 rounded" title="Toggle Status" onClick={() => toggle(row)}>
                {row.status === 'Active' ? <ToggleRight size={16} className="text-success-500" /> : <ToggleLeft size={16} className="text-surface-500" />}
              </button>
            </>
          )}
        />

        <Modal open={!!viewing} onClose={() => setViewing(null)} title="Alarm Details" size="sm">
          {viewing && (
            <div className="space-y-3">
              {[['Trigger Name', viewing.name], ['Variable', viewing.variable], ['Condition', viewing.condition], ['Threshold', viewing.threshold], ['Push Method', viewing.method], ['Status', viewing.status]].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm"><span className="text-surface-400">{label}</span><span className="text-surface-900 font-medium">{val}</span></div>
              ))}
            </div>
          )}
        </Modal>

        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Alarm Template" size="md"
          footer={<><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button></>}>
          <div className="space-y-4">
            <div>
              <label className="label">Trigger Name</label>
              <input className="input" value={form.name || ''} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Threshold Value</label>
                <input className="input" value={form.threshold || ''} onChange={(e) => setField('threshold', e.target.value)} />
              </div>
              <div>
                <label className="label">Status</label>
                <button type="button" onClick={() => setField('status', form.status === 'Active' ? 'Inactive' : 'Active')} className="flex items-center gap-2 text-sm mt-2">
                  {form.status === 'Active' ? <ToggleRight size={22} className="text-success-500" /> : <ToggleLeft size={22} className="text-surface-500" />}
                  <span className={form.status === 'Active' ? 'text-success-600' : 'text-surface-400'}>{form.status}</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
