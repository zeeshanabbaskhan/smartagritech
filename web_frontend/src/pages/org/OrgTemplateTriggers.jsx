import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmTemplate, mapDeviceTemplate } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const OPERATORS = ['GT', 'LT', 'EQ', 'GTE', 'LTE']
const emptyForm = () => ({
  name: '',
  deviceTemplateId: '',
  templateVariableId: '',
  operator: 'GT',
  threshold: '',
  anomalyType: 'threshold',
  priority: 'MEDIUM',
})

export default function OrgTemplateTriggers() {
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const [triggersRes, templatesRes] = await Promise.all([
      emsApi.getAlarmTemplates({ limit: 100 }),
      emsApi.getDeviceTemplates({ limit: 100 }),
    ])
    return {
      rows: list(triggersRes).map(mapAlarmTemplate),
      templates: list(templatesRes).map(mapDeviceTemplate),
    }
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const rows = data?.rows ?? []
  const templates = data?.templates ?? []

  const openAdd = () => {
    setForm({ ...emptyForm(), deviceTemplateId: templates[0]?.id ?? '' })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      deviceTemplateId: row.deviceTemplateId,
      templateVariableId: row.templateVariableId,
      operator: row.operator,
      threshold: row.threshold,
      anomalyType: row.type ?? 'threshold',
      priority: row.priority ?? 'MEDIUM',
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        deviceTemplateId: form.deviceTemplateId,
        templateVariableId: form.templateVariableId,
        operator: form.operator,
        threshold: parseFloat(form.threshold),
        anomalyType: form.anomalyType,
        priority: form.priority,
      }
      if (modal === 'add') await emsApi.createAlarmTemplate(body)
      else await emsApi.updateAlarmTemplate(selected.id, body)
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete trigger "${row.name}"?`)) return
    try {
      await emsApi.deleteAlarmTemplate(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const columns = [
    { key: 'name', label: 'Trigger Name' },
    { key: 'templateName', label: 'Template Name', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
    { key: 'founder', label: 'Founder', render: (v) => <span className="text-xs">{v}</span> },
    { key: 'triggerCondition', label: 'Condition', render: (v) => <span className="badge badge-warning text-xs">{v}</span> },
    { key: 'updatedAt', label: 'Update Time', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Template Triggers</h2>
            <p className="breadcrumb">Organization / Template Triggers</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Trigger</button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search triggers..."
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
          title={modal === 'add' ? 'Add Template Trigger' : 'Edit Template Trigger'}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Trigger Name" required placeholder="e.g. High Voltage Alert" value={form.name} onChange={f('name')} />
              <SelectInput label="Template" required value={form.deviceTemplateId} onChange={f('deviceTemplateId')}
                placeholder="Select template"
                options={templates.map((t) => ({ value: t.id, label: t.name }))} />
            </div>
            <TextInput label="Template Variable ID" required placeholder="UUID of watched variable"
              value={form.templateVariableId} onChange={f('templateVariableId')} />
            <div className="grid grid-cols-2 gap-4">
              <SelectInput label="Operator" value={form.operator} onChange={f('operator')} options={OPERATORS} />
              <TextInput label="Threshold" placeholder="e.g. 240" type="number" value={form.threshold} onChange={f('threshold')} />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Trigger Details">
          {selected && (
            <div className="space-y-3">
              {[['Trigger Name', selected.name], ['Template', selected.templateName], ['Condition', selected.triggerCondition], ['Variable', selected.variable], ['Priority', selected.priority], ['Status', selected.status], ['Founder', selected.founder], ['Last Updated', selected.updatedAt]].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-32 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
