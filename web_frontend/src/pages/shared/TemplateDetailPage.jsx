import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState from '../../components/ui/PageState'
import { TextInput, TextareaInput, ToggleInput, SelectInput } from '../../components/ui/FormFields'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import emsApi, { list, one } from '../../api/emsApi'

export default function TemplateDetailPage({ basePath }) {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'org'

  const [template, setTemplate] = useState(null)
  const [slaves, setSlaves] = useState([])
  const [variables, setVariables] = useState([])
  const [selectedSlaveId, setSelectedSlaveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!templateId) return
    setLoading(true)
    setError(null)
    try {
      const [tRes, sRes] = await Promise.all([
        emsApi.getDeviceTemplate(templateId),
        emsApi.getTemplateSlaves(templateId),
      ])
      setTemplate(one(tRes))
      const slaveList = list(sRes).map((s) => ({ ...s, varCount: s._count?.variables ?? 0 }))
      setSlaves(slaveList)
      const sid = selectedSlaveId && slaveList.some((s) => s.id === selectedSlaveId)
        ? selectedSlaveId
        : slaveList[0]?.id ?? null
      setSelectedSlaveId(sid)
      if (sid) {
        const vRes = await emsApi.getTemplateVariables(templateId, sid)
        setVariables(list(vRes))
      } else {
        setVariables([])
      }
    } catch (e) {
      setError(e.message || 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }, [templateId, selectedSlaveId])

  useEffect(() => { load() }, [templateId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!templateId || !selectedSlaveId) return
    emsApi.getTemplateVariables(templateId, selectedSlaveId)
      .then((res) => setVariables(list(res)))
      .catch(() => setVariables([]))
  }, [templateId, selectedSlaveId])

  const openSlaveModal = (slave = null) => {
    setForm(slave ? { name: slave.name, description: slave.description ?? '', isDefault: !!slave.isDefault } : { name: '', description: '', isDefault: false })
    setModal(slave ? { type: 'editSlave', id: slave.id } : { type: 'addSlave' })
  }

  const openVarModal = (v = null) => {
    setForm(v ? {
      name: v.name, displayName: v.displayName ?? '', unit: v.unit ?? '',
      registerAddress: v.registerAddress ?? '', dataType: v.dataType ?? 'FLOAT',
    } : { name: '', displayName: '', unit: '', registerAddress: '', dataType: 'FLOAT' })
    setModal(v ? { type: 'editVar', id: v.id } : { type: 'addVar' })
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal?.type === 'addSlave') {
        await emsApi.createTemplateSlave(templateId, form)
      } else if (modal?.type === 'editSlave') {
        await emsApi.updateTemplateSlave(templateId, modal.id, form)
      } else if (modal?.type === 'addVar' && selectedSlaveId) {
        await emsApi.createTemplateVariable(templateId, selectedSlaveId, form)
      } else if (modal?.type === 'editVar' && selectedSlaveId) {
        await emsApi.updateTemplateVariable(templateId, selectedSlaveId, modal.id, form)
      }
      setModal(null)
      showToast('Saved', 'success')
      load()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeSlave = async (id) => {
    if (!confirm('Delete this slave?')) return
    try {
      await emsApi.deleteTemplateSlave(templateId, id)
      load()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const removeVar = async (id) => {
    if (!confirm('Delete this variable?')) return
    try {
      await emsApi.deleteTemplateVariable(templateId, selectedSlaveId, id)
      load()
    } catch (e) {
      showToast(e.message || 'Delete failed', 'error')
    }
  }

  const slaveColumns = [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'isDefault', label: 'Default', render: (v) => (v ? 'Yes' : '—') },
    { key: 'varCount', label: 'Variables' },
  ]

  const varColumns = [
    { key: 'name', label: 'Name' },
    { key: 'displayName', label: 'Display Name' },
    { key: 'unit', label: 'Unit' },
    { key: 'registerAddress', label: 'Register' },
    { key: 'dataType', label: 'Type' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={load}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-ghost p-2" onClick={() => navigate(`${basePath}/device-templates`)}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="page-title">{template?.name ?? 'Template'}</h2>
            <p className="breadcrumb">{template?.acquisitionMethod ?? '—'} · {slaves.length} slaves</p>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Slaves / Meters</h3>
            {canEdit && (
              <button type="button" className="btn-primary text-xs" onClick={() => openSlaveModal()}>
                <Plus size={14} /> Add Slave
              </button>
            )}
          </div>
          <DataTable
            columns={slaveColumns}
            data={slaves}
            searchPlaceholder="Search slaves..."
            actions={canEdit ? (row) => (
              <>
                <button type="button" className="btn-ghost p-1.5" onClick={() => { setSelectedSlaveId(row.id); openSlaveModal(row) }}><Pencil size={14} /></button>
                <button type="button" className="btn-ghost p-1.5" onClick={() => setSelectedSlaveId(row.id)} title="View variables">Vars</button>
                <button type="button" className="btn-danger p-1.5" onClick={() => removeSlave(row.id)}><Trash2 size={14} /></button>
              </>
            ) : (row) => (
              <button type="button" className="btn-ghost text-xs" onClick={() => setSelectedSlaveId(row.id)}>Variables</button>
            )}
          />
        </div>

        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-bold">Variables {selectedSlaveId ? `— ${slaves.find((s) => s.id === selectedSlaveId)?.name ?? ''}` : ''}</h3>
            {canEdit && selectedSlaveId && (
              <button type="button" className="btn-primary text-xs" onClick={() => openVarModal()}>
                <Plus size={14} /> Add Variable
              </button>
            )}
          </div>
          {!selectedSlaveId ? (
            <p className="text-sm text-surface-500 py-6 text-center">Select a slave to view variables</p>
          ) : (
            <DataTable
              columns={varColumns}
              data={variables}
              searchPlaceholder="Search variables..."
              actions={canEdit ? (row) => (
                <>
                  <button type="button" className="btn-ghost p-1.5" onClick={() => openVarModal(row)}><Pencil size={14} /></button>
                  <button type="button" className="btn-danger p-1.5" onClick={() => removeVar(row.id)}><Trash2 size={14} /></button>
                </>
              ) : undefined}
            />
          )}
        </div>

        <Modal
          open={!!modal}
          onClose={() => setModal(null)}
          title={modal?.type?.includes('Slave') ? (modal.type === 'addSlave' ? 'Add Slave' : 'Edit Slave') : (modal?.type === 'addVar' ? 'Add Variable' : 'Edit Variable')}
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </>
          }
        >
          {modal?.type?.includes('Slave') ? (
            <div className="space-y-4">
              <TextInput label="Name" required value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <TextareaInput label="Description" value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              <ToggleInput label="Default slave" checked={!!form.isDefault} onChange={(v) => setForm((f) => ({ ...f, isDefault: v }))} />
            </div>
          ) : (
            <div className="space-y-4">
              <TextInput label="Name" required value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <TextInput label="Display Name" value={form.displayName ?? ''} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
              <TextInput label="Unit" value={form.unit ?? ''} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
              <TextInput label="Register Address" value={form.registerAddress ?? ''} onChange={(e) => setForm((f) => ({ ...f, registerAddress: e.target.value }))} />
              <SelectInput label="Data Type" value={form.dataType ?? 'FLOAT'}
                onChange={(e) => setForm((f) => ({ ...f, dataType: e.target.value }))}
                options={['FLOAT', 'INTEGER', 'BOOLEAN', 'STRING']} />
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  )
}
