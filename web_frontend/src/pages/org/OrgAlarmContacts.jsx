import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, TextareaInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmContact } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const emptyForm = () => ({ name: '', phone: '', email: '', whatsapp: '', remark: '' })

export default function OrgAlarmContacts() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getAlarmContacts({ limit: 100 })).map(mapAlarmContact),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(emptyForm()); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({ name: row.name, phone: row.phone, email: row.email, whatsapp: row.whatsapp, remark: row.remark })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = { name: form.name, mobile: form.phone, email: form.email, whatsapp: form.whatsapp, remark: form.remark }
      if (modal === 'add') await emsApi.createAlarmContact(body)
      else await emsApi.updateAlarmContact(selected.id, body)
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
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const columns = [
    { key: 'name', label: 'Contact Name' },
    { key: 'phone', label: 'Mobile Phone', render: (v) => <span className="font-mono text-xs text-surface-700">{v}</span> },
    { key: 'email', label: 'Email', render: (v) => <span className="text-xs text-surface-700">{v}</span> },
    { key: 'whatsapp', label: 'WhatsApp', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
    { key: 'remark', label: 'Remark', render: (v) => <span className="text-xs text-surface-400 italic">{v}</span> },
    { key: 'updatedAt', label: 'Updated', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Alarm Contacts</h2>
            <p className="breadcrumb">Organization / Alarm Contacts</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Contact</button>
        </div>

        <DataTable columns={columns} data={rows ?? []} searchPlaceholder="Search contacts..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal open={modal === 'add' || modal === 'edit'} onClose={close}
          title={modal === 'add' ? 'Add Alarm Contact' : 'Edit Alarm Contact'}
          footer={<><button type="button" className="btn-secondary" onClick={close}>Cancel</button><button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save Changes'}</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Contact Name" required value={form.name} onChange={f('name')} />
              <TextInput label="Mobile Phone" required type="tel" value={form.phone} onChange={f('phone')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Email" required type="email" value={form.email} onChange={f('email')} />
              <TextInput label="WhatsApp" value={form.whatsapp} onChange={f('whatsapp')} />
            </div>
            <TextareaInput label="Remark" rows={2} value={form.remark} onChange={f('remark')} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Contact Details">
          {selected && (
            <div className="space-y-3">
              {[['Name', selected.name], ['Phone', selected.phone], ['Email', selected.email], ['WhatsApp', selected.whatsapp], ['Remark', selected.remark], ['Updated At', selected.updatedAt]].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-24 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800 break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
