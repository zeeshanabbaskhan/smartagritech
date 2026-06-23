import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmSetting, mapOrganization, mapAlarmTemplate } from '../../utils/mappers'
import { uiStatusToApi, uiMechanismToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blankForm = {
  name: '', org: '', organizationId: '', pushType: 'Template Trigger', pushMethod: 'Email',
  templateTriggerId: '', mechanism: 'Instant', delay: '', status: 'Active',
}

export default function AdminAlarmSettings() {
  const { showToast } = useToast()
  const { data: meta, loading: metaLoading } = useFetch(async () => {
    const [orgsRes, triggersRes] = await Promise.all([
      emsApi.getOrganizations({ limit: 100 }),
      emsApi.getAlarmTemplates({ limit: 100 }),
    ])
    return {
      organizations: list(orgsRes).map(mapOrganization),
      triggers: list(triggersRes).map(mapAlarmTemplate),
    }
  }, [])

  const { data: rows, loading, error, reload } = useFetch(async () => {
    const [settingsRes, orgsRes] = await Promise.all([
      emsApi.getAlarmSettings({ limit: 100 }),
      emsApi.getOrganizations({ limit: 100 }),
    ])
    const orgMap = Object.fromEntries(list(orgsRes).map((o) => [o.id, mapOrganization(o).name]))
    return list(settingsRes).map((s) => ({
      ...mapAlarmSetting(s),
      org: orgMap[s.organizationId] ?? s.organization?.name ?? '—',
      organizationId: s.organizationId,
    }))
  }, [])

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setForm(blankForm); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      org: row.org,
      organizationId: row.organizationId ?? '',
      pushType: row.pushType,
      pushMethod: row.pushMethod,
      templateTriggerId: row.templateTriggerId ?? '',
      mechanism: row.mechanism,
      delay: row.delay ?? '',
      status: row.status,
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
        templateTriggerId: form.templateTriggerId || meta?.triggers[0]?.id,
        pushType: form.pushType,
        pushMethod: form.pushMethod,
        pushingMechanism: uiMechanismToApi(form.mechanism),
        status: uiStatusToApi(form.status),
      }
      if (modal === 'add') {
        await emsApi.createAlarmSetting(body)
        showToast('Alarm setting created successfully')
      } else {
        await emsApi.updateAlarmSetting(selected.id, body)
        showToast('Alarm setting updated successfully')
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
    if (!confirm(`Delete alarm setting "${row.name}"?`)) return
    try {
      await emsApi.deleteAlarmSetting(row.id)
      showToast('Alarm setting deleted', 'success')
    } catch (e) {
      if (e.status === 404) showToast('Alarm setting was already deleted', 'info')
      else showToast(e.message || 'Delete failed', 'error')
    } finally {
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Setting Name' },
    { key: 'org', label: 'Organization' },
    { key: 'pushType', label: 'Push Type' },
    { key: 'pushMethod', label: 'Push Method', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'mechanism', label: 'Alarm Mechanism', render: (v) =>
      <span className={`badge ${v === 'Instant' ? 'badge-warning' : 'badge-neutral'}`}>{v}</span> },
    { key: 'status', label: 'Status', render: (v) =>
      <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'updatedAt', label: 'Last Updated' },
  ]

  return (
    <PageState loading={loading || metaLoading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Alarm Settings</h2>
            <p className="breadcrumb">Admin / Alarms / Alarm Settings</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Setting</button>
        </div>

        <DataTable
          columns={columns}
          data={rows ?? []}
          searchPlaceholder="Search alarm settings..."
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
          title={modal === 'add' ? 'Add Alarm Setting' : 'Edit Alarm Setting'}
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
              <TextInput label="Setting Name" required placeholder="e.g. Overvoltage Alert"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <SelectInput label="Organization" required placeholder="Select organization"
                value={form.organizationId} onChange={(e) => {
                  const org = meta?.organizations.find((o) => o.id === e.target.value)
                  setForm((f) => ({ ...f, organizationId: e.target.value, org: org?.name ?? '' }))
                }}
                options={(meta?.organizations ?? []).map((o) => ({ value: o.id, label: o.name }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Template Trigger" required placeholder="Select trigger"
                value={form.templateTriggerId} onChange={(e) => setForm((f) => ({ ...f, templateTriggerId: e.target.value }))}
                options={(meta?.triggers ?? []).map((t) => ({ value: t.id, label: t.name }))} />
              <SelectInput label="Push Type" value={form.pushType}
                onChange={(e) => setForm((f) => ({ ...f, pushType: e.target.value }))}
                options={['Template Trigger', 'Custom']} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectInput label="Push Method" value={form.pushMethod}
                onChange={(e) => setForm((f) => ({ ...f, pushMethod: e.target.value }))}
                options={['Email', 'SMS', 'WhatsApp', 'All']} />
              <SelectInput label="Alarm Mechanism" value={form.mechanism}
                onChange={(e) => setForm((f) => ({ ...f, mechanism: e.target.value }))}
                options={['Instant', 'Delayed']} />
            </div>
            {form.mechanism === 'Delayed' && (
              <TextInput label="Delay Duration" placeholder="e.g. 5 minutes"
                value={form.delay} onChange={(e) => setForm((f) => ({ ...f, delay: e.target.value }))} />
            )}
            <ToggleInput label="Status (Active)" checked={form.status === 'Active'}
              onChange={(v) => setForm((f) => ({ ...f, status: v ? 'Active' : 'Inactive' }))} />
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Alarm Setting Details">
          {selected && (
            <div className="space-y-3">
              {[
                ['Setting Name', selected.name],
                ['Organization', selected.org],
                ['Push Type', selected.pushType],
                ['Push Method', selected.pushMethod],
                ['Mechanism', selected.mechanism],
                ...(selected.mechanism === 'Delayed' ? [['Delay Duration', selected.delay]] : []),
                ['Status', selected.status],
                ['Last Updated', selected.updatedAt],
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
