import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, List } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDeviceTemplate, mapOrganization } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', organizationId: '', method: 'Modbus RTU' }

export default function AdminDeviceTemplates() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const [templatesRes, orgsRes] = await Promise.all([
      emsApi.getDeviceTemplates({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    const orgs = list(orgsRes).map(mapOrganization)
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]))
    const rows = list(templatesRes).map((t) => {
      const mapped = mapDeviceTemplate(t)
      return { ...mapped, org: orgMap[t.organizationId] ?? mapped.org }
    })
    return { rows, orgs }
  }, [])

  const rows = data?.rows ?? []
  const orgs = data?.orgs ?? []

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      organizationId: row.organizationId ?? '',
      method: row.method === '—' ? 'Modbus RTU' : row.method,
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
        organizationId: form.organizationId,
        acquisitionMethod: form.method,
      }
      if (modal === 'add') await emsApi.createDeviceTemplate(body)
      else await emsApi.updateDeviceTemplate(selected.id, { name: form.name, acquisitionMethod: form.method })
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete template "${row.name}"?`)) return
    try {
      await emsApi.deleteDeviceTemplate(row.id)
      showToast('Template deleted', 'success')
    } catch (e) {
      // 404 = the template was already removed on the server; the list is just
      // stale. Show an informational note instead of an error and let the
      // reload below drop the ghost row.
      if (e.status === 404) showToast('Template was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Template Name' },
    { key: 'org', label: 'Organization' },
    { key: 'variables', label: 'Variables', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'devices', label: 'Devices', render: (v) => <span className="badge badge-neutral">{v}</span> },
    { key: 'method', label: 'Communication Method' },
    { key: 'createdAt', label: 'Created' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Device Templates</h2>
            <p className="breadcrumb">Admin / Device Templates</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Template</button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search templates..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 text-info-600" onClick={() => navigate(`/admin/device-templates/${row.id}`)} title="Slaves & Variables"><List size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Template' : 'Edit Template'}
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
            <TextInput label="Template Name" required placeholder="e.g. CF Smart Main Panel"
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <SelectInput label="Organization" required placeholder="Select organization"
              value={form.organizationId} onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
              options={orgs.map((o) => ({ value: o.id, label: o.name }))}
              disabled={modal === 'edit'} />
            <SelectInput label="Communication Method"
              value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              options={['Modbus RTU', 'Modbus TCP', 'Modbus ASCII']} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Template Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Template Name', selected.name],
                ['Organization', selected.org],
                ['Variables', selected.variables],
                ['Devices', selected.devices],
                ['Method', selected.method],
                ['Created', selected.createdAt],
              ].map(([label, value]) => (
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
