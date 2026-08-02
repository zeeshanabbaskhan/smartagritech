import { useState } from 'react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, TextareaInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapAlarmSetting, mapOrganization, mapAlarmTemplate } from '../../utils/mappers'
import { uiStatusToApi, uiMechanismToApi } from '../../utils/apiForm'
import { useToast } from '../../context/ToastContext'

const blankForm = {
  name: '', org: '', organizationId: '', pushType: 'Template Trigger', pushBody: '', pushMethod: 'Email',
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
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)

  const [orgFilter, setOrgFilter] = useState('')
  const [pushTypeFilter, setPushTypeFilter] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [applied, setApplied] = useState({ organizationId: '', pushType: '', name: '' })

  const handleQuery = () => setApplied({ organizationId: orgFilter, pushType: pushTypeFilter, name: nameQuery })

  const filteredRows = (rows ?? []).filter((r) =>
    (!applied.organizationId || r.organizationId === applied.organizationId) &&
    (!applied.pushType || r.pushType === applied.pushType) &&
    (!applied.name || r.name.toLowerCase().includes(applied.name.toLowerCase()))
  )

  const openAdd = () => { setForm(blankForm); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      org: row.org,
      organizationId: row.organizationId ?? '',
      pushType: row.pushType,
      pushBody: row.pushBody ?? '',
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
        pushBody: form.pushBody,
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

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected setting(s)?`)) return
    setDeleting(true)
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => emsApi.deleteAlarmSetting(id)))
      const failed = results.filter((r) => r.status === 'rejected' && r.reason?.status !== 404)
      if (failed.length) showToast(`${failed.length} setting(s) failed to delete`, 'error')
      else showToast('Selected settings deleted', 'success')
      setSelectedIds([])
    } finally {
      setDeleting(false)
      reload()
    }
  }

  const columns = [
    { key: 'name', label: 'Alarm Configuration Name' },
    { key: 'org', label: 'Organization' },
    { key: 'pushType', label: 'Push Type' },
    { key: 'pushBody', label: 'Push Body', render: (v) => <span className="text-xs text-surface-500 max-w-xs truncate block">{v || '—'}</span> },
    { key: 'pushMethod', label: 'Push Method', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'mechanism', label: 'Pushing Mechanism', render: (v) =>
      <span className={`badge ${v === 'Instant' ? 'badge-warning' : 'badge-neutral'}`}>{v}</span> },
    { key: 'status', label: 'Status', render: (v) =>
      <span className={`badge ${v === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{v}</span> },
    { key: 'founder', label: 'Founder' },
    { key: 'updatedAt', label: 'Update Time' },
  ]

  return (
    <PageState loading={loading || metaLoading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Alarm linkage</h2>
            <p className="breadcrumb">Alarm Settings &ndash; Alarm Settings List</p>
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
            <div className="w-44">
              <SelectInput label="Push Type" placeholder="All" value={pushTypeFilter}
                onChange={(e) => setPushTypeFilter(e.target.value)}
                options={['Template Trigger', 'Custom']} />
            </div>
            <div className="flex-1 min-w-48">
              <TextInput label="Alarm Configuration" placeholder="Please input alarm configuration name"
                value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={handleQuery}>Query</button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredRows}
          searchPlaceholder="Search alarm settings..."
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
              <TextInput label="Alarm Configuration Name" required placeholder="e.g. Overvoltage Alert"
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
              <SelectInput label="Pushing Mechanism" value={form.mechanism}
                onChange={(e) => setForm((f) => ({ ...f, mechanism: e.target.value }))}
                options={['Instant', 'Delayed']} />
            </div>
            <TextareaInput label="Push Body" placeholder="Notification body text..."
              value={form.pushBody} onChange={(e) => setForm((f) => ({ ...f, pushBody: e.target.value }))} />
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
                ['Alarm Configuration Name', selected.name],
                ['Organization', selected.org],
                ['Push Type', selected.pushType],
                ['Push Body', selected.pushBody || '—'],
                ['Push Method', selected.pushMethod],
                ['Pushing Mechanism', selected.mechanism],
                ...(selected.mechanism === 'Delayed' ? [['Delay Duration', selected.delay]] : []),
                ['Founder', selected.founder],
                ['Status', selected.status],
                ['Update Time', selected.updatedAt],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <span className="text-xs text-surface-500 w-40 flex-shrink-0">{label}</span>
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
