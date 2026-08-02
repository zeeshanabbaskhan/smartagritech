import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Gauge } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapIcon } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', active: true, file: null }

export default function AdminManageIcons() {
  const { showToast } = useToast()
  const { data: icons, loading, error, reload } = useFetch(
    async () => list(await emsApi.getIcons({ limit: 100 })).map(mapIcon),
    []
  )

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (icon) => {
    setSelected(icon)
    setForm({ name: icon.name, active: icon.active !== false, file: null })
    setModal('edit')
  }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (modal === 'add' && !form.file) {
      showToast('Please select an image file to upload.', 'warning')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('status', form.active ? 'ACTIVE' : 'INACTIVE')
      if (form.file) fd.append('imageFile', form.file)
      if (modal === 'add') await emsApi.createIcon(fd)
      else await emsApi.updateIcon(selected.id, fd)
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (icon) => {
    if (!confirm(`Delete icon "${icon.name}"?`)) return
    try {
      await emsApi.deleteIcon(icon.id)
      showToast('Icon deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Icon was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const imageUrl = (icon) => icon.url || icon._raw?.imageUrl

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'icon',
      label: 'Icon',
      sortable: false,
      render: (_, row) => {
        const src = imageUrl(row)
        return (
          <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-950 flex items-center justify-center text-surface-700 dark:text-surface-300 overflow-hidden">
            {src ? (
              <img src={src} alt={row.name} className="w-full h-full object-contain" />
            ) : (
              <Gauge size={18} />
            )}
          </div>
        )
      },
    },
    {
      key: 'active',
      label: 'Active',
      render: (v) => (
        <span className={`badge ${v ? 'badge-success' : 'badge-neutral'}`}>
          {v ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Icons</h2>
            <p className="breadcrumb">Manage Icons &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Icon</button>
        </div>

        <DataTable
          columns={columns}
          data={icons ?? []}
          searchPlaceholder="Search icons..."
          emptyMessage="No data available in table"
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit">
                <Pencil size={13} />
              </button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete">
                <Trash2 size={13} />
              </button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Icon' : 'Edit Icon'}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : modal === 'add' ? 'Upload' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <TextInput label="Icon Name" required placeholder="e.g. AC"
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <div>
              <label className="label">Icon File{modal === 'add' ? ' (required)' : ' (optional)'}</label>
              <input
                type="file"
                accept="image/*"
                className="w-full text-sm text-surface-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700 cursor-pointer"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
              />
            </div>
            <ToggleInput label="Active" checked={form.active}
              onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
