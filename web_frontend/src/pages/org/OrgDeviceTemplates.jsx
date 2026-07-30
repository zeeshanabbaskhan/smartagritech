import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Eye, Pencil, Trash2, List } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDeviceTemplate } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', method: 'Modbus RTU' }

export default function OrgDeviceTemplates() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getDeviceTemplates({ limit: 100 })).map(mapDeviceTemplate),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const openAdd = () => {
    setForm(blank)
    setSelected(null)
    setModal('add')
  }

  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      method: row.method === '—' ? 'Modbus RTU' : row.method,
    })
    setModal('edit')
  }

  const openView = (row) => {
    setSelected(row)
    setModal('view')
  }

  const close = () => {
    setModal(null)
    setSelected(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Template name is required', 'error')
      return
    }
    setSaving(true)
    try {
      if (modal === 'add') {
        // Org is taken from the logged-in ORG_ADMIN session on the backend
        await emsApi.createDeviceTemplate({
          name: form.name.trim(),
          acquisitionMethod: form.method,
        })
        showToast('Template created', 'success')
      } else {
        await emsApi.updateDeviceTemplate(selected.id, {
          name: form.name.trim(),
          acquisitionMethod: form.method,
        })
        showToast('Template updated', 'success')
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
    if (!confirm(`Delete template "${row.name}"?`)) return
    try {
      await emsApi.deleteDeviceTemplate(row.id)
      showToast('Template deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Template was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Template Name' },
    { key: 'variables', label: 'Variables Count', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'devices', label: 'Devices Using It', render: (v) => <span className="badge badge-neutral">{v}</span> },
    {
      key: 'method',
      label: 'Communication Method',
      render: (v) => (
        <span className={`badge ${v === 'Modbus TCP' ? 'badge-success' : 'badge-warning'}`}>{v}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Last Updated',
      render: (v) => <span className="text-xs text-surface-400">{v}</span>,
    },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Device Templates</h2>
            <p className="breadcrumb">Organization / Device Templates</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Template
          </button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search templates..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View">
                <Eye size={14} />
              </button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit">
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="btn-ghost p-1.5 text-info-600"
                onClick={() => navigate(`/org/device-templates/${row.id}`)}
                title="Slaves & Variables"
              >
                <List size={14} />
              </button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete">
                <Trash2 size={14} />
              </button>
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
            <TextInput
              label="Template Name"
              required
              placeholder="e.g. EMS PANEL"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <SelectInput
              label="Communication Method"
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              options={['Modbus RTU', 'Modbus TCP', 'Modbus ASCII']}
            />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Template Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Template Name', selected.name],
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
              <p className="text-xs text-surface-500 pt-2">
                Use the list icon to add slaves and register-address variables for MQTT mapping.
              </p>
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
