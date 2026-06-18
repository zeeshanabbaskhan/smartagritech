import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Zap, Sun, Wind, Activity, Shield, Settings, Droplets, Cpu } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapIcon } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const ICON_COMPONENTS = [Zap, Sun, Wind, Activity, Shield, Settings, Droplets, Cpu]
const ICON_COLORS = [
  'bg-primary-600', 'bg-warning-600', 'bg-success-600', 'bg-danger-600',
  'bg-info-600', 'bg-primary-800', 'bg-success-800', 'bg-surface-600',
]

const blank = { name: '', file: null }

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
  const openEdit = (icon) => { setSelected(icon); setForm({ name: icon.name, file: null }); setModal('edit') }
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
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const imageUrl = (icon) => icon.url || icon._raw?.imageUrl

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Icons</h2>
            <p className="breadcrumb">Admin / Icons</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Icon</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(icons ?? []).map((icon, idx) => {
            const IconComp = ICON_COMPONENTS[idx % ICON_COMPONENTS.length]
            const colorCls = ICON_COLORS[idx % ICON_COLORS.length]
            const src = imageUrl(icon)
            return (
              <div key={icon.id} className="card p-5 flex flex-col items-center gap-3">
                <div className={`w-16 h-16 rounded-xl ${src ? 'bg-surface-100' : colorCls} flex items-center justify-center overflow-hidden`}>
                  {src ? (
                    <img src={src} alt={icon.name} className="w-full h-full object-contain" />
                  ) : (
                    <IconComp size={32} className="text-white" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-surface-900">{icon.name}</p>
                </div>
                <div className="flex gap-2 mt-1">
                  <button type="button" className="btn-ghost p-1.5 text-xs" onClick={() => openEdit(icon)} title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button type="button" className="btn-danger p-1.5 text-xs" onClick={() => handleDelete(icon)} title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

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
            <TextInput label="Icon Name" required placeholder="e.g. Energy Meter"
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
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
