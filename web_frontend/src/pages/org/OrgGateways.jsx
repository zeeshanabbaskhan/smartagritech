import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Eye, RefreshCw } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapGateway } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', serial: '', model: 'CF-G200', status: 'Online' }

export default function OrgGateways() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getGateways({ limit: 100 })).map(mapGateway),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(null)

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({ name: row.name, serial: row.serial, model: row.model, status: row.status })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        serialNumber: form.serial,
        model: form.model,
        status: form.status === 'Online' ? 'ONLINE' : 'OFFLINE',
      }
      if (modal === 'add') await emsApi.createGateway(body)
      else await emsApi.updateGateway(selected.id, body)
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async (row) => {
    setSyncing(row.id)
    try {
      await emsApi.getGateway(row.id)
      reload()
    } catch (_) {}
    setSyncing(null)
  }

  const columns = [
    { key: 'name', label: 'Gateway Name' },
    { key: 'serial', label: 'Serial Number', render: (v) => <span className="font-mono text-xs text-surface-400">{v}</span> },
    { key: 'model', label: 'Model' },
    { key: 'devices', label: 'Connected Devices', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">My Gateways</h2>
            <p className="breadcrumb">Organization / Gateways</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Gateway</button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search gateways..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button
                type="button"
                className={`btn-ghost p-1.5 ${syncing === row.id ? 'text-primary-600' : 'text-info-600'}`}
                onClick={() => handleSync(row)}
                title="Sync"
              >
                <RefreshCw size={14} className={syncing === row.id ? 'animate-spin' : ''} />
              </button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Gateway' : 'Edit Gateway'}
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
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Gateway Name" required placeholder="e.g. DELI-GW-002"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <TextInput label="Serial Number" required placeholder="e.g. SN-10030"
                value={form.serial} onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectInput label="Model" value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                options={['CF-G100', 'CF-G200', 'CF-G300']} />
              <SelectInput label="Status" value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                options={['Online', 'Offline']} />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Gateway Details">
          {selected && (
            <div className="space-y-3">
              {[['Name', selected.name], ['Serial Number', selected.serial], ['Model', selected.model], ['Connected Devices', selected.devices], ['Status', selected.status], ['Organization', selected.org]].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-36 flex-shrink-0">{label}</span>
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
