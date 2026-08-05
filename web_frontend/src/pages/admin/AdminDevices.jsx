import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import MqttConfigModal from '../../components/ui/MqttConfigModal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, Download } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapOrganization, mapGateway, mapDeviceTemplate, mapUser } from '../../utils/mappers'
import {
  DEVICE_STATUS_OPTIONS,
  deviceStatusBadgeClass,
  matchesDeviceStatus,
  matchesDeviceDates,
} from '../../utils/deviceFilters'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', organizationId: '', gatewayId: '', templateId: '', switchOn: false }

export default function AdminDevices() {
  const { showToast } = useToast()

  const { data, loading, error, reload } = useFetch(async () => {
    const [devicesRes, orgsRes, gatewaysRes, templatesRes, usersRes] = await Promise.all([
      emsApi.getDevices({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
      emsApi.getGateways({ limit: 100 }),
      emsApi.getDeviceTemplates({ limit: 100 }),
      emsApi.getUsers({ limit: 100 }),
    ])
    return {
      rows: list(devicesRes).map(mapDevice),
      orgs: list(orgsRes).map(mapOrganization),
      gateways: list(gatewaysRes).map(mapGateway),
      templates: list(templatesRes).map(mapDeviceTemplate),
      users: list(usersRes).map(mapUser),
    }
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [mqttConfig, setMqttConfig] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [removedIds, setRemovedIds] = useState(() => new Set())

  const [orgFilter, setOrgFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [modifiedFrom, setModifiedFrom] = useState('')
  const [modifiedTo, setModifiedTo] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [applied, setApplied] = useState({
    org: '', user: '', status: '', name: '',
    createdFrom: '', createdTo: '', modifiedFrom: '', modifiedTo: '',
  })

  const rows = (data?.rows ?? []).filter((r) => !removedIds.has(r.id))
  const orgs = data?.orgs ?? []
  const gateways = data?.gateways ?? []
  const templates = data?.templates ?? []
  const users = data?.users ?? []

  const filteredGateways = form.organizationId
    ? gateways.filter((g) => g.organizationId === form.organizationId)
    : gateways

  const filtered = rows.filter((r) =>
    (!applied.org || r.organizationId === applied.org || r.org === applied.org) &&
    matchesDeviceStatus(r, applied.status) &&
    matchesDeviceDates(r, applied.createdFrom, applied.createdTo, applied.modifiedFrom, applied.modifiedTo) &&
    (!applied.name || r.name.toLowerCase().includes(applied.name.toLowerCase())) &&
    (!applied.user || r.org === users.find((u) => u.id === applied.user)?.org)
  )

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      organizationId: row.organizationId ?? '',
      gatewayId: row.gatewayId ?? '',
      templateId: row.templateId ?? '',
      switchOn: row.switchOn,
    })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleQuery = () => setApplied({
    org: orgFilter,
    user: userFilter,
    status: statusFilter,
    name: nameQuery,
    createdFrom,
    createdTo,
    modifiedFrom,
    modifiedTo,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'add') {
        const res = await emsApi.createDevice({
          name: form.name,
          templateId: form.templateId,
          gatewayId: form.gatewayId,
          organizationId: form.organizationId,
        })
        const deviceId = res?.data?.id
        if (form.switchOn && deviceId) {
          try {
            await emsApi.switchDevice(deviceId, 'ON')
          } catch (switchErr) {
            showToast(switchErr.message || 'Device created but switch ON failed', 'warning')
          }
        }
        close()
        reload()
        setMqttConfig({ deviceId, ingestApiKey: res?.ingestApiKey })
        return
      }
      const prevSwitch = selected.switchOn
      await emsApi.updateDevice(selected.id, {
        name: form.name,
        gatewayId: form.gatewayId,
      })
      if (form.switchOn !== prevSwitch) {
        await emsApi.switchDevice(selected.id, form.switchOn ? 'ON' : 'OFF')
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
    if (!confirm(`Delete device "${row.name}"?`)) return
    try {
      await emsApi.deleteDevice(row.id)
      setRemovedIds((prev) => new Set(prev).add(row.id))
      setSelectedIds((ids) => ids.filter((id) => id !== row.id))
      showToast('Device deleted', 'success')
    } catch (e) {
      if (e.status === 404) {
        setRemovedIds((prev) => new Set(prev).add(row.id))
        showToast('Device was already deleted', 'info')
      } else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected device(s)?`)) return
    const ok = []
    const failed = []
    for (const id of selectedIds) {
      try {
        await emsApi.deleteDevice(id)
        ok.push(id)
      } catch (e) {
        if (e.status === 404) ok.push(id)
        else failed.push(id)
      }
    }
    if (ok.length) {
      setRemovedIds((prev) => {
        const next = new Set(prev)
        ok.forEach((id) => next.add(id))
        return next
      })
    }
    setSelectedIds([])
    if (failed.length) showToast(`Deleted ${ok.length}; ${failed.length} failed`, 'error')
    else showToast(`Deleted ${ok.length} device(s)`, 'success')
    reload()
  }

  const handleExport = () => {
    const header = ['Device Name', 'Organization', 'Gateway', 'Device Template', 'Status', 'Switch']
    const exportRows = filtered.map((r) => [r.name, r.org, r.gateway, r.template, r.status, r.switchOn ? 'On' : 'Off'])
    const csv = [header, ...exportRows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'devices.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns = [
    { key: 'status', label: 'Device Status', render: (v) => <span className={`badge ${deviceStatusBadgeClass(v)}`}>{v}</span> },
    { key: 'name', label: 'Device Name' },
    { key: 'org', label: 'Organization' },
    { key: 'gateway', label: 'Gateway' },
    { key: 'template', label: 'Device Template', render: (v) => <span className="text-surface-500 text-xs">{v}</span> },
    { key: 'switchOn', label: 'Switch', render: (v) => <span className={`badge ${v ? 'badge-success' : 'badge-neutral'}`}>{v ? 'ON' : 'OFF'}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Devices</h2>
            <p className="breadcrumb">Manage Devices &ndash; List</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Device</button>
            <button type="button" className="btn-secondary" onClick={handleBatchDelete}>Batch Delete</button>
            <button type="button" className="btn-secondary" onClick={handleExport}><Download size={14} /> Export</button>
          </div>
        </div>

        <div className="card p-4 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <SelectInput label="Organization" placeholder="All" value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                options={orgs.map((o) => ({ value: o.id, label: o.name }))} />
            </div>
            <div className="w-44">
              <SelectInput label="User" placeholder="All Users" value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                options={users.map((u) => ({ value: u.id, label: u.name }))} />
            </div>
            <div className="w-40">
              <SelectInput label="Status" placeholder="All status" value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={DEVICE_STATUS_OPTIONS} />
            </div>
            <div className="w-56">
              <label className="label">Create Time</label>
              <div className="flex items-center gap-1.5">
                <input type="date" className="input text-xs" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
                <span className="text-surface-400 text-xs">-</span>
                <input type="date" className="input text-xs" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
              </div>
            </div>
            <div className="w-56">
              <label className="label">Modify Time</label>
              <div className="flex items-center gap-1.5">
                <input type="date" className="input text-xs" value={modifiedFrom} onChange={(e) => setModifiedFrom(e.target.value)} />
                <span className="text-surface-400 text-xs">-</span>
                <input type="date" className="input text-xs" value={modifiedTo} onChange={(e) => setModifiedTo(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 min-w-48">
              <TextInput label="Device Name" placeholder="Please input device name"
                value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={handleQuery}>Query</button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search devices..."
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          showToolbarActions={false}
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5 text-warning-600" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Device' : 'Edit Device'}
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
              <TextInput label="Device Name" required placeholder="e.g. Main Wapda"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <SelectInput label="Device Template" required placeholder="Select template"
                value={form.templateId} onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                options={templates.map((t) => ({ value: t.id, label: t.name }))}
                disabled={modal === 'edit'} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Organization" required placeholder="Select organization"
                value={form.organizationId} onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value, gatewayId: '' }))}
                options={orgs.map((o) => ({ value: o.id, label: o.name }))}
                disabled={modal === 'edit'} />
              <SelectInput label="Gateway" required placeholder="Select gateway"
                value={form.gatewayId} onChange={(e) => setForm((f) => ({ ...f, gatewayId: e.target.value }))}
                options={filteredGateways.map((g) => ({ value: g.id, label: g.name }))} />
            </div>
            <ToggleInput label="Switch On" checked={form.switchOn}
              onChange={(v) => setForm((f) => ({ ...f, switchOn: v }))} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Device Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Device Name', selected.name],
                ['Organization', selected.org],
                ['Gateway', selected.gateway],
                ['Template', selected.template],
                ['Status', selected.status],
                ['Switch', selected.switchOn ? 'On' : 'Off'],
                ['Last Seen', selected.lastSeen],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-28 flex-shrink-0">{label}</span>
                  <span className="text-xs text-surface-800">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>

        <MqttConfigModal
          open={!!mqttConfig}
          onClose={() => setMqttConfig(null)}
          deviceId={mqttConfig?.deviceId}
          ingestApiKey={mqttConfig?.ingestApiKey}
        />
      </div>
    </PageState>
  )
}
