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

const OPERATOR_OPTIONS = [
  { value: 'GT', label: '> Greater Than' },
  { value: 'LT', label: '< Less Than' },
  { value: 'EQ', label: '= Equal To' },
  { value: 'GTE', label: '>= Greater or Equal' },
  { value: 'LTE', label: '<= Less or Equal' },
]
const METHOD_OPTIONS = ['Email', 'SMS', 'WhatsApp']

function parseThresholdInput(raw) {
  if (raw == null || raw === '') return null
  const n = parseFloat(String(raw).replace(/[^0-9.+\-eE]/g, ''))
  return Number.isFinite(n) ? n : null
}

function methodsFromSetting(setting) {
  const raw = setting?.pushMethod || setting?.pushType || ''
  if (!raw) return ['Email']
  return String(raw).split(/[,|/]/).map((s) => s.trim()).filter(Boolean)
}

export default function UserAlarmTemplate() {
  const { selectedDevice } = useDevices()
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const [tplRes, setRes] = await Promise.all([
      emsApi.getAlarmTemplates({ limit: 100 }),
      emsApi.getAlarmSettings({ limit: 100 }).catch(() => ({ data: [] })),
    ])
    const settingsByTrigger = {}
    for (const s of list(setRes)) {
      if (s.templateTriggerId && !settingsByTrigger[s.templateTriggerId]) {
        settingsByTrigger[s.templateTriggerId] = s
      }
    }
    return {
      rows: list(tplRes).map((t) => {
        const m = mapAlarmTemplate(t)
        const setting = settingsByTrigger[t.id]
        const methods = methodsFromSetting(setting)
        const unit = t.watchedVariable?.unit || (m.variable?.toLowerCase().includes('voltage') ? 'V' : '')
        return {
          ...m,
          methods,
          method: methods[0] || 'Email',
          thresholdDisplay: unit ? `${m.threshold}${unit}` : m.threshold,
          threshold: m.threshold === '—' ? '' : m.threshold,
        }
      }),
    }
  }, [])

  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const rows = data?.rows ?? []

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      ...row,
      methods: Array.isArray(row.methods) && row.methods.length ? row.methods : (row.method ? [row.method] : ['Email']),
    })
  }

  const saveEdit = async () => {
    const thr = parseThresholdInput(form.threshold)
    if (thr == null) {
      showToast('Threshold must be a valid number', 'error')
      return
    }
    setSaving(true)
    try {
      await emsApi.updateAlarmTemplate(form.id, {
        name: form.name,
        operator: form.operator,
        threshold: thr,
        isActive: form.status === 'Active',
        methods: Array.isArray(form.methods) ? form.methods : [],
      })
      setEditing(null)
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleMethod = (m) => setForm((f) => {
    const cur = Array.isArray(f.methods) ? f.methods : []
    return { ...f, methods: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] }
  })

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
    { key: 'thresholdDisplay', label: 'Threshold' },
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
          <div className="text-xs text-surface-500 inset-panel px-3 py-1.5">
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
              {[['Trigger Name', viewing.name], ['Variable', viewing.variable], ['Condition', viewing.condition], ['Threshold', viewing.thresholdDisplay], ['Push Method', (viewing.methods || []).join(', ') || viewing.method], ['Status', viewing.status]].map(([label, val]) => (
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
            <div>
              <label className="label">Variable</label>
              <input className="input bg-surface-50 dark:bg-surface-950" value={form.variable || ''} disabled title="Variable is defined by the device template" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Condition</label>
                <select className="select" value={form.operator || 'GT'} onChange={(e) => setField('operator', e.target.value)}>
                  {OPERATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Threshold Value</label>
                <input className="input" value={form.threshold || ''} onChange={(e) => setField('threshold', e.target.value)} placeholder="e.g. 235" />
              </div>
            </div>
            <div>
              <label className="label">Push Method</label>
              <div className="flex flex-wrap gap-4 mt-1">
                {METHOD_OPTIONS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-surface-300 text-primary-600 accent-primary-500"
                      checked={Array.isArray(form.methods) && form.methods.includes(m)}
                      onChange={() => toggleMethod(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
              <p className="text-xs text-surface-400 mt-1">Applies to alarm settings linked to this template.</p>
            </div>
            <div>
              <label className="label">Status</label>
              <button type="button" onClick={() => setField('status', form.status === 'Active' ? 'Inactive' : 'Active')} className="flex items-center gap-2 text-sm mt-1">
                {form.status === 'Active' ? <ToggleRight size={22} className="text-success-500" /> : <ToggleLeft size={22} className="text-surface-500" />}
                <span className={form.status === 'Active' ? 'text-success-600' : 'text-surface-400'}>{form.status}</span>
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
