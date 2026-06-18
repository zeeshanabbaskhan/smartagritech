import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye, BarChart2 } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDevice, mapGateway, mapDeviceTemplate } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

const blank = { name: '', gatewayId: '', templateId: '', switchOn: true }

export default function OrgDevices() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useFetch(async () => {
    const [devicesRes, gatewaysRes, templatesRes] = await Promise.all([
      emsApi.getDevices({ limit: 100 }),
      emsApi.getGateways({ limit: 100 }),
      emsApi.getDeviceTemplates({ limit: 100 }),
    ])
    return {
      rows: list(devicesRes).map(mapDevice),
      gateways: list(gatewaysRes).map(mapGateway),
      templates: list(templatesRes).map(mapDeviceTemplate),
    }
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const rows = data?.rows ?? []
  const gateways = data?.gateways ?? []
  const templates = data?.templates ?? []

  const openAdd = () => { setForm(blank); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({ name: row.name, gatewayId: row.gatewayId, templateId: row.templateId, switchOn: row.switchOn })
    setModal('edit')
  }
  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'add') {
        await emsApi.createDevice({ name: form.name, gatewayId: form.gatewayId, templateId: form.templateId })
      } else {
        await emsApi.updateDevice(selected.id, {
          name: form.name,
          gatewayId: form.gatewayId,
          switchState: form.switchOn ? 'ON' : 'OFF',
        })
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
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const columns = [
    { key: 'name', label: 'Device Name' },
    { key: 'gateway', label: 'Gateway' },
    { key: 'template', label: 'Template', render: (v) => <span className="text-xs text-surface-400 truncate max-w-xs block">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'Online' ? 'badge-success' : 'badge-danger'}`}>{v}</span> },
    { key: 'switchOn', label: 'Switch', render: (v) => <span className={`badge ${v ? 'badge-success' : 'badge-neutral'}`}>{v ? 'On' : 'Off'}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">My Devices</h2>
            <p className="breadcrumb">Organization / Devices</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Device</button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search devices..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => navigate(`/org/devices/${row.id}`)} title="Open device"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5 text-primary-600" onClick={() => navigate('/org/sensor-history')} title="Sensor History"><BarChart2 size={14} /></button>
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
                {saving ? 'Saving...' : modal === 'add' ? 'Create' : 'Save'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Device Name" required placeholder="e.g. Main Wapda"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              {modal === 'add' && (
                <SelectInput label="Device Template" required placeholder="Select template"
                  value={form.templateId} onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                  options={templates.map((t) => ({ value: t.id, label: t.name }))} />
              )}
            </div>
            <SelectInput label="Gateway" required placeholder="Select gateway"
              value={form.gatewayId} onChange={(e) => setForm((f) => ({ ...f, gatewayId: e.target.value }))}
              options={gateways.map((g) => ({ value: g.id, label: g.name }))} />
            <ToggleInput label="Switch On" checked={form.switchOn} onChange={(v) => setForm((f) => ({ ...f, switchOn: v }))} description="Enable remote switch control for this device" />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Device Details">
          {selected && (
            <div className="space-y-3">
              {[['Name', selected.name], ['Gateway', selected.gateway], ['Template', selected.template], ['Status', selected.status]].map(([l, v]) => (
                <div key={l} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-24 flex-shrink-0">{l}</span>
                  <span className="text-xs text-surface-800">{v}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
