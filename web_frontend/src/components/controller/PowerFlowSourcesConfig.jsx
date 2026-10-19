import { useState } from 'react'
import { Zap, Sun, Fuel, Cpu, Plus, Edit2, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import Modal from '../ui/Modal'
import { TextInput, SelectInput } from '../ui/FormFields'

const BUILTIN_META = {
  grid: { label: 'Grid / WAPDA', icon: Zap, badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  solar: { label: 'Solar Generation', icon: Sun, badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  generator: { label: 'Diesel / Backup Generator', icon: Fuel, badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  custom: { label: 'Custom Source', icon: Zap, badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
}

const EMPTY_SOURCE = {
  name: '',
  type: 'solar',
  siteId: '',
  deviceIds: [],
  slaveIds: [],
}

export default function PowerFlowSourcesConfig({
  sources = [],
  sites = [],
  devices = [],
  onChange,
  readOnly = false,
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSource, setEditingSource] = useState(null)
  const [formData, setFormData] = useState(EMPTY_SOURCE)
  const [deleteCandidate, setDeleteCandidate] = useState(null)

  const defaultSiteId = sites[0]?.id || 'site-1'

  const openAdd = () => {
    setEditingSource(null)
    setFormData({
      ...EMPTY_SOURCE,
      siteId: defaultSiteId,
    })
    setModalOpen(true)
  }

  const openEdit = (src) => {
    setEditingSource(src)
    setFormData({
      name: src.name || '',
      type: src.type || 'custom',
      siteId: src.siteId || defaultSiteId,
      deviceIds: Array.isArray(src.deviceIds) ? [...src.deviceIds] : [],
      slaveIds: Array.isArray(src.slaveIds) ? [...src.slaveIds] : [],
    })
    setModalOpen(true)
  }

  const handleSaveModal = () => {
    if (!formData.name.trim() || readOnly) return

    if (editingSource) {
      // Update existing source
      const nextSources = sources.map((s) => {
        if (s.id !== editingSource.id) return s
        return {
          ...s,
          name: formData.name.trim(),
          type: editingSource.type || formData.type,
          siteId: formData.siteId || defaultSiteId,
          deviceIds: formData.deviceIds,
          slaveIds: formData.slaveIds,
        }
      })
      onChange?.(nextSources)
    } else {
      // Create new source
      const newSource = {
        id: `source-${Date.now()}`,
        name: formData.name.trim(),
        type: formData.type || 'custom',
        siteId: formData.siteId || defaultSiteId,
        deviceIds: formData.deviceIds,
        slaveIds: formData.slaveIds,
        valueKw: 0,
      }
      onChange?.([...sources, newSource])
    }

    setModalOpen(false)
  }

  const handleDelete = (sourceId) => {
    if (readOnly) return
    const nextSources = sources.filter((s) => s.id !== sourceId)
    onChange?.(nextSources)
    setDeleteCandidate(null)
  }

  const toggleDevice = (devId) => {
    setFormData((prev) => {
      const exists = prev.deviceIds.includes(devId)
      return {
        ...prev,
        deviceIds: exists
          ? prev.deviceIds.filter((id) => id !== devId)
          : [...prev.deviceIds, devId],
      }
    })
  }

  const toggleSlave = (slvId) => {
    setFormData((prev) => {
      const exists = prev.slaveIds.includes(slvId)
      return {
        ...prev,
        slaveIds: exists
          ? prev.slaveIds.filter((id) => id !== slvId)
          : [...prev.slaveIds, slvId],
      }
    })
  }

  const getSiteName = (siteId) => {
    const s = sites.find((x) => x.id === siteId)
    return s?.name || siteId || 'Unassigned'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">
            Energy Flow Power Sources
          </h3>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            Define plant generation and intake sources, link electrical meters/slaves, and associate with factory sites.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openAdd}
            className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 self-start sm:self-auto font-bold"
          >
            <Plus size={14} /> Add Source
          </button>
        )}
      </div>

      {/* Sources List / Table */}
      <div className="border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-surface-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/60 border-b border-surface-200 dark:border-surface-800 text-surface-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Source Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Site Location</th>
                <th className="py-3 px-4">Linked Slaves & Meters</th>
                <th className="py-3 px-4 text-right">Live Telemetry</th>
                {!readOnly && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 5 : 6} className="py-8 text-center text-surface-400">
                    No power sources configured. Click "Add Source" to register Grid, Solar, or Generator meters.
                  </td>
                </tr>
              ) : (
                sources.map((src) => {
                  const meta = BUILTIN_META[src.type] || BUILTIN_META.custom
                  const Icon = meta.icon
                  const nSlv = (src.slaveIds || []).length
                  const nDev = (src.deviceIds || []).length
                  const isBuiltin = ['grid', 'solar', 'generator'].includes(src.id)

                  return (
                    <tr key={src.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-primary-600 flex-shrink-0">
                            <Icon size={14} />
                          </div>
                          <div>
                            <span className="font-bold text-surface-900 dark:text-surface-100">
                              {src.name}
                            </span>
                            <p className="text-[10px] text-surface-400 font-mono">ID: {src.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.badgeColor}`}>
                          {src.type?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-surface-700 dark:text-surface-300">
                        {getSiteName(src.siteId)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-surface-600 dark:text-surface-400">
                          {nSlv && nDev
                            ? `${nSlv} slave${nSlv !== 1 ? 's' : ''}, ${nDev} device${nDev !== 1 ? 's' : ''}`
                            : nSlv
                              ? `${nSlv} slave${nSlv !== 1 ? 's' : ''}`
                              : nDev
                                ? `${nDev} device${nDev !== 1 ? 's' : ''}`
                                : 'No meters linked'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-surface-900 dark:text-surface-100">
                        {(Number(src.valueKw) || 0).toFixed(2)} kW
                      </td>
                      {!readOnly && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(src)}
                              className="p-1.5 rounded-lg text-surface-500 hover:text-primary-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                              title="Edit Source"
                            >
                              <Edit2 size={13} />
                            </button>
                            {!isBuiltin && (
                              <button
                                type="button"
                                onClick={() => setDeleteCandidate(src)}
                                className="p-1.5 rounded-lg text-surface-500 hover:text-danger-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                                title="Delete Source"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={editingSource ? `Edit Source: ${editingSource.name}` : 'Add Power Source'}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!formData.name.trim() || (!formData.slaveIds.length && !formData.deviceIds.length)}
              onClick={handleSaveModal}
            >
              {editingSource ? 'Save Changes' : 'Create Source'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Source Name"
            required
            placeholder="e.g. Rooftop Solar Array, Generator #1, WAPDA Feeder"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectInput
              label="Source Type"
              required
              disabled={editingSource && ['grid', 'solar', 'generator'].includes(editingSource.id)}
              value={formData.type}
              onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
              options={[
                { value: 'grid', label: 'Grid / WAPDA' },
                { value: 'solar', label: 'Solar Generation' },
                { value: 'generator', label: 'Backup Generator' },
                { value: 'custom', label: 'Custom' },
              ]}
            />

            <SelectInput
              label="Assigned Site"
              required
              value={formData.siteId}
              onChange={(e) => setFormData((f) => ({ ...f, siteId: e.target.value }))}
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">
                Link Telemetry Meters & Slaves
                <span className="text-danger-600 font-bold ml-0.5">*</span>
              </label>
              <span className="text-xs text-primary-600 font-bold">
                {formData.slaveIds.length + formData.deviceIds.length} linked
              </span>
            </div>
            <p className="text-[11px] text-surface-400 mb-2">
              Select the meters or Modbus slaves whose telemetry feeds this source's real-time active power.
            </p>

            <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-56 overflow-y-auto">
              {devices.length === 0 ? (
                <div className="p-4 text-center text-xs text-surface-400">
                  No devices available in this organization.
                </div>
              ) : (
                devices.map((d) => {
                  const dSlaves = d.slaves || d.configSlaves || d._raw?.configSlaves || []
                  return (
                    <div key={d.id} className="bg-white dark:bg-surface-900 divide-y divide-surface-50 dark:divide-surface-800/60">
                      <div className="flex items-center gap-2.5 px-3 py-2 bg-surface-50/80 dark:bg-surface-800/40">
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-surface-300 text-primary-600"
                            checked={formData.deviceIds.includes(d.id)}
                            onChange={() => toggleDevice(d.id)}
                          />
                          <Cpu size={13} className="text-primary-600 flex-shrink-0" />
                          <span className="text-xs font-bold text-surface-900 dark:text-surface-100">{d.name}</span>
                        </label>
                        <span className={`badge text-[9px] ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                          {d.status}
                        </span>
                      </div>

                      {dSlaves.length > 0 && (
                        <div className="pl-6 pr-3 py-1 space-y-1 bg-surface-50/20 dark:bg-surface-950/20">
                          {dSlaves.map((slv) => (
                            <label
                              key={slv.id}
                              className="flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer hover:bg-surface-100/60 dark:hover:bg-surface-800/60 transition-colors"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-surface-300 text-primary-600"
                                checked={formData.slaveIds.includes(slv.id)}
                                onChange={() => toggleSlave(slv.id)}
                              />
                              <span className="text-xs text-surface-700 dark:text-surface-300 flex-1">
                                {slv.name}
                                {slv.isDefault && (
                                  <span className="ml-1 text-[9px] text-surface-400">(Default)</span>
                                )}
                              </span>
                              <span className="badge badge-info text-[8px] py-0 px-1">Slave</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            {formData.deviceIds.length === 0 && formData.slaveIds.length === 0 && (
              <p className="text-[11px] text-danger-600 mt-1 font-semibold">
                Please link at least one slave or device to measure live kW.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteCandidate !== null}
        onClose={() => setDeleteCandidate(null)}
        size="sm"
        title="Delete Power Source"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeleteCandidate(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => deleteCandidate && handleDelete(deleteCandidate.id)}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-xs text-surface-600 dark:text-surface-300">
          Are you sure you want to remove <strong>{deleteCandidate?.name}</strong>?
          This will unbind its associated telemetry from the organization's Energy Flow overview.
        </p>
      </Modal>
    </div>
  )
}
