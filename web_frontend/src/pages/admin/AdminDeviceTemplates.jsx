import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, TextareaInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, List } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDeviceTemplate, mapOrganization } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const blankQuery = { organizationId: '', name: '' }

const blank = { name: '', organizationId: '', method: 'Edge Computing', description: '' }

const ACQUISITION_METHODS = ['Edge Computing', 'Modbus RTU', 'Modbus TCP', 'Modbus ASCII']

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
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)

  const [orgFilter, setOrgFilter] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [applied, setApplied] = useState(blankQuery)

  const handleQuery = () => setApplied({ organizationId: orgFilter, name: nameQuery })

  const filteredRows = rows.filter((r) =>
    (!applied.organizationId || r.organizationId === applied.organizationId) &&
    (!applied.name || r.name.toLowerCase().includes(applied.name.toLowerCase()))
  )

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      organizationId: row.organizationId ?? '',
      method: row.method === '—' ? 'Edge Computing' : row.method,
      description: row.description ?? '',
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
      if (e.status === 404) showToast('Template was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected template(s)?`)) return
    setDeleting(true)
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => emsApi.deleteDeviceTemplate(id)))
      const failed = results.filter((r) => r.status === 'rejected' && r.reason?.status !== 404)
      if (failed.length) showToast(`${failed.length} template(s) failed to delete`, 'error')
      else showToast('Selected templates deleted', 'success')
      setSelectedIds([])
    } finally {
      setDeleting(false)
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Template Name' },
    { key: 'org', label: 'Organization' },
    { key: 'variables', label: 'Total No Of Variables' },
    { key: 'devices', label: 'NO Of Associated Devices' },
    { key: 'method', label: 'Acquisition Methods' },
    { key: 'updatedAt', label: 'Update Time' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Device Templates</h2>
            <p className="breadcrumb">Manage Device Templates &ndash; List</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Template</button>
            <button type="button" className="btn-secondary" onClick={handleBatchDelete} disabled={!selectedIds.length || deleting}>
              {deleting ? 'Deleting...' : 'Batch Delete'}
            </button>
          </div>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <SelectInput label="Organization" placeholder="All" value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                options={orgs.map((o) => ({ value: o.id, label: o.name }))} />
            </div>
            <div className="flex-1 min-w-48">
              <TextInput label="Template Name" placeholder="Please input template name"
                value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={handleQuery}>Query</button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredRows}
          searchPlaceholder="Search templates..."
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 text-info-600" onClick={() => navigate(`/admin/device-templates/${row.id}/slaves`)} title="Slaves & Variables"><List size={14} /></button>
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
            <SelectInput label="Acquisition Method"
              value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              options={ACQUISITION_METHODS} />
            <TextareaInput label="Description" placeholder="Template description..."
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Template Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Template Name', selected.name],
                ['Organization', selected.org],
                ['Total No Of Variables', selected.variables],
                ['NO Of Associated Devices', selected.devices],
                ['Acquisition Methods', selected.method],
                ['Update Time', selected.updatedAt],
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
