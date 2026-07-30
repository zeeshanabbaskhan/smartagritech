import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Play, Square, Radio, RefreshCw } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapOrganization } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

const blank = {
  name: 'MQTT Bridge',
  organizationId: '',
  brokerHost: '127.0.0.1',
  brokerPort: '1883',
  username: '',
  password: '',
  subscribeTopic: '/UploadTopic',
  commandTopic: '/UploadTopic/command',
}

const statusTone = (status) => {
  if (status === 'CONNECTED') return 'bg-emerald-100 text-emerald-800'
  if (status === 'STARTING') return 'bg-amber-100 text-amber-800'
  if (status === 'ERROR') return 'bg-red-100 text-red-800'
  return 'bg-surface-100 text-surface-600'
}

export default function AdminMqttBridges({ basePath = '/admin' }) {
  const { showToast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN'

  const { data, loading, error, reload } = useFetch(async () => {
    const reqs = [emsApi.getMqttBridges({ limit: 100 })]
    if (isAdmin) reqs.push(emsApi.getOrganizations({ limit: 100 }))
    const [bridgesRes, orgsRes] = await Promise.all(reqs)
    return {
      rows: list(bridgesRes),
      orgs: orgsRes ? list(orgsRes).map(mapOrganization) : [],
    }
  }, [isAdmin])

  const rows = data?.rows ?? []
  const orgs = data?.orgs ?? []

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const openAdd = () => {
    setForm({
      ...blank,
      organizationId: isAdmin ? '' : (user?.organizationId || ''),
    })
    setSelected(null)
    setModal('add')
  }

  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name || 'MQTT Bridge',
      organizationId: row.organizationId || '',
      brokerHost: row.brokerHost || '',
      brokerPort: String(row.brokerPort ?? 1883),
      username: row.username || '',
      password: '',
      subscribeTopic: row.subscribeTopic || '/UploadTopic',
      commandTopic: row.commandTopic || '',
    })
    setModal('edit')
  }

  const save = async () => {
    if (!form.brokerHost.trim()) {
      showToast('Broker host is required', 'error')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        brokerHost: form.brokerHost.trim(),
        brokerPort: Number(form.brokerPort) || 1883,
        username: form.username || null,
        subscribeTopic: form.subscribeTopic || '/UploadTopic',
        commandTopic: form.commandTopic || null,
      }
      if (form.password) body.password = form.password
      if (isAdmin && form.organizationId) body.organizationId = form.organizationId

      if (modal === 'add') {
        await emsApi.createMqttBridge(body)
        showToast('MQTT bridge created', 'success')
      } else {
        await emsApi.updateMqttBridge(selected.id, body)
        showToast('MQTT bridge updated', 'success')
      }
      setModal(null)
      reload()
    } catch (err) {
      showToast(err?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete bridge "${row.name}"?`)) return
    try {
      await emsApi.deleteMqttBridge(row.id)
      showToast('Bridge deleted', 'success')
      reload()
    } catch (err) {
      showToast(err?.message || 'Delete failed', 'error')
    }
  }

  const start = async (row) => {
    setBusyId(row.id)
    try {
      await emsApi.startMqttBridge(row.id)
      showToast('Bridge started', 'success')
      reload()
    } catch (err) {
      showToast(err?.message || 'Start failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const stop = async (row) => {
    setBusyId(row.id)
    try {
      await emsApi.stopMqttBridge(row.id)
      showToast('Bridge stopped', 'success')
      reload()
    } catch (err) {
      showToast(err?.message || 'Stop failed', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'brokerHost',
      label: 'Broker',
      render: (_v, r) => `${r.brokerHost}:${r.brokerPort}`,
    },
    { key: 'subscribeTopic', label: 'Subscribe topic' },
    {
      key: 'status',
      label: 'Status',
      render: (_v, r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(r.status)}`}>
          {r.status}
          {r.runtime?.connected ? ' · live' : ''}
        </span>
      ),
    },
    {
      key: 'messagesReceived',
      label: 'Msgs',
      render: (v) => v ?? 0,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_v, r) => (
        <div className="flex flex-wrap items-center gap-1">
          {r.status === 'CONNECTED' || r.enabled ? (
            <button
              type="button"
              className="btn-secondary !px-2 !py-1 text-xs"
              disabled={busyId === r.id}
              onClick={() => stop(r)}
              title="Stop"
            >
              <Square size={12} /> Stop
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary !px-2 !py-1 text-xs"
              disabled={busyId === r.id}
              onClick={() => start(r)}
              title="Start"
            >
              <Play size={12} /> Start
            </button>
          )}
          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => openEdit(r)}>
            <Pencil size={12} />
          </button>
          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => remove(r)}>
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="page-title inline-flex items-center gap-2">
              <Radio size={20} /> MQTT Bridges
            </h2>
            <p className="mt-1 text-sm text-surface-500 max-w-2xl">
              Manage the Node MQTT listener from the UI. Create a bridge, click Start, and device
              readings on the topic are mapped into EMS using gateway serial + template register addresses.
              Device ON/OFF in the dashboard also publishes to the command topic.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={reload}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button type="button" className="btn-primary" onClick={openAdd}>
              <Plus size={14} /> Add bridge
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-xs text-surface-600 space-y-1">
          <p><strong>Setup checklist</strong></p>
          <p>1. Gateway serial number = MQTT <code>serial_number</code></p>
          <p>2. Device name ≈ MQTT <code>device</code> field</p>
          <p>3. Slave names match MQTT blocks (e.g. Main, EMS PANEL)</p>
          <p>4. Template variable <code>registerAddress</code> = MQTT keys (e.g. 40097)</p>
        </div>

        {rows.some((r) => r.lastError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            {rows.filter((r) => r.lastError).map((r) => (
              <div key={r.id}>{r.name}: {r.lastError}</div>
            ))}
          </div>
        )}

        <DataTable columns={columns} rows={rows} emptyMessage="No MQTT bridges yet" />
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add MQTT bridge' : 'Edit MQTT bridge'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <TextInput label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          {isAdmin && (
            <SelectInput
              label="Organization"
              value={form.organizationId}
              onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
              options={[{ value: '', label: 'Select…' }, ...orgs.map((o) => ({ value: o.id, label: o.name }))]}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Broker host" value={form.brokerHost} onChange={(e) => setForm((f) => ({ ...f, brokerHost: e.target.value }))} />
            <TextInput label="Port" value={form.brokerPort} onChange={(e) => setForm((f) => ({ ...f, brokerPort: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            <TextInput
              label={modal === 'edit' ? 'Password (leave blank to keep)' : 'Password'}
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <TextInput label="Subscribe topic" value={form.subscribeTopic} onChange={(e) => setForm((f) => ({ ...f, subscribeTopic: e.target.value }))} />
          <TextInput
            label="Command topic (ON/OFF publish)"
            value={form.commandTopic}
            onChange={(e) => setForm((f) => ({ ...f, commandTopic: e.target.value }))}
          />
        </div>
      </Modal>
    </PageState>
  )
}
