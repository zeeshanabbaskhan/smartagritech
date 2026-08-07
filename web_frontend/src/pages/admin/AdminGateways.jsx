import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapGateway, mapOrganization } from '../../utils/mappers'
import { uiGatewayStatusToApi, GATEWAY_STATUS_OPTIONS, gatewayStatusBadgeClass } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', serial: '', model: 'CF-G200', organizationId: '', status: 'Online' }

export default function AdminGateways() {
  const { showToast } = useToast()
  const { data, loading, error, reload } = useFetch(async () => {
    const [gatewaysRes, orgsRes] = await Promise.all([
      emsApi.getGateways({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    const orgs = list(orgsRes).map(mapOrganization)
    return { rows: list(gatewaysRes).map(mapGateway), orgs }
  }, [])

  const rows = data?.rows ?? []
  const orgs = data?.orgs ?? []

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  const [orgFilter, setOrgFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [snQuery, setSnQuery] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ org: '', status: '', model: '', sn: '' })

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      serial: row.serial,
      model: row.model === '—' ? 'CF-G200' : row.model,
      organizationId: row.organizationId ?? '',
      status: row.status,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleQuery = () => setAppliedFilters({ org: orgFilter, status: statusFilter, model: modelFilter, sn: snQuery })

  const filtered = rows.filter((r) =>
    (!appliedFilters.org || r.organizationId === appliedFilters.org || r.org === appliedFilters.org) &&
    (!appliedFilters.status || r.status === appliedFilters.status) &&
    (!appliedFilters.model || r.model === appliedFilters.model) &&
    (!appliedFilters.sn
      || String(r.serial ?? '').toLowerCase().includes(appliedFilters.sn.toLowerCase())
      || String(r.name ?? '').toLowerCase().includes(appliedFilters.sn.toLowerCase()))
  )

  const totalCount = rows.length
  const onlineCount = rows.filter((d) => d.status === 'Online').length
  const offlineCount = rows.filter((d) => d.status === 'Offline').length

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        serialNumber: form.serial,
        model: form.model,
        status: uiGatewayStatusToApi(form.status),
        organizationId: form.organizationId,
      }
      if (modal === 'add') await emsApi.createGateway(body)
      else await emsApi.updateGateway(selected.id, {
        name: body.name,
        serialNumber: body.serialNumber,
        model: body.model,
        status: body.status,
      })
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete gateway "${row.name}"?`)) return
    try {
      await emsApi.deleteGateway(row.id)
      setSelectedIds((ids) => ids.filter((id) => id !== row.id))
      showToast('Gateway deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Gateway was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected gateway(s)?`)) return
    const ok = []
    const failed = []
    for (const id of selectedIds) {
      try {
        await emsApi.deleteGateway(id)
        ok.push(id)
      } catch (e) {
        if (e.status === 404) ok.push(id)
        else failed.push(id)
      }
    }
    setSelectedIds([])
    if (failed.length) showToast(`Deleted ${ok.length}; ${failed.length} failed`, 'error')
    else showToast(`Deleted ${ok.length} gateway(s)`, 'success')
    reload()
  }

  const columns = [
    { key: 'status', label: 'Gateway Status', render: (v) => <span className={`badge ${gatewayStatusBadgeClass(v)}`}>{v}</span> },
    { key: 'name', label: 'Gateway Name' },
    { key: 'serial', label: 'Serial Number', render: (v) => <span className="font-mono text-xs text-surface-400">{v}</span> },
    { key: 'model', label: 'Gateway Model' },
    { key: 'devices', label: 'No Of Associated Devices' },
    { key: 'org', label: 'Organization' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Gateways</h2>
            <p className="breadcrumb">Manage Gateways &ndash; List</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" onClick={openAdd}>
              <Plus size={15} /> Add Gateway
            </button>
            <button type="button" className="btn-secondary" onClick={handleBatchDelete}>
              Batch Delete
            </button>
          </div>
        </div>

        <div className="card px-5 py-3 mb-5 flex items-center gap-4 text-xs flex-wrap">
          <span className="text-surface-600">Total Gateways <strong className="text-surface-900 dark:text-surface-100">{totalCount}</strong></span>
          <span className="text-surface-300">|</span>
          <span className="flex items-center gap-1.5 text-surface-600">
            <span className="w-2 h-2 rounded-full bg-success-600 inline-block" /> Online Gateway <strong className="text-surface-900 dark:text-surface-100">{onlineCount}</strong>
          </span>
          <span className="text-surface-300">|</span>
          <span className="flex items-center gap-1.5 text-surface-600">
            <span className="w-2 h-2 rounded-full bg-surface-400 inline-block" /> Offline Gateway <strong className="text-surface-900 dark:text-surface-100">{offlineCount}</strong>
          </span>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <SelectInput label="Organization" placeholder="All" value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                options={orgs.map((o) => ({ value: o.id, label: o.name }))} />
            </div>
            <div className="w-48">
              <SelectInput label="Status" placeholder="All status" value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={GATEWAY_STATUS_OPTIONS} />
            </div>
            <div className="w-36">
              <SelectInput label="Model" placeholder="All Models" value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                options={['CF-G100', 'CF-G200', 'CF-G300']} />
            </div>
            <div className="flex-1 min-w-48">
              <TextInput label="Search" placeholder="Please Enter SN or gateway name"
                value={snQuery} onChange={(e) => setSnQuery(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={handleQuery}>Query</button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search gateways..."
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          showToolbarActions={false}
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput label="Gateway Name" required placeholder="e.g. CF-GW-001"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <TextInput label="Serial Number" required placeholder="e.g. SN-10021"
                value={form.serial} onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))} />
            </div>
            <SelectInput label="Organization" required
              value={form.organizationId} onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
              placeholder="Select organization"
              options={orgs.map((o) => ({ value: o.id, label: o.name }))}
              disabled={modal === 'edit'} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Model" value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                options={['CF-G100', 'CF-G200', 'CF-G300']} />
              <SelectInput label="Status" value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                options={GATEWAY_STATUS_OPTIONS} />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Gateway Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Name', selected.name],
                ['Serial', selected.serial],
                ['Model', selected.model],
                ['Organization', selected.org],
                ['Devices', selected.devices],
                ['Status', selected.status],
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
