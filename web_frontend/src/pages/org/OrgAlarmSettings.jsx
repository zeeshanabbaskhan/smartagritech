import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmSetting, mapAlarmTemplate } from '../../utils/mappers'
import { uiStatusToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const emptyForm = () => ({
  name: '',
  templateTriggerId: '',
  pushType: 'Template Trigger',
  pushMethod: 'Email',
  mechanism: 'Instant',
  status: 'Active',
})

export default function OrgAlarmSettings({ pageTitle = 'Alarm Settings', breadcrumb = 'Organization / Alarm Settings' }) {
  const { showToast } = useToast()
  const { data: triggers = [] } = useFetch(
    async () => list(await emsApi.getAlarmTemplates({ limit: 100 })).map(mapAlarmTemplate),
    []
  )
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getAlarmSettings({ limit: 100 })).map(mapAlarmSetting),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(emptyForm()); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      templateTriggerId: row.templateTriggerId ?? '',
      pushType: row.pushType,
      pushMethod: row.pushMethod,
      mechanism: row.mechanism,
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (modal === 'add' && !form.templateTriggerId && !triggers[0]?.id) {
      showToast('Create a template trigger first', 'warning')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        templateTriggerId: form.templateTriggerId || triggers[0]?.id,
        pushType: form.pushType,
        pushMethod: form.pushMethod,
        pushingMechanism: form.mechanism === 'Delayed' ? 'DELAYED' : 'INSTANT',
        status: uiStatusToApi(form.status),
      }
      if (modal === 'add') await emsApi.createAlarmSetting(body)
      else await emsApi.updateAlarmSetting(selected.id, body)
      showToast(modal === 'add' ? 'Alarm setting created' : 'Alarm setting updated', 'success')
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete alarm setting "${row.name}"?`)) return
    try {
      await emsApi.deleteAlarmSetting(row.id)
      showToast('Alarm setting deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Alarm setting was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const columns = [
    { key: 'name', label: 'Configuration Name' },
    { key: 'pushType', label: 'Push Type', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'pushMethod', label: 'Push Method', render: (v) => <span className="badge badge-neutral">{v}</span> },
    { key: 'mechanism', label: 'Mechanism', render: (v) => <span className={`badge ${v === 'Instant' ? 'badge-success' : 'badge-warning'}`}>{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
    { key: 'updatedAt', label: 'Updated', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">{pageTitle}</h2>
            <p className="breadcrumb">{breadcrumb}</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Configuration</button>
        </div>

        <DataTable columns={columns} data={rows ?? []} searchPlaceholder="Search alarm settings..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal open={modal === 'add' || modal === 'edit'} onClose={close}
          title={modal === 'add' ? 'Add Alarm Configuration' : 'Edit Alarm Configuration'}
          footer={<><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Configuration Name" required value={form.name} onChange={f('name')} />
              <SelectInput
                label="Template Trigger"
                required
                placeholder="Select trigger"
                value={form.templateTriggerId}
                onChange={f('templateTriggerId')}
                options={triggers.map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Push Type" value={form.pushType} onChange={f('pushType')} options={['Template Trigger', 'Custom']} />
              <SelectInput label="Push Method" value={form.pushMethod} onChange={f('pushMethod')} options={['Email', 'SMS', 'WhatsApp']} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Pushing Mechanism" value={form.mechanism} onChange={f('mechanism')} options={['Instant', 'Delayed']} />
              <SelectInput label="Status" value={form.status} onChange={f('status')} options={['Active', 'Inactive']} />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Alarm Configuration Details">
          {selected && (
            <div className="space-y-3">
              {[['Name', selected.name], ['Push Type', selected.pushType], ['Push Method', selected.pushMethod], ['Mechanism', selected.mechanism], ['Status', selected.status], ['Updated At', selected.updatedAt]].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
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
