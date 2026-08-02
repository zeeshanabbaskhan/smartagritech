import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, TextareaInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, Package } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapProduct } from '../../utils/mappers'
import { uiStatusToApi, apiStatusToUi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', description: '', price: '', status: 'Active', file: null }

function toRow(p) {
  const mapped = mapProduct(p)
  return {
    ...mapped,
    status: apiStatusToUi(p.status),
    priceRaw: p.price,
    priceDisplay: p.price != null ? String(p.price) : '',
    imageUrl: p.imageUrl ?? mapped.imageUrl,
  }
}

export default function AdminProducts() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getProducts({ limit: 100 })).map(toRow),
    []
  )

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      description: row.description,
      price: row.priceDisplay,
      status: row.status,
      file: null,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (form.file) {
        const fd = new FormData()
        fd.append('name', form.name)
        if (form.description) fd.append('description', form.description)
        if (form.price !== '') fd.append('price', form.price)
        fd.append('status', uiStatusToApi(form.status))
        fd.append('imageFile', form.file)
        if (modal === 'add') await emsApi.createProduct(fd)
        else await emsApi.updateProduct(selected.id, fd)
      } else {
        const body = {
          name: form.name,
          description: form.description || undefined,
          price: form.price !== '' ? parseFloat(form.price) : null,
          status: uiStatusToApi(form.status),
        }
        if (modal === 'add') await emsApi.createProduct(body)
        else await emsApi.updateProduct(selected.id, body)
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
    if (!confirm(`Delete product "${row.name}"?`)) return
    try {
      await emsApi.deleteProduct(row.id)
      showToast('Product deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Product was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Product Name' },
    { key: 'price', label: 'Price', render: (v) => <span className="font-mono text-xs text-primary-600">{v}</span> },
    {
      key: 'image',
      label: 'Product Image',
      sortable: false,
      render: (_, row) => (
        <div className="w-12 h-12 rounded-lg bg-surface-100 dark:bg-surface-950 flex items-center justify-center text-surface-400 border border-surface-200 dark:border-surface-800 overflow-hidden">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.name} className="w-full h-full object-cover" />
          ) : (
            <Package size={20} />
          )}
        </div>
      ),
    },
    { key: 'description', label: 'Description', render: (v) => <span className="text-xs text-surface-500 line-clamp-2 max-w-md block">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Products</h2>
            <p className="breadcrumb">Manage Products &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Product</button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search products..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Product' : 'Edit Product'}
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
            <TextInput label="Product Name" required placeholder="e.g. Basic EMS"
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextareaInput label="Description" placeholder="Product description..."
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <TextInput label="Price" type="number" placeholder="e.g. 5000"
              value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            <div>
              <label className="label">Product Image</label>
              <input
                type="file"
                accept="image/*"
                className="w-full text-sm text-surface-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700 cursor-pointer"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
              />
            </div>
            <SelectInput label="Status" value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              options={['Active', 'Inactive']} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Product Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Name', selected.name],
                ['Description', selected.description],
                ['Price', selected.price],
                ['Status', selected.status],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
              {selected.imageUrl && (
                <div className="flex gap-4 items-start">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">Image</span>
                  <img src={selected.imageUrl} alt={selected.name} className="w-20 h-20 rounded-lg object-cover border border-surface-200" />
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
