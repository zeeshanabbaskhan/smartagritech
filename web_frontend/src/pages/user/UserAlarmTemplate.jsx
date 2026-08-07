import { useEffect, useState } from 'react'
import { Eye, Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import { TextInput, SelectInput, RadioInput, ToggleInput } from '../../components/ui/FormFields'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import emsApi, { list, one } from '../../api/emsApi'
import { mapAlarmTemplate, mapDeviceTemplate } from '../../utils/mappers'

const TRIGGER_CONDITIONS = [
  'OFF',
  'ON',
  'Value is less than A',
  'Value is more than B',
  'Value is more than A and less than B',
  'Value is more than B or less than A',
  'Value is equal to A',
]

const needsA = (c) =>
  c === 'Value is less than A'
  || c === 'Value is more than A and less than B'
  || c === 'Value is more than B or less than A'
  || c === 'Value is equal to A'

const needsB = (c) =>
  c === 'Value is more than B'
  || c === 'Value is more than A and less than B'
  || c === 'Value is more than B or less than A'

const conditionToApi = (condition, a, b) => {
  switch (condition) {
    case 'OFF':
      return { operator: 'EQ', threshold: 0, thresholdB: null, anomalyType: 'OFF' }
    case 'ON':
      return { operator: 'EQ', threshold: 1, thresholdB: null, anomalyType: 'ON' }
    case 'Value is less than A':
      return { operator: 'LT', threshold: a, thresholdB: null, anomalyType: 'LT_A' }
    case 'Value is more than B':
      return { operator: 'GT', threshold: b, thresholdB: null, anomalyType: 'GT_B' }
    case 'Value is more than A and less than B':
      return { operator: 'BETWEEN', threshold: a, thresholdB: b, anomalyType: 'BETWEEN_AB' }
    case 'Value is more than B or less than A':
      return { operator: 'OUTSIDE', threshold: a, thresholdB: b, anomalyType: 'OUTSIDE_AB' }
    case 'Value is equal to A':
      return { operator: 'EQ', threshold: a, thresholdB: null, anomalyType: 'EQ_A' }
    default:
      return { operator: 'GT', threshold: a || b || 0, thresholdB: null, anomalyType: 'threshold' }
  }
}

const blank = {
  contactName: '',
  phone: '',
  email: '',
  name: '',
  deviceTemplateId: '',
  slaveId: '',
  templateVariableId: '',
  condition: 'Value is less than A',
  thresholdA: '',
  thresholdB: '',
  pushMechanism: 'first_time',
  silenceSeconds: '300',
  alarmEnabled: true,
  linkageEnabled: false,
  contactId: '',
  alarmSettingId: '',
  status: 'Active',
}

export default function UserAlarmTemplate() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [slaves, setSlaves] = useState([])
  const [variables, setVariables] = useState([])
  const [slavesLoading, setSlavesLoading] = useState(false)
  const [varsLoading, setVarsLoading] = useState(false)

  const { data, loading, error, reload } = useFetch(async () => {
    const [rowsRes, templatesRes] = await Promise.all([
      emsApi.getAlarmTemplates({ limit: 100 }),
      emsApi.getDeviceTemplates({ limit: 100 }),
    ])
    return {
      rows: list(rowsRes).map(mapAlarmTemplate),
      templates: list(templatesRes).map(mapDeviceTemplate),
    }
  }, [])

  const templates = data?.templates ?? []

  useEffect(() => {
    let cancelled = false
    const loadSlaves = async () => {
      if (!form.deviceTemplateId || (modal !== 'add' && modal !== 'edit')) {
        setSlaves([])
        return
      }
      setSlavesLoading(true)
      try {
        const rows = list(await emsApi.getTemplateSlaves(form.deviceTemplateId))
        if (cancelled) return
        setSlaves(rows)
        setForm((f) => {
          if (f.slaveId && rows.some((s) => s.id === f.slaveId)) return f
          return { ...f, slaveId: rows[0]?.id ?? '', templateVariableId: '' }
        })
      } catch {
        if (!cancelled) {
          setSlaves([])
          showToast('Failed to load device slaves', 'error')
        }
      } finally {
        if (!cancelled) setSlavesLoading(false)
      }
    }
    loadSlaves()
    return () => { cancelled = true }
  }, [form.deviceTemplateId, modal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    const loadVars = async () => {
      if (!form.deviceTemplateId || !form.slaveId || (modal !== 'add' && modal !== 'edit')) {
        setVariables([])
        return
      }
      setVarsLoading(true)
      try {
        const rows = list(await emsApi.getTemplateVariables(form.deviceTemplateId, form.slaveId))
        if (cancelled) return
        const mapped = rows.map((v) => ({
          id: v.id,
          label: `${v.displayName || v.name}${v.registerAddress ? ` (${v.registerAddress})` : ''}`,
        }))
        setVariables(mapped)
        setForm((f) => {
          if (f.templateVariableId && mapped.some((v) => v.id === f.templateVariableId)) return f
          return { ...f, templateVariableId: mapped[0]?.id ?? '' }
        })
      } catch {
        if (!cancelled) {
          setVariables([])
          showToast('Failed to load template variables', 'error')
        }
      } finally {
        if (!cancelled) setVarsLoading(false)
      }
    }
    loadVars()
    return () => { cancelled = true }
  }, [form.deviceTemplateId, form.slaveId, modal]) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setForm({
      ...blank,
      deviceTemplateId: templates[0]?.id ?? '',
    })
    setErrors({})
    setModal('add')
  }

  const openEdit = (row) => {
    setSelected(row)
    const cond = TRIGGER_CONDITIONS.includes(row.condition) ? row.condition : 'Value is less than A'
    let thresholdA = ''
    let thresholdB = ''
    if (cond === 'Value is more than B') {
      thresholdB = row.threshold === '—' ? '' : (row.threshold ?? '')
    } else if (cond === 'Value is more than A and less than B' || cond === 'Value is more than B or less than A') {
      thresholdA = row.threshold === '—' ? '' : (row.threshold ?? '')
      thresholdB = row.thresholdB ?? ''
    } else if (cond !== 'OFF' && cond !== 'ON') {
      thresholdA = row.threshold === '—' ? '' : (row.threshold ?? '')
    }
    setForm({
      contactName: row.contactName || '',
      phone: row.contactPhone || '',
      email: row.contactEmail || '',
      name: row.name || '',
      deviceTemplateId: row.deviceTemplateId || '',
      slaveId: row.templateSlaveId || '',
      templateVariableId: row.templateVariableId || '',
      condition: cond,
      thresholdA,
      thresholdB,
      pushMechanism: row.pushMechanism === 'silence' ? 'silence' : 'first_time',
      silenceSeconds: row.silenceSeconds || '300',
      alarmEnabled: row.alarmEnabled !== false,
      linkageEnabled: !!row.linkageEnabled,
      contactId: row.contactId || '',
      alarmSettingId: row.alarmSettingId || '',
      status: row.status || 'Active',
    })
    setErrors({})
    setModal('edit')
  }

  const openView = (row) => { setSelected(row); setModal('view') }
  const close = () => { setModal(null); setSelected(null); setErrors({}) }

  const validate = () => {
    const next = {}
    if (!form.contactName.trim()) next.contactName = 'Contact name is required'
    if (!form.phone.trim()) next.phone = 'Phone is required'
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email'
    if (!form.name.trim()) next.name = 'Trigger name is required'
    if (!form.deviceTemplateId) next.deviceTemplateId = 'Device template is required'
    if (!form.slaveId) next.slaveId = 'Device slave is required'
    if (!form.templateVariableId) next.templateVariableId = 'Template variable is required'
    if (!form.condition) next.condition = 'Triggering condition is required'
    if (needsA(form.condition) && (form.thresholdA === '' || Number.isNaN(parseFloat(form.thresholdA)))) {
      next.thresholdA = 'Value A is required'
    }
    if (needsB(form.condition) && (form.thresholdB === '' || Number.isNaN(parseFloat(form.thresholdB)))) {
      next.thresholdB = 'Value B is required'
    }
    if (form.pushMechanism === 'silence') {
      const sec = parseInt(form.silenceSeconds, 10)
      if (!Number.isFinite(sec) || sec < 1) next.silenceSeconds = 'Silence time (seconds) is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      showToast('Please fill required fields', 'error')
      return
    }
    setSaving(true)
    try {
      const a = parseFloat(form.thresholdA)
      const b = parseFloat(form.thresholdB)
      const mapped = conditionToApi(form.condition, a, b)
      const pushingMechanism = form.pushMechanism === 'silence'
        ? `SILENCE:${parseInt(form.silenceSeconds, 10) || 300}`
        : 'FIRST_TIME'

      let contactId = form.contactId
      const contactBody = {
        name: form.contactName.trim(),
        mobile: form.phone.trim(),
        email: form.email.trim(),
        organizationId: user?.organizationId,
      }
      if (contactId) {
        await emsApi.updateAlarmContact(contactId, contactBody)
      } else {
        const created = await emsApi.createAlarmContact(contactBody)
        contactId = one(created)?.id
      }

      const triggerBody = {
        name: form.name.trim(),
        deviceTemplateId: form.deviceTemplateId,
        templateVariableId: form.templateVariableId,
        operator: mapped.operator,
        threshold: mapped.threshold,
        thresholdB: mapped.thresholdB,
        anomalyType: mapped.anomalyType,
        priority: 'MEDIUM',
        isActive: form.alarmEnabled,
        linkageAction: form.linkageEnabled ? 'ENABLED' : null,
        organizationId: user?.organizationId,
      }

      let triggerId = selected?.id
      if (modal === 'add') {
        const created = await emsApi.createAlarmTemplate(triggerBody)
        triggerId = one(created)?.id
        showToast('Alarm template created', 'success')
      } else {
        await emsApi.updateAlarmTemplate(selected.id, triggerBody)
        showToast('Alarm template updated', 'success')
      }

      const settingBody = {
        name: `${form.name.trim()} notify`,
        organizationId: user?.organizationId,
        templateTriggerId: triggerId,
        pushType: 'Template Trigger',
        pushMethod: 'Email',
        pushingMechanism,
        status: form.alarmEnabled ? 'ACTIVE' : 'INACTIVE',
        contactIds: contactId ? [contactId] : [],
      }
      if (form.alarmSettingId) {
        await emsApi.updateAlarmSetting(form.alarmSettingId, settingBody)
      } else if (triggerId) {
        await emsApi.createAlarmSetting(settingBody)
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
    if (!confirm(`Delete trigger "${row.name}"?`)) return
    try {
      await emsApi.deleteAlarmTemplate(row.id)
      showToast('Alarm template deleted', 'success')
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const toggle = async (row) => {
    try {
      const nextActive = row.status !== 'Active'
      await emsApi.updateAlarmTemplate(row.id, { isActive: nextActive })
      if (row.alarmSettingId) {
        await emsApi.updateAlarmSetting(row.alarmSettingId, {
          status: nextActive ? 'ACTIVE' : 'INACTIVE',
        })
      }
      reload()
    } catch (e) {
      showToast(e.message || 'Toggle failed', 'error')
    }
  }

  const columns = [
    { key: 'name', label: 'Trigger Name' },
    { key: 'contactName', label: 'Contact', render: (v) => v || '—' },
    { key: 'template', label: 'Template Name' },
    { key: 'condition', label: 'Condition', render: (v) => <span className="badge badge-warning text-xs">{v}</span> },
    { key: 'founder', label: 'Founder' },
    { key: 'updatedAt', label: 'Update Time' },
  ]

  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }))
  const slaveOptions = slaves.map((s) => ({ value: s.id, label: s.name || s.displayName || s.id }))
  const variableOptions = variables.map((v) => ({ value: v.id, label: v.label }))

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Manage Alarm Templates</h2>
            <p className="breadcrumb">Manage Alarm Templates &ndash; List</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAdd}><Plus size={15} /> Add Alarm Templates</button>
        </div>

        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          searchPlaceholder="Search alarm templates..."
          emptyMessage="No data available in table"
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openView(row)} title="View"><Eye size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => toggle(row)} title="Toggle Status">
                {row.status === 'Active' ? <ToggleRight size={14} className="text-success-600" /> : <ToggleLeft size={14} className="text-surface-500" />}
              </button>
              <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Alarm Templates' : 'Edit Alarm Template'}
          size="lg"
          footer={(
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        >
          <div className="space-y-4">
            <p className="text-xs text-surface-400">Manage Alarm Templates &gt; {modal === 'add' ? 'Add Alarm Templates' : 'Edit Alarm Template'}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextInput
                label="Contact Name"
                required
                value={form.contactName}
                error={errors.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
              <TextInput
                label="Phone"
                required
                type="tel"
                value={form.phone}
                error={errors.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <TextInput
              label="Email"
              required
              type="email"
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />

            <TextInput
              label="Trigger Name"
              required
              placeholder="e.g. Overvoltage"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectInput
                label="Device Template"
                required
                placeholder="Select template"
                value={form.deviceTemplateId}
                error={errors.deviceTemplateId}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  deviceTemplateId: e.target.value || templateOptions[0]?.value || '',
                  slaveId: '',
                  templateVariableId: '',
                }))}
                options={templateOptions}
              />
              <SelectInput
                label="Device Slave"
                required
                placeholder={slavesLoading ? 'Loading…' : 'Select slave'}
                value={form.slaveId}
                error={errors.slaveId}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  slaveId: e.target.value || slaveOptions[0]?.value || '',
                  templateVariableId: '',
                }))}
                options={slaveOptions}
              />
              <SelectInput
                label="Template Variable"
                required
                placeholder={varsLoading ? 'Loading…' : 'Select variable'}
                value={form.templateVariableId}
                error={errors.templateVariableId}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  templateVariableId: e.target.value || variableOptions[0]?.value || '',
                }))}
                options={variableOptions}
              />
            </div>

            <SelectInput
              label="Triggering Condition"
              required
              value={form.condition}
              error={errors.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
              options={TRIGGER_CONDITIONS}
            />

            {(needsA(form.condition) || needsB(form.condition)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {needsA(form.condition) && (
                  <TextInput
                    label="Value A"
                    required
                    type="number"
                    value={form.thresholdA}
                    error={errors.thresholdA}
                    onChange={(e) => setForm((f) => ({ ...f, thresholdA: e.target.value }))}
                  />
                )}
                {needsB(form.condition) && (
                  <TextInput
                    label="Value B"
                    required
                    type="number"
                    value={form.thresholdB}
                    error={errors.thresholdB}
                    onChange={(e) => setForm((f) => ({ ...f, thresholdB: e.target.value }))}
                  />
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="label">Push Mechanism</p>
              <p className="text-xs text-surface-400">Value of the variable reaches the trigger condition</p>
              <RadioInput
                name="pushMechanism"
                value={form.pushMechanism}
                onChange={(v) => setForm((f) => ({ ...f, pushMechanism: v }))}
                options={[
                  { value: 'first_time', label: 'Pushing only first time' },
                  { value: 'silence', label: 'Alarm silence time' },
                ]}
              />
              {form.pushMechanism === 'silence' && (
                <TextInput
                  label="Silence duration (seconds)"
                  type="number"
                  value={form.silenceSeconds}
                  error={errors.silenceSeconds}
                  onChange={(e) => setForm((f) => ({ ...f, silenceSeconds: e.target.value }))}
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ToggleInput
                label="Alarm"
                checked={form.alarmEnabled}
                onChange={(v) => setForm((f) => ({ ...f, alarmEnabled: v }))}
              />
              <ToggleInput
                label="Linkage"
                checked={form.linkageEnabled}
                onChange={(v) => setForm((f) => ({ ...f, linkageEnabled: v }))}
              />
            </div>
          </div>
        </Modal>

        <Modal open={modal === 'view'} onClose={close} title="Alarm Template Details" size="sm">
          {selected && (
            <div className="space-y-3">
              {[
                ['Contact Name', selected.contactName || '—'],
                ['Phone', selected.contactPhone || '—'],
                ['Email', selected.contactEmail || '—'],
                ['Trigger Name', selected.name],
                ['Template Name', selected.template],
                ['Variable', selected.variable],
                ['Condition', selected.condition],
                ['Threshold A', selected.threshold],
                ['Threshold B', selected.thresholdB || '—'],
                ['Push', selected.pushMechanism === 'silence' ? `Silence ${selected.silenceSeconds}s` : 'First time only'],
                ['Alarm', selected.alarmEnabled ? 'On' : 'Off'],
                ['Linkage', selected.linkageEnabled ? 'On' : 'Off'],
                ['Founder', selected.founder],
                ['Status', selected.status],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm gap-4">
                  <span className="text-surface-400">{label}</span>
                  <span className="text-surface-900 font-medium text-right">{val}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
