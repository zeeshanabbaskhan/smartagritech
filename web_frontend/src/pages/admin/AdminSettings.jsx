import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, TextareaInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapSetting } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const TYPES = ['Logo', 'Text', 'Number', 'Color']
const blankForm = { key: '', type: 'Logo', value: '', description: '', file: null }

export default function AdminSettings() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getSettings()).map(mapSetting),
    []
  )

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)

  const [typeFilter, setTypeFilter] = useState('')
  const [keyQuery, setKeyQuery] = useState('')
  const [applied, setApplied] = useState({ type: '', key: '' })

  const openAdd = () => { setForm(blankForm); setSelected(null); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      key: row.key,
      type: row.type || 'Text',
      value: row.type === 'Logo' ? '' : (row.value ?? ''),
      description: row.description ?? '',
      file: null,
    })
    setModal('edit')
  }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.key.trim()) return
    if (form.type === 'Logo' && modal === 'add' && !form.file) {
      showToast('Please upload an image for Logo settings.', 'warning')
      return
    }
    setSaving(true)
    try {
      const key = form.key.trim()
      if (form.type === 'Logo' && form.file) {
        const fd = new FormData()
        fd.append('type', form.type)
        fd.append('description', form.description || '')
        fd.append('imageFile', form.file)
        await emsApi.upsertSetting(key, fd)
      } else if (form.type === 'Logo') {
        await emsApi.upsertSetting(key, {
          type: form.type,
          description: form.description || '',
          ...(selected?.value ? { value: selected.value } : {}),
        })
      } else {
        await emsApi.upsertSetting(key, {
          type: form.type,
          value: form.value,
          description: form.description || '',
        })
      }
      showToast(modal === 'add' ? 'Setting created successfully' : 'Setting updated successfully')
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete setting "${row.key}"?`)) return
    try {
      await emsApi.deleteSetting(row.key)
      showToast('Setting deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Setting was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const handleQuery = () => setApplied({ type: typeFilter, key: keyQuery })

  const filtered = (rows ?? []).filter((r) =>
    (!applied.type || r.type === applied.type)
    && (!applied.key || r.key.toLowerCase().includes(applied.key.toLowerCase()))
  )

  const columns = [
    { key: 'key', label: 'Key', render: (v) => <span className="text-primary-600 font-medium">{v}</span> },
    { key: 'type', label: 'Type', render: (v) => <span className="badge badge-info">{v}</span> },
    {
      key: 'preview',
      label: 'Value Preview',
      sortable: false,
      render: (v, row) => {
        if (v) {
          return <img src={v} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-surface-200" />
        }
        if (row.type === 'Logo') {
          return (
            <div className="w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-950 flex items-center justify-center text-surface-400">
              <ImageIcon size={16} />
            </div>
          )
        }
        return <span className="text-xs text-surface-600 truncate max-w-[140px] block" title={row.value}>{row.value || '—'}</span>
      },
    },
    { key: 'description', label: 'Description', render: (v) => <span className="text-xs text-surface-500">{v || '—'}</span> },
    { key: 'updatedAt', label: 'Last Updated' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Settings</h2>
            <p className="breadcrumb">Manage Settings &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Setting
          </button>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <SelectInput
                label="Setting Type"
                placeholder="Setting Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={TYPES}
              />
            </div>
            <div className="flex-1 min-w-48">
              <TextInput
                label="Key"
                placeholder="Search by key..."
                value={keyQuery}
                onChange={(e) => setKeyQuery(e.target.value)}
              />
            </div>
            <button type="button" className="btn-primary" onClick={handleQuery}>Query</button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search settings..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Setting' : 'Edit Setting'}
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
              label="Key"
              required
              placeholder="e.g. AdminLoginLogo"
              value={form.key}
              disabled={modal === 'edit'}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            />
            <SelectInput
              label="Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, file: null, value: '' }))}
              options={TYPES}
            />
            {form.type === 'Logo' ? (
              <div>
                <label className="label">Upload Image</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-sm text-surface-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700 cursor-pointer"
                  onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
                />
                {modal === 'edit' && selected?.preview && !form.file && (
                  <img src={selected.preview} alt="current" className="mt-2 w-16 h-16 rounded-lg object-cover border border-surface-200" />
                )}
              </div>
            ) : (
              <TextInput
                label="Value"
                placeholder="Setting value"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            )}
            <TextareaInput
              label="Description"
              placeholder="What this setting controls..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
