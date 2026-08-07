import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Eye, Pencil, RefreshCw } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapGateway } from '../../utils/mappers'
import { uiGatewayStatusToApi, GATEWAY_STATUS_OPTIONS, gatewayStatusBadgeClass } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

export default function OrgGateways() {
  const { showToast } = useToast()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getGateways({ limit: 100 })).map(mapGateway),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', serial: '', model: 'CF-G200', status: 'Online' })
  const [syncing, setSyncing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [snQuery, setSnQuery] = useState('')
  const [applied, setApplied] = useState({ status: '', model: '', sn: '' })

  const openView = (row) => { setSelected(row); setModal('view') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      serial: row.serial,
      model: row.model === '—' ? 'CF-G200' : row.model,
      status: row.status,
    })
    setModal('edit')
  }
  const close = () => { setModal(null); setSelected(null) }

  const handleSync = async (row) => {
    setSyncing(row.id)
    try {
      await emsApi.getGateway(row.id)
      reload()
      showToast('Gateway refreshed', 'success')
    } catch (e) {
      showToast(e.message || 'Refresh failed', 'error')
    }
    setSyncing(null)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await emsApi.updateGateway(selected.id, {
        name: form.name,
        serialNumber: form.serial,
        model: form.model,
        status: uiGatewayStatusToApi(form.status),
      })
      showToast('Gateway updated', 'success')
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const filtered = (rows ?? []).filter((r) =>
    (!applied.status || r.status === applied.status) &&
    (!applied.model || r.model === applied.model) &&
    (!applied.sn
      || String(r.serial ?? '').toLowerCase().includes(applied.sn.toLowerCase())
      || String(r.name ?? '').toLowerCase().includes(applied.sn.toLowerCase()))
  )

  const totalCount = (rows ?? []).length
  const onlineCount = (rows ?? []).filter((d) => d.status === 'Online').length
  const offlineCount = (rows ?? []).filter((d) => d.status === 'Offline').length

  const columns = [
    { key: 'status', label: 'Gateway Status', render: (v) => <span className={`badge ${gatewayStatusBadgeClass(v)}`}>{v}</span> },
    { key: 'name', label: 'Gateway Name' },
    { key: 'serial', label: 'Serial Number', render: (v) => <span className="font-mono text-xs text-surface-400">{v}</span> },
    { key: 'model', label: 'Model' },
    { key: 'devices', label: 'Connected Devices', render: (v) => <span className="badge badge-info">{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">My Gateways</h2>
            <p className="breadcrumb">Organization / Gateways</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
          <span className="text-surface-600">Total Gateways <strong className="text-surface-900 dark:text-surface-100">{totalCount}</strong></span>
          <span className="text-surface-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success-600 inline-block" /> Online <strong className="text-surface-900 dark:text-surface-100">{onlineCount}</strong>
          </span>
          <span className="text-surface-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-surface-400 inline-block" /> Offline <strong className="text-surface-900 dark:text-surface-100">{offlineCount}</strong>
          </span>
        </div>

        <div className="card p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <SelectInput
              label="Status"
              className="w-44"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={GATEWAY_STATUS_OPTIONS}
              placeholder="All status"
            />
            <SelectInput
              label="Model"
              className="w-36"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              options={['CF-G200', 'CF-G100']}
              placeholder="All"
            />
            <TextInput
              label="Name / SN"
              className="w-44"
              value={snQuery}
              onChange={(e) => setSnQuery(e.target.value)}
              placeholder="Search…"
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => setApplied({ status: statusFilter, model: modelFilter, sn: snQuery })}
            >
              Query
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search gateways..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button
                type="button"
                className={`btn-ghost p-1.5 ${syncing === row.id ? 'text-primary-600' : 'text-info-600'}`}
                onClick={() => handleSync(row)}
                title="Refresh"
              >
                <RefreshCw size={14} className={syncing === row.id ? 'animate-spin' : ''} />
              </button>
            </>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Gateway Details">
          {selected && (
            <div className="space-y-3">
              {[['Name', selected.name], ['Serial Number', selected.serial], ['Model', selected.model], ['Connected Devices', selected.devices], ['Status', selected.status]].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-36 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800 dark:text-surface-100">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>

        <Modal
          open={modal === 'edit'}
          onClose={close}
          title="Edit Gateway"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <TextInput label="Gateway Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextInput label="Serial Number" value={form.serial} onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))} />
            <SelectInput label="Model" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} options={['CF-G200', 'CF-G100']} />
            <SelectInput label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={GATEWAY_STATUS_OPTIONS} />
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
