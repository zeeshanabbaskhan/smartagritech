import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import MqttConfigModal from '../../components/ui/MqttConfigModal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, BarChart2 } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapOrganization, mapGateway, mapDeviceTemplate } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', organizationId: '', gatewayId: '', templateId: '', switchOn: false }

export default function AdminDevices() {
  const { showToast } = useToast()
  const navigate = useNavigate()

  const { data, loading, error, reload } = useFetch(async () => {
    const [devicesRes, orgsRes, gatewaysRes, templatesRes] = await Promise.all([
      emsApi.getDevices({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
      emsApi.getGateways({ limit: 100 }),
      emsApi.getDeviceTemplates({ limit: 100 }),
    ])
    return {
      rows: list(devicesRes).map(mapDevice),
      orgs: list(orgsRes).map(mapOrganization),
      gateways: list(gatewaysRes).map(mapGateway),
      templates: list(templatesRes).map(mapDeviceTemplate),
    }
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [mqttConfig, setMqttConfig] = useState(null)
  // Device deletes are processed asynchronously (queued) on the server, so a row
  // can still be present on the immediate reload. Track deleted ids and hide them
  // locally so they don't "come back" before the background purge finishes.
  const [removedIds, setRemovedIds] = useState(() => new Set())

  const rows = (data?.rows ?? []).filter((r) => !removedIds.has(r.id))
  const orgs = data?.orgs ?? []
  const gateways = data?.gateways ?? []
  const templates = data?.templates ?? []

  const filteredGateways = form.organizationId
    ? gateways.filter((g) => g.organizationId === form.organizationId)
    : gateways

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
        close()
        reload()
        setMqttConfig({ deviceId: res?.data?.id, ingestApiKey: res?.ingestApiKey })
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
      showToast('Device deleted', 'success')
    } catch (e) {
      // 404 = already removed on the server; reload below drops the stale row.
      if (e.status === 404) { setRemovedIds((prev) => new Set(prev).add(row.id)); showToast('Device was already deleted', 'info') }
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Device Name' },
    { key: 'org', label: 'Organization' },
    { key: 'gateway', label: 'Gateway' },
    { key: 'template', label: 'Template', render: (v) => <span className="text-surface-400 text-xs">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
    { key: 'switchOn', label: 'Switch', render: (v) => <span className={`badge ${v ? 'badge-success' : 'badge-neutral'}`}>{v ? 'On' : 'Off'}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Devices</h2>
            <p className="breadcrumb">Admin / Devices</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Device</button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search devices..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => navigate(`/admin/devices/${row.id}`)} title="Open device"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 text-info-600" onClick={() => navigate('/admin/data-center')} title="Data Center"><BarChart2 size={14} /></button>
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
            {modal === 'edit' && (
              <ToggleInput label="Switch On" checked={form.switchOn}
                onChange={(v) => setForm((f) => ({ ...f, switchOn: v }))} />
            )}
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
