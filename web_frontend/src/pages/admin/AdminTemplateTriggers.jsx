import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, TextareaInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmTemplate, mapOrganization, mapDeviceTemplate } from '../../utils/mappers'
import { uiOperatorToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const CONDITIONS = ['Greater Than', 'Less Than', 'Equal To', 'Greater or Equal', 'Less or Equal']
const METHODS = ['Email', 'SMS', 'WhatsApp']

const blankForm = {
  name: '', org: '', organizationId: '', template: '', deviceTemplateId: '', variable: '', condition: 'Greater Than',
  threshold: '', methods: [], message: '', status: 'Active',
}

export default function AdminTemplateTriggers() {
  const { showToast } = useToast()
  const { data: meta, loading: metaLoading } = useFetch(async () => {
    const [orgsRes, templatesRes] = await Promise.all([
      emsApi.getOrganizations({ limit: 100 }),
      emsApi.getDeviceTemplates({ limit: 100 }),
    ])
    return {
      organizations: list(orgsRes).map(mapOrganization),
      deviceTemplates: list(templatesRes).map(mapDeviceTemplate),
    }
  }, [])

  const { data: rows, loading, error, reload } = useFetch(async () => {
    const [templatesRes, orgsRes] = await Promise.all([
      emsApi.getAlarmTemplates({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    const orgMap = Object.fromEntries(list(orgsRes).map((o) => [o.id, mapOrganization(o).name]))
    return list(templatesRes).map((t) => ({
      ...mapAlarmTemplate(t),
      org: orgMap[t.organizationId] ?? t.organization?.name ?? '—',
      organizationId: t.organizationId,
    }))
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(blankForm); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      org: row.org,
      organizationId: row.organizationId ?? '',
      template: row.template,
      deviceTemplateId: row.deviceTemplateId ?? '',
      variable: row.variable,
      condition: row.condition,
      threshold: row.threshold,
      methods: row.methods ?? [],
      message: row.message ?? '',
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const toggleMethod = (m) => {
    setForm((f) => ({
      ...f,
      methods: f.methods.includes(m) ? f.methods.filter((x) => x !== m) : [...f.methods, m],
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        name: form.name,
        organizationId: form.organizationId || meta?.organizations.find((o) => o.name === form.org)?.id,
        deviceTemplateId: form.deviceTemplateId || meta?.deviceTemplates.find((t) => t.name === form.template)?.id,
        operator: uiOperatorToApi(form.condition),
        threshold: parseFloat(form.threshold) || 0,
        anomalyType: 'custom',
        priority: 'MEDIUM',
        isActive: form.status === 'Active',
      }
      if (modal === 'add') {
        await emsApi.createAlarmTemplate(body)
        showToast('Trigger created successfully')
      } else {
        await emsApi.updateAlarmTemplate(selected.id, body)
        showToast('Trigger updated successfully')
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
      showToast('Trigger deleted', 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const handleToggle = async (row) => {
    try {
      await emsApi.updateAlarmTemplate(row.id, { isActive: row.status !== 'Active' })
      reload()
    } catch (e) {
      showToast(e.message || 'Toggle failed', 'error')
    }
  }

  const methodBadge = (methods) => (
    <div className="flex gap-1 flex-wrap">
      {(methods?.length ? methods : ['—']).map((m) => (
        <span key={m} className={`badge ${m === 'Email' ? 'badge-info' : m === 'SMS' ? 'badge-warning' : m === 'WhatsApp' ? 'badge-success' : 'badge-neutral'}`}>{m}</span>
      ))}
    </div>
  )

  const columns = [
    { key: 'name', label: 'Trigger Name' },
    { key: 'org', label: 'Organization' },
    { key: 'template', label: 'Device Template' },
    { key: 'variable', label: 'Variable Name' },
    { key: 'condition', label: 'Condition', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'threshold', label: 'Threshold' },
    { key: 'methods', label: 'Push Method', render: (v) => methodBadge(v) },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
  ]

  return (
    <PageState loading={loading || metaLoading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Template Triggers</h2>
            <p className="breadcrumb">Admin / Alarms / Template Triggers</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Trigger</button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search triggers..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => handleToggle(row)} title="Toggle Status">
                {row.status === 'Active'
                  ? <ToggleRight size={14} className="text-success-600" />
                  : <ToggleLeft size={14} className="text-surface-500" />}
              </button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Template Trigger' : 'Edit Template Trigger'}
          size="lg"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Trigger Name" required placeholder="e.g. Overvoltage Alert"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <SelectInput label="Organization" required placeholder="Select organization"
                value={form.organizationId} onChange={(e) => {
                  const org = meta?.organizations.find((o) => o.id === e.target.value)
                  setForm((f) => ({ ...f, organizationId: e.target.value, org: org?.name ?? '' }))
                }}
                options={(meta?.organizations ?? []).map((o) => ({ value: o.id, label: o.name }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Device Template" required placeholder="Select template"
                value={form.deviceTemplateId} onChange={(e) => {
                  const t = meta?.deviceTemplates.find((x) => x.id === e.target.value)
                  setForm((f) => ({ ...f, deviceTemplateId: e.target.value, template: t?.name ?? '' }))
                }}
                options={(meta?.deviceTemplates ?? []).map((t) => ({ value: t.id, label: t.name }))} />
              <TextInput label="Variable Name" placeholder="e.g. Voltage Phase A"
                value={form.variable} onChange={(e) => setForm((f) => ({ ...f, variable: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Condition" value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                options={CONDITIONS} />
              <TextInput label="Threshold Value" placeholder="e.g. 240"
                value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} />
            </div>

            <div>
              <label className="label">Push Method</label>
              <div className="flex gap-4 mt-1">
                {METHODS.map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer text-sm text-surface-700">
                    <input
                      type="checkbox"
                      checked={form.methods.includes(m)}
                      onChange={() => toggleMethod(m)}
                      className="accent-primary-500"
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <TextareaInput label="Notification Message" placeholder="Enter message..."
              value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            <ToggleInput label="Status (Active)" checked={form.status === 'Active'}
              onChange={(v) => setForm((f) => ({ ...f, status: v ? 'Active' : 'Inactive' }))} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Trigger Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Trigger Name', selected.name],
                ['Organization', selected.org],
                ['Device Template', selected.template],
                ['Variable Name', selected.variable],
                ['Condition', selected.condition],
                ['Threshold', selected.threshold],
                ['Push Methods', selected.methods?.join(', ') || '—'],
                ['Message', selected.message || '—'],
                ['Status', selected.status],
              ].map(([label, value]) => (
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
