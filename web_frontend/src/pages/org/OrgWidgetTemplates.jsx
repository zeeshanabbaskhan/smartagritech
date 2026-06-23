import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { useToast } from '../../context/ToastContext'

const mapWidget = (w) => ({
  id: w.id,
  name: w.name,
  displayName: w.displayName ?? w.name,
  variableName: w.variableName ?? '—',
  widgetType: w.widgetType ?? '—',
  unit: w.unit ?? '—',
  position: w.position ?? 0,
  active: w.isActive !== false ? 'Active' : 'Inactive',
  _raw: w,
})

export default function OrgWidgetTemplates() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getWidgetTemplates({ limit: 100 })).map(mapWidget),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', displayName: '', variableName: '', widgetType: 'metric', unit: '', position: 0 })
  const [saving, setSaving] = useState(false)

  const openAdd = () => {
    setForm({ name: '', displayName: '', variableName: '', widgetType: 'metric', unit: '', position: 0 })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      displayName: row.displayName,
      variableName: row.variableName,
      widgetType: row.widgetType,
      unit: row.unit === '—' ? '' : row.unit,
      position: row.position,
    })
    setModal('edit')
  }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        displayName: form.displayName || form.name,
        variableName: form.variableName,
        widgetType: form.widgetType,
        unit: form.unit || undefined,
        position: Number(form.position) || 0,
      }
      if (modal === 'add') await emsApi.createWidgetTemplate(body)
      else await emsApi.updateWidgetTemplate(selected.id, body)
      showToast('Widget saved', 'success')
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete widget "${row.name}"?`)) return
    try {
      await emsApi.deleteWidgetTemplate(row.id)
      showToast('Widget deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Widget was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'displayName', label: 'Display Name' },
    { key: 'variableName', label: 'Variable' },
    { key: 'widgetType', label: 'Type' },
    { key: 'unit', label: 'Unit' },
    { key: 'position', label: 'Order' },
    { key: 'active', label: 'Status' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Widget Templates</h2>
            <p className="breadcrumb">Organization / Dashboard widgets</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Widget</button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search widgets..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)}><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)}><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={!!modal}
          onClose={close}
          title={modal === 'add' ? 'Add Widget' : 'Edit Widget'}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>Save</button>
            </>
          }
        >
          <div className="space-y-4">
            <TextInput label="Internal Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextInput label="Display Name" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            <TextInput label="Variable Name" required placeholder="e.g. PowerConsumption" value={form.variableName} onChange={(e) => setForm((f) => ({ ...f, variableName: e.target.value }))} />
            <SelectInput label="Widget Type" value={form.widgetType} onChange={(e) => setForm((f) => ({ ...f, widgetType: e.target.value }))} options={['metric', 'chart', 'gauge']} />
            <TextInput label="Unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            <TextInput label="Position" type="number" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
