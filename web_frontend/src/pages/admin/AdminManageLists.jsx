import { useState, useEffect, useMemo } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, TextareaInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, List } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { useToast } from '../../context/ToastContext'

import { LIST_TYPE_NAMES } from '../../data/managedLists'

const blank = { name: '', listTypeId: '', description: '' }

export default function AdminManageLists() {
  const { showToast } = useToast()
  const { data: meta, loading, error, reload } = useFetch(async () => {
    const typesRes = await emsApi.getListTypes({ limit: 100 })
    const types = list(typesRes)
    // Ensure core types exist (idempotent create)
    const needed = [
      { name: LIST_TYPE_NAMES.PROTOCOLS, description: 'IoT communication protocols and drivers' },
      { name: LIST_TYPE_NAMES.ACQUISITION, description: 'Device template acquisition methods' },
      { name: LIST_TYPE_NAMES.PRODUCTS, description: 'Product catalog entries' },
    ]
    for (const t of needed) {
      if (!types.find((x) => x.name === t.name)) {
        try {
          await emsApi.createListType(t)
        } catch (_) { /* race / already exists */ }
      }
    }
    const refreshed = list(await emsApi.getListTypes({ limit: 100 }))
    const itemsByType = {}
    await Promise.all(
      refreshed.map(async (t) => {
        const itemsRes = await emsApi.getListItems(t.id, { limit: 200, isActive: undefined })
        itemsByType[t.id] = list(itemsRes).map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description ?? '',
          listTypeId: t.id,
          listTypeName: t.name,
          isActive: i.isActive !== false,
          _raw: i,
        }))
      })
    )
    return { types: refreshed, itemsByType }
  }, [])

  const types = meta?.types ?? []
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!types.length || typeFilter) return
    const protocols = types.find((t) => t.name === LIST_TYPE_NAMES.PROTOCOLS)
    setTypeFilter(protocols?.id || types[0].id)
  }, [types, typeFilter])

  const rows = useMemo(() => {
    if (!meta?.itemsByType) return []
    if (typeFilter) return meta.itemsByType[typeFilter] ?? []
    return Object.values(meta.itemsByType).flat()
  }, [meta, typeFilter])

  const typeOptions = types.map((t) => ({ value: t.id, label: t.name }))

  const openAdd = () => {
    setForm({ ...blank, listTypeId: typeFilter || types[0]?.id || '' })
    setModal('add')
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      listTypeId: row.listTypeId,
      description: row.description || '',
    })
    setModal('edit')
  }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Name is required', 'warning')
      return
    }
    if (!form.listTypeId) {
      showToast('Type is required', 'warning')
      return
    }
    setSaving(true)
    try {
      const body = { name: form.name.trim(), description: form.description.trim() || null }
      if (modal === 'add') await emsApi.createListItem(form.listTypeId, body)
      else await emsApi.updateListItem(form.listTypeId, selected.id, body)
      showToast(modal === 'add' ? 'List item created' : 'List item updated', 'success')
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete "${row.name}"?`)) return
    try {
      await emsApi.deleteListItem(row.listTypeId, row.id)
      showToast('List item deleted', 'success')
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'listTypeName', label: 'Category' },
    { key: 'name', label: 'Protocol Name' },
    {
      key: 'description',
      label: 'Alias / Description',
      render: (v, row) => v || row.name,
    },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-950/30 rounded-xl">
              <List size={20} className="text-primary-600" />
            </div>
            <div>
              <h2 className="page-title">Manage List</h2>
              <p className="breadcrumb">Admin / Others / Manage List</p>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add List Item
          </button>
        </div>

        <div className="card p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-surface-500 uppercase">Type</span>
          <select
            className="select text-xs py-1.5 px-2 w-auto min-w-[220px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search list items..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5 text-info-600" onClick={() => openEdit(row)} title="Edit">
                <Pencil size={14} />
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
          title={modal === 'add' ? 'Add List Item' : 'Edit List Item'}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Close</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Submit'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <TextInput
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <SelectInput
              label="Type"
              required
              value={form.listTypeId}
              onChange={(e) => setForm((f) => ({ ...f, listTypeId: e.target.value }))}
              options={typeOptions}
              disabled={modal === 'edit'}
            />
            <TextareaInput
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
