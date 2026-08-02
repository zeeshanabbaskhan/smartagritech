import { useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmTemplate, mapDeviceTemplate } from '../../utils/mappers'
import { uiOperatorToApi } from '../../utils/apiForm'

const conditionOptions = ['>', '<', '=', '>=', '<=']
const conditionToApi = { '>': 'GT', '<': 'LT', '=': 'EQ', '>=': 'GTE', '<=': 'LTE' }
const apiToCondition = { GT: '>', LT: '<', EQ: '=', GTE: '>=', LTE: '<=' }

const blank = {
  name: '',
  org: '',
  deviceTemplateId: '',
  templateVariableId: '',
  condition: '>',
  threshold: '',
  status: 'Active',
}

export default function UserAlarmTemplate() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [variables, setVariables] = useState([])
  const [varsLoading, setVarsLoading] = useState(false)

  const { data, loading, error, reload } = useFetch(async () => {
    const [rowsRes, templatesRes] = await Promise.all([
      emsApi.getAlarmTemplates({ limit: 100 }),
      emsApi.getDeviceTemplates({ limit: 100 }),
    ])
    return {
      rows: list(rowsRes).map(mapAlarmTemplate),
      templates: list(templatesRes).map(mapDeviceTemplate),
    }
  }, [])

  const templates = data?.templates ?? []

  useEffect(() => {
    let cancelled = false
    const loadVars = async () => {
      if (!form.deviceTemplateId) {
        setVariables([])
        return
      }
      setVarsLoading(true)
      try {
        const slavesRes = await emsApi.getTemplateSlaves(form.deviceTemplateId)
        const slaves = list(slavesRes)
        const all = []
        for (const slave of slaves) {
          const vRes = await emsApi.getTemplateVariables(form.deviceTemplateId, slave.id).catch(() => ({ data: [] }))
          for (const v of list(vRes)) {
            all.push({
              id: v.id,
              label: `${v.displayName || v.name}${slave.name ? ` (${slave.name})` : ''}`,
            })
          }
        }
        if (!cancelled) setVariables(all)
      } catch {
        if (!cancelled) setVariables([])
      } finally {
        if (!cancelled) setVarsLoading(false)
      }
    }
    loadVars()
    return () => { cancelled = true }
  }, [form.deviceTemplateId])

  const openAdd = () => {
    setForm({
      ...blank,
      org: user?.organization?.name ?? '—',
      deviceTemplateId: templates[0]?.id ?? '',
    })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      org: row.org,
      deviceTemplateId: row.deviceTemplateId ?? '',
      templateVariableId: row.templateVariableId ?? '',
      condition: apiToCondition[row.operator] || '>',
      threshold: row.threshold === '—' ? '' : row.threshold,
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (!form.deviceTemplateId) {
      showToast('Select a device template', 'error')
      return
    }
    if (!form.templateVariableId) {
      showToast('Select a template variable', 'error')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        deviceTemplateId: form.deviceTemplateId,
        templateVariableId: form.templateVariableId,
        operator: conditionToApi[form.condition] || uiOperatorToApi(form.condition),
        threshold: parseFloat(form.threshold),
        isActive: form.status === 'Active',
        organizationId: user?.organizationId,
      }
      if (modal === 'add') {
        await emsApi.createAlarmTemplate(body)
      } else {
        await emsApi.updateAlarmTemplate(selected.id, body)
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
    if (!confirm(`Delete trigger "${row.name}"?`)) return
    try {
      await emsApi.deleteAlarmTemplate(row.id)
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
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

  const columns = [
    { key: 'name', label: 'Trigger Name' },
    { key: 'org', label: 'Organization' },
    { key: 'template', label: 'Template Name' },
    { key: 'founder', label: 'Founder' },
    { key: 'updatedAt', label: 'Update Time' },
  ]

  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }))
  const variableOptions = variables.map((v) => ({ value: v.id, label: v.label }))

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Alarm Templates</h2>
            <p className="breadcrumb">Manage Alarm Templates &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Alarm Templates</button>
        </div>

        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          searchPlaceholder="Search alarm templates..."
          emptyMessage="No data available in table"
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => toggle(row)} title="Toggle Status">
                {row.status === 'Active' ? <ToggleRight size={14} className="text-success-600" /> : <ToggleLeft size={14} className="text-surface-500" />}
              </button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Alarm Template' : 'Edit Alarm Template'}
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
              label="Trigger Name"
              required
              placeholder="e.g. Overvoltage"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <SelectInput
              label="Template Name"
              required
              placeholder="Select template"
              value={form.deviceTemplateId}
              onChange={(e) => setForm((f) => ({ ...f, deviceTemplateId: e.target.value, templateVariableId: '' }))}
              options={templateOptions}
            />
            <SelectInput
              label="Variable"
              required
              placeholder={varsLoading ? 'Loading variables…' : 'Select variable'}
              value={form.templateVariableId}
              onChange={(e) => setForm((f) => ({ ...f, templateVariableId: e.target.value }))}
              options={variableOptions}
            />
            <div className="grid grid-cols-2 gap-4">
              <SelectInput
                label="Condition"
                value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                options={conditionOptions}
              />
              <TextInput
                label="Threshold"
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
              />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Alarm Template Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Trigger Name', selected.name],
                ['Organization', selected.org],
                ['Template Name', selected.template],
                ['Variable', selected.variable],
                ['Condition', apiToCondition[selected.operator] || selected.condition],
                ['Threshold', selected.threshold],
                ['Founder', selected.founder],
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
