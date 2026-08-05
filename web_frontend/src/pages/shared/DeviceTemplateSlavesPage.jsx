import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput, ToggleInput } from '../../components/ui/FormFields'
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react'
import emsApi, { list, one } from '../../api/emsApi'
import { useToast } from '../../context/ToastContext'
import { PROTOCOL_OPTIONS, formatSyncToast } from '../../data/slaveVariables'
import VariablesModal from '../../components/admin/VariablesModal'

const blankSlave = { name: '', protocol: 'Modbus RTU', description: '', isDefault: false }

/**
 * Shared portal-style Device Template Slaves page (admin + org).
 * Pass readOnly for ORG_ADMIN view-only (no add/edit/delete).
 * @param {{ basePath?: string, readOnly?: boolean }} props
 */
export default function DeviceTemplateSlavesPage({ basePath = '/admin', readOnly = false }) {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const listPath = `${basePath}/device-templates`

  const { data, loading, error, reload } = useFetch(async () => {
    const [tplRes, slavesRes] = await Promise.all([
      emsApi.getDeviceTemplate(templateId),
      emsApi.getTemplateSlaves(templateId, { limit: 200 }),
    ])
    const template = one(tplRes)
    const slaves = list(slavesRes).map((s) => ({
      ...s,
      variableCount: s._count?.variables ?? s.variables?.length ?? 0,
      protocol: s.protocol || 'Modbus RTU',
    }))
    return { template, slaves }
  }, [templateId])

  const template = data?.template
  const slaves = data?.slaves ?? []

  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blankSlave)
  const [selectedIds, setSelectedIds] = useState([])
  const [saving, setSaving] = useState(false)

  const toastSync = (sync) => {
    const msg = formatSyncToast(sync)
    if (msg) showToast(msg, 'success')
  }

  const openAdd = () => { setForm(blankSlave); setModal('add') }
  const openEdit = (row) => {
    setSelected(row)
    setForm({
      name: row.name,
      protocol: row.protocol || 'Modbus RTU',
      description: row.description || '',
      isDefault: !!row.isDefault,
    })
    setModal('edit')
  }
  const openVariables = (row) => { setSelected(row); setModal('variables') }
  const close = () => { setModal(null); setSelected(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        protocol: form.protocol,
        description: form.description || null,
        isDefault: !!form.isDefault,
      }
      let res
      if (modal === 'add') {
        res = await emsApi.createTemplateSlave(templateId, body)
        showToast('Slave created', 'success')
      } else {
        res = await emsApi.updateTemplateSlave(templateId, selected.id, body)
        showToast('Slave updated', 'success')
      }
      toastSync(res?.sync)
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete slave "${row.name}"?`)) return
    try {
      const res = await emsApi.deleteTemplateSlave(templateId, row.id)
      showToast('Slave deleted', 'success')
      toastSync(res?.sync)
      setSelectedIds((prev) => prev.filter((id) => id !== row.id))
      reload()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} selected slave(s)?`)) return
    let lastSync = null
    try {
      for (const id of selectedIds) {
        const res = await emsApi.deleteTemplateSlave(templateId, id)
        lastSync = res?.sync
      }
      showToast(`Deleted ${selectedIds.length} slave(s)`, 'success')
      toastSync(lastSync)
      setSelectedIds([])
      reload()
    } catch (e) {
      showToast(e.message || 'Batch delete failed', 'error')
      reload()
    }
  }

  const setDefaultSlave = async (row) => {
    if (readOnly || row.isDefault) return
    try {
      const res = await emsApi.updateTemplateSlave(templateId, row.id, {
        name: row.name,
        protocol: row.protocol,
        description: row.description,
        isDefault: true,
      })
      toastSync(res?.sync)
      reload()
    } catch (e) {
      showToast(e.message || 'Failed to set default', 'error')
    }
  }

  const onVariablesChanged = useCallback(() => { reload() }, [reload])

  const methodLabel = template?.acquisitionMethod || template?.method || '—'

  const columns = [
    { key: 'name', label: 'Slave Name' },
    { key: 'protocol', label: 'Protocols & Drivers' },
    {
      key: 'variableCount',
      label: 'No Of Variables',
      sortable: false,
      render: (v) => <span className="badge badge-info">{v ?? 0}</span>,
    },
    {
      key: 'isDefault',
      label: 'Default',
      sortable: false,
      render: (v, row) => (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setDefaultSlave(row)}
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${v ? 'border-info-600' : 'border-surface-300 dark:border-surface-700'}`}
          title={v ? 'Default slave' : 'Set as default'}
        >
          {v && <span className="w-2 h-2 rounded-full bg-info-600" />}
        </button>
      ),
    },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Device Template Slave</h2>
            <p className="breadcrumb">{template?.name || 'Template'} &ndash; Slave List</p>
            <p className="text-xs text-surface-400 mt-0.5">Acquisition Methods &ndash; {methodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <button type="button" className="btn-primary" onClick={openAdd}>
                <Plus size={15} /> Add Slave
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => navigate(listPath)}>
              <ArrowLeft size={14} /> Back to Templates
            </button>
            {!readOnly && (
              <button type="button" className="btn-secondary" onClick={handleBatchDelete} disabled={!selectedIds.length}>
                Batch Delete
              </button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={slaves}
          searchPlaceholder="Search slaves..."
          selectable={!readOnly}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          actions={(row) => (
            <>
              {!readOnly && (
                <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit">
                  <Pencil size={14} />
                </button>
              )}
              <button
                type="button"
                className="btn-ghost p-1.5 text-info-600 font-bold"
                onClick={() => openVariables(row)}
                title="Variables"
              >
                V
              </button>
              {!readOnly && (
                <button type="button" className="btn-danger p-1.5" onClick={() => handleDelete(row)} title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        />

        <Modal
          open={modal === 'add' || modal === 'edit'}
          onClose={close}
          title={modal === 'add' ? 'Add Slave' : 'Edit Slave'}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : modal === 'add' ? 'Create' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <TextInput
              label="Slave Name"
              required
              placeholder="e.g. EVBCharger"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <SelectInput
              label="Protocols & Drivers"
              value={form.protocol}
              onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value }))}
              options={PROTOCOL_OPTIONS}
            />
            <TextInput
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <ToggleInput
              label="Default Slave"
              description="Use this slave's variables on the device main page"
              checked={form.isDefault}
              onChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
            />
          </div>
        </Modal>

        {modal === 'variables' && selected && (
          <VariablesModal
            templateId={templateId}
            slave={selected}
            allSlaves={slaves}
            onClose={close}
            onChanged={onVariablesChanged}
            readOnly={readOnly}
          />
        )}
      </div>
    </PageState>
  )
}
