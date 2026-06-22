import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageState, { useFetch } from '../../components/ui/PageState'
import { TextInput, SelectInput } from '../../components/ui/FormFields'
import { Eye, Pencil, List } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import { mapDeviceTemplate } from '../../utils/mappers'
import { useToast } from '../../context/ToastContext'

export default function OrgDeviceTemplates() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { data: rows, loading, error, reload } = useFetch(
    async () => list(await emsApi.getDeviceTemplates({ limit: 100 })).map(mapDeviceTemplate),
    []
  )
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', method: 'Modbus RTU' })
  const [saving, setSaving] = useState(false)
  const [vars, setVars] = useState([])

  const openView = async (row) => {
    setSelected(row)
    setModal('view')
    try {
      const slavesRes = await emsApi.getTemplateSlaves(row.id)
      const slaves = list(slavesRes)
      if (slaves[0]?.id) {
        const varsRes = await emsApi.getTemplateVariables(row.id, slaves[0].id)
        setVars(list(varsRes).map((v) => `${v.name}${v.unit ? ` (${v.unit})` : ''}`))
      } else {
        setVars([])
      }
    } catch {
      setVars([])
    }
  }
  const openEdit = (row) => {
    setSelected(row)
    setForm({ name: row.name, method: row.method })
    setModal('edit')
  }
  const close = () => { setModal(null); setSelected(null); setVars([]) }

  const handleSave = async () => {
    setSaving(true)
    try {
      await emsApi.updateDeviceTemplate(selected.id, {
        name: form.name,
        acquisitionMethod: form.method,
      })
      close()
      reload()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'name', label: 'Template Name' },
    { key: 'variables', label: 'Variables Count', render: (v) => <span className="badge badge-info">{v}</span> },
    { key: 'devices', label: 'Devices Using It', render: (v) => <span className="badge badge-neutral">{v}</span> },
    { key: 'method', label: 'Communication Method', render: (v) => (
      <span className={`badge ${v === 'Modbus TCP' ? 'badge-success' : 'badge-warning'}`}>{v}</span>
    )},
    { key: 'createdAt', label: 'Last Updated', render: (v) => <span className="text-xs text-surface-400">{v}</span> },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div>
        <div className="page-header">
          <div>
            <h2 className="page-title">Device Templates</h2>
            <p className="breadcrumb">Organization / Device Templates</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-surface-500 bg-surface-100 border border-surface-200 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-warning-500 inline-block" />
            Templates are managed by your administrator
          </div>
        </div>

        <DataTable
          columns={columns}
          data={(rows ?? []).map((r) => ({ ...r, updatedAt: r.createdAt }))}
          searchPlaceholder="Search templates..."
          actions={(row) => (
            <>
              <button type="button" className="btn-ghost p-1.5" onClick={() => navigate(`/org/device-templates/${row.id}`)} title="Slaves & Variables"><List size={14} /></button>
              <button type="button" className="btn-ghost p-1.5" onClick={() => openEdit(row)} title="Edit"><Pencil size={14} /></button>
            </>
          )}
        />

        <Modal open={modal === 'view'} onClose={close} title="Template Details" size="lg">
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[['Template Name', selected.name], ['Communication Method', selected.method], ['Variables Count', selected.variables], ['Devices Using It', selected.devices], ['Last Updated', selected.createdAt], ['Organization', selected.org]].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-surface-500 mb-0.5">{label}</p>
                    <p className="text-sm text-surface-800 font-medium">{value}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-surface-200 pt-4">
                <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-3">Template Variables</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vars.length === 0 ? (
                    <p className="text-xs text-surface-500 col-span-2">No variables loaded.</p>
                  ) : vars.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 bg-surface-100 rounded-lg px-3 py-2">
                      <span className="text-xs text-surface-500 font-mono w-5 flex-shrink-0">{i + 1}</span>
                      <span className="text-xs text-surface-700">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={modal === 'edit'}
          onClose={close}
          title="Edit Template"
          footer={
            <>
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <TextInput label="Template Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <SelectInput label="Communication Method" value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              options={['Modbus RTU', 'Modbus TCP']} />
          </div>
        </Modal>
      </div>
    </PageState>
  )
}
