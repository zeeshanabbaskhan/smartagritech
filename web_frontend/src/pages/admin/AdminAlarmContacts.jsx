import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, TextareaInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmContact, mapOrganization } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const ADD_PEOPLE_OPTIONS = ['App-Admin', 'Org-Admin', 'User']

const blankForm = {
  name: '', org: '', organizationId: '', phone: '', email: '', whatsapp: '', remark: '', addPeople: 'App-Admin',
}

export default function AdminAlarmContacts() {
  const { showToast } = useToast()
  const { data: meta, loading: metaLoading } = useFetch(async () => {
    const orgsRes = await emsApi.getOrganizations({ limit: 100 })
    return { organizations: list(orgsRes).map(mapOrganization) }
  }, [])

  const { data: rows, loading, error, reload } = useFetch(async () => {
    const [contactsRes, orgsRes] = await Promise.all([
      emsApi.getAlarmContacts({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    const orgMap = Object.fromEntries(list(orgsRes).map((o) => [o.id, o.name]))
    return list(contactsRes).map((c) => mapAlarmContact(c, orgMap[c.organizationId]))
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)

  const [orgFilter, setOrgFilter] = useState('')
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState({ organizationId: '', query: '' })

  const handleQuery = () => setApplied({ organizationId: orgFilter, query })

  const filteredRows = (rows ?? []).filter((r) =>
    (!applied.organizationId || r.organizationId === applied.organizationId) &&
    (!applied.query || r.name.toLowerCase().includes(applied.query.toLowerCase()) || String(r.phone).includes(applied.query))
  )

  const openAdd = () => { setForm(blankForm); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      org: row.org,
      organizationId: row.organizationId ?? '',
      phone: row.phone === '—' ? '' : row.phone,
      email: row.email === '—' ? '' : row.email,
      whatsapp: row.whatsapp === '—' ? '' : row.whatsapp,
      remark: row.remark ?? '',
      addPeople: ADD_PEOPLE_OPTIONS.includes(row.addPeople) ? row.addPeople : (row.addPeople && row.addPeople !== '—' ? row.addPeople : 'App-Admin'),
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        name: form.name,
        organizationId: form.organizationId || meta?.organizations.find((o) => o.name === form.org)?.id,
        mobile: form.phone,
        email: form.email,
        whatsapp: form.whatsapp,
        remark: form.remark,
      }
      if (modal === 'add') {
        await emsApi.createAlarmContact(body)
        showToast('Alarm contact added successfully')
      } else {
        await emsApi.updateAlarmContact(selected.id, body)
        showToast('Alarm contact updated successfully')
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
    if (!confirm(`Delete contact "${row.name}"?`)) return
    try {
      await emsApi.deleteAlarmContact(row.id)
      showToast('Contact deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Contact was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected contact(s)?`)) return
    setDeleting(true)
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => emsApi.deleteAlarmContact(id)))
      const failed = results.filter((r) => r.status === 'rejected' && r.reason?.status !== 404)
      if (failed.length) showToast(`${failed.length} contact(s) failed to delete`, 'error')
      else showToast('Selected contacts deleted', 'success')
      setSelectedIds([])
    } finally {
      setDeleting(false)
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Contact Name' },
    { key: 'org', label: 'Organization' },
    { key: 'phone', label: 'Mobile Phone', render: (v) => <span className="text-xs">{v || '—'}</span> },
    { key: 'email', label: 'Email' },
    { key: 'whatsapp', label: 'Whatsapp' },
    { key: 'remark', label: 'Remark' },
    { key: 'addPeople', label: 'Add People' },
    { key: 'updatedAt', label: 'Update Time' },
  ]

  return (
    <PageState loading={loading || metaLoading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Alarm linkage</h2>
            <p className="breadcrumb">Alarm contacts &ndash; Contacts List</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add</button>
            <button type="button" className="btn-secondary" onClick={handleBatchDelete} disabled={!selectedIds.length || deleting}>
              {deleting ? 'Deleting...' : 'Batch Delete'}
            </button>
          </div>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <SelectInput label="Organization" placeholder="All" value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                options={(meta?.organizations ?? []).map((o) => ({ value: o.id, label: o.name }))} />
            </div>
            <div className="flex-1 min-w-48">
              <TextInput label="Contact" placeholder="Contact name, phone number"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={handleQuery}>Query</button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredRows}
          searchPlaceholder="Search contacts..."
          emptyMessage="No data available in table"
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
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
          title={modal === 'add' ? 'Add Alarm Contact' : 'Edit Alarm Contact'}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Full Name" required placeholder="e.g. Huzaifa Ahmed"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <SelectInput label="Organization" required placeholder="Select organization"
                value={form.organizationId} onChange={(e) => {
                  const org = meta?.organizations.find((o) => o.id === e.target.value)
                  setForm((f) => ({ ...f, organizationId: e.target.value, org: org?.name ?? '' }))
                }}
                options={(meta?.organizations ?? []).map((o) => ({ value: o.id, label: o.name }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Mobile Phone" placeholder="+92-300-0000000"
                value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <TextInput label="WhatsApp Number" placeholder="+92-300-0000000"
                value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
            </div>
            <TextInput label="Email Address" type="email" placeholder="contact@example.com"
              value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <SelectInput label="Add People" value={form.addPeople}
              onChange={(e) => setForm((f) => ({ ...f, addPeople: e.target.value }))}
              options={ADD_PEOPLE_OPTIONS.includes(form.addPeople) || !form.addPeople
                ? ADD_PEOPLE_OPTIONS
                : [form.addPeople, ...ADD_PEOPLE_OPTIONS]} />
            <TextareaInput label="Remark" placeholder="e.g. Primary on-call contact"
              value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Contact Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Full Name', selected.name],
                ['Organization', selected.org],
                ['Mobile Phone', selected.phone],
                ['Email', selected.email],
                ['WhatsApp', selected.whatsapp],
                ['Remark', selected.remark],
                ['Add People', selected.addPeople],
                ['Update Time', selected.updatedAt],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-32 flex-shrink-0">{label}</span>
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
