import { useState, useEffect, useMemo } from 'react'
import Modal from '../ui/Modal'
import { WIDGET_TYPES, METRIC_OPTIONS, GROUP_BY_OPTIONS, COLOR_THEMES } from '../../data/widgetCatalog'
import { TIME_RANGES, findNodeInTree } from '../../data/facilitiesHierarchy'
import { Network, Building, Layers, Folder, Cpu, Activity, HelpCircle } from 'lucide-react'
import { fetchDeviceVariables } from '../../utils/sensorReadings'
import { resolveBrandPrimary } from '../../utils/branding'

function getNodeIcon(type) {
  switch (type) {
    case 'Campus': return <Network size={12} className="text-primary-500" />
    case 'Site':
    case 'Building': return <Building size={12} className="text-info-500" />
    case 'Block':
    case 'Wing':
    case 'Floor': return <Layers size={12} className="text-warning-500" />
    case 'Department':
    case 'Section':
    case 'Room': return <Folder size={12} className="text-success-500" />
    case 'Device': return <Cpu size={12} className="text-primary-600" />
    case 'Sensor': return <Activity size={12} className="text-danger-500" />
    default: return <HelpCircle size={12} className="text-surface-400" />
  }
}

export default function WidgetSettingsModal({ open, onClose, widget, hierarchy, onSave, devices = [], dashboardDeviceId = null }) {
  const [form, setForm] = useState(null)
  const [deviceVars, setDeviceVars] = useState([])

  useEffect(() => {
    if (widget) {
      let nodeId = widget.scopeOverride?.nodeId
      if (!nodeId && widget.scopeOverride) {
        if (widget.scopeOverride.departmentId) nodeId = widget.scopeOverride.departmentId
        else if (widget.scopeOverride.floorId) nodeId = widget.scopeOverride.floorId
        else if (widget.scopeOverride.buildingId) nodeId = widget.scopeOverride.buildingId
      }
      setForm({
        type: widget.type || 'line',
        title: widget.title,
        metric: widget.variableName || widget.metric,
        variableName: widget.variableName || '',
        unit: widget.unit || '',
        content: widget.content ?? '',
        thresholds: widget.thresholds || [],
        metrics: widget.metrics || null,
        groupBy: widget.groupBy || 'none',
        color: widget.color,
        timeRange: widget.timeRange || 'inherit',
        targetDeviceId: widget.targetDeviceId || '',
        overrideScope: !!widget.scopeOverride,
        nodeId: nodeId || '',
      })
    }
  }, [widget])

  const effectiveDeviceId = form?.targetDeviceId || dashboardDeviceId || ''

  useEffect(() => {
    if (!open || !effectiveDeviceId) {
      setDeviceVars([])
      return undefined
    }
    let cancelled = false
    fetchDeviceVariables(effectiveDeviceId)
      .then((vars) => { if (!cancelled) setDeviceVars(vars) })
      .catch(() => { if (!cancelled) setDeviceVars([]) })
    return () => { cancelled = true }
  }, [open, effectiveDeviceId])

  const metricOptions = useMemo(() => {
    const fromDevice = deviceVars.map((v) => ({
      value: v.name,
      label: `${v.name}${v.unit ? ` (${v.unit})` : ''}`,
      unit: v.unit || '',
    }))
    const system = METRIC_OPTIONS.filter((m) =>
      ['devicesOnline', 'activeAlarms', '_none', 'cost', 'carbonEmissions'].includes(m.value)
      || !fromDevice.length
    )
    return fromDevice.length ? [...fromDevice, ...system.filter((m) => ['devicesOnline', 'activeAlarms', '_none', 'cost', 'carbonEmissions'].includes(m.value))] : METRIC_OPTIONS
  }, [deviceVars])

  if (!open || !form) return null

  const supportsGroupBy = ['bar', 'pie', 'table'].includes(form.type)
  const tree = hierarchy?.tree || []
  const match = form.nodeId ? findNodeInTree(tree, form.nodeId) : null
  const selectedPath = match ? match.path : []

  const dropdownLevels = []
  dropdownLevels.push({
    levelName: tree[0]?.type || 'Campus',
    options: tree,
    selectedValue: selectedPath[0]?.id || '',
  })
  for (let i = 0; i < selectedPath.length; i++) {
    const currentNode = selectedPath[i]
    if (currentNode.children?.length) {
      dropdownLevels.push({
        levelName: currentNode.children[0].type,
        options: currentNode.children,
        selectedValue: selectedPath[i + 1]?.id || '',
      })
    }
  }

  function handleSelectChange(depth, selectedId) {
    if (!selectedId) {
      if (depth === 0) setForm((f) => ({ ...f, nodeId: '' }))
      else setForm((f) => ({ ...f, nodeId: selectedPath[depth - 1].id }))
    } else {
      setForm((f) => ({ ...f, nodeId: selectedId }))
    }
  }

  function handleSave() {
    let scopeOverride = null
    if (form.overrideScope && form.nodeId) {
      const found = findNodeInTree(tree, form.nodeId)
      if (found) {
        const n = found.node
        const p = found.path
        scopeOverride = {
          level: n.type.toLowerCase(),
          nodeId: n.id,
          buildingId: p.find((node) => node.type === 'Building')?.id || null,
          floorId: p.find((node) => node.type === 'Floor')?.id || null,
          departmentId: p.find((node) => node.type === 'Department')?.id || null,
        }
      }
    } else if (form.overrideScope) {
      scopeOverride = { level: 'organization', nodeId: null }
    }

    const device = devices.find((d) => d.id === form.targetDeviceId)
    const selected = metricOptions.find((m) => m.value === form.metric)
    const isSystem = ['devicesOnline', 'activeAlarms', '_none', 'cost', 'carbonEmissions'].includes(form.metric)
    const resolvedVar = isSystem ? null : (form.variableName || form.metric)
    onSave({
      type: form.type,
      title: form.title,
      metric: isSystem ? form.metric : (resolvedVar || 'activePower'),
      variableName: resolvedVar,
      unit: selected?.unit || form.unit || null,
      content: form.content ?? '',
      thresholds: form.thresholds || [],
      metrics: form.type === 'multiseries' ? (form.metrics || []) : undefined,
      groupBy: supportsGroupBy ? form.groupBy : 'none',
      color: form.color,
      timeRange: form.timeRange,
      targetDeviceId: form.targetDeviceId || null,
      targetDevice: device?.name || null,
      scopeOverride,
    })
    onClose()
  }

  const activeColorTheme = form.color === 'primary'
    ? resolveBrandPrimary()
    : (COLOR_THEMES.find((c) => c.value === form.color)?.hex || resolveBrandPrimary())

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Widget Settings"
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSave}>Save Changes</button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label">Visualization Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WIDGET_TYPES.map((w) => {
              const Icon = w.icon
              const active = form.type === w.type
              return (
                <button
                  key={w.type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: w.type }))}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                    active ? 'border-primary-500 bg-primary-100/40 text-primary-700' : 'border-surface-200 hover:bg-surface-50 text-surface-600'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[11px] font-bold leading-tight">{w.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="label">Widget Title</label>
          <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>

        {form.type === 'text' && (
          <div>
            <label className="label">Panel Content (Markdown)</label>
            <textarea
              className="input font-mono text-xs leading-relaxed"
              rows={6}
              value={form.content ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.type === 'multiseries' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Metrics (2–4 series)</label>
                {(form.metrics || []).length < 4 && (
                  <button
                    type="button"
                    className="text-[10px] font-bold text-primary-600"
                    onClick={() => setForm((f) => {
                      const first = deviceVars[0]?.name || 'activePower'
                      return {
                        ...f,
                        metrics: [
                          ...(f.metrics || [{ key: form.metric || first, variableName: form.variableName || first, label: '', color: activeColorTheme }]),
                          { key: first, variableName: first, label: '', color: '#16A34A' },
                        ],
                      }
                    })}
                  >
                    + Add series
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {(form.metrics || [{ key: form.metric || 'energyConsumption', label: '', color: activeColorTheme }]).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={s.color}
                      className="w-8 h-8 rounded border border-surface-200 cursor-pointer p-0.5"
                      onChange={(e) => setForm((f) => {
                        const next = [...(f.metrics || [])]
                        next[i] = { ...next[i], color: e.target.value }
                        return { ...f, metrics: next }
                      })}
                    />
                    <select
                      className="select flex-1 text-xs"
                      value={s.variableName || s.key}
                      onChange={(e) => setForm((f) => {
                        const next = [...(f.metrics || [])]
                        const v = e.target.value
                        const isSys = ['devicesOnline', 'activeAlarms', 'cost', 'carbonEmissions'].includes(v)
                        next[i] = {
                          ...next[i],
                          key: v,
                          variableName: isSys ? null : v,
                          label: metricOptions.find((m) => m.value === v)?.label || v,
                        }
                        return { ...f, metrics: next }
                      })}
                    >
                      {metricOptions.filter((m) => m.value !== '_none').map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    {i > 0 && (
                      <button
                        type="button"
                        className="text-danger-500 text-xs font-bold"
                        onClick={() => setForm((f) => ({ ...f, metrics: (f.metrics || []).filter((_, idx) => idx !== i) }))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="label">Data / Metric</label>
              <select
                className="select"
                value={form.metric}
                onChange={(e) => {
                  const v = e.target.value
                  const selected = metricOptions.find((m) => m.value === v)
                  setForm((f) => ({
                    ...f,
                    metric: v,
                    variableName: ['devicesOnline', 'activeAlarms', '_none', 'cost', 'carbonEmissions'].includes(v) ? '' : v,
                    unit: selected?.unit || '',
                  }))
                }}
              >
                {metricOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Color Theme</label>
            <div className="flex items-center gap-2">
              {COLOR_THEMES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                  className={`w-7 h-7 rounded-full border-2 ${form.color === c.value ? 'border-surface-900' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value === 'primary' ? resolveBrandPrimary() : c.hex }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <Cpu size={12} className="text-primary-600" /> Target Device
            </label>
            <select className="select" value={form.targetDeviceId} onChange={(e) => setForm((f) => ({ ...f, targetDeviceId: e.target.value }))}>
              <option value="">Inherit Dashboard Device</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Time Range</label>
            <select className="select" value={form.timeRange} onChange={(e) => setForm((f) => ({ ...f, timeRange: e.target.value }))}>
              <option value="inherit">Inherit from dashboard filter</option>
              {Object.entries(TIME_RANGES).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {supportsGroupBy && (
          <div>
            <label className="label">Grouping</label>
            <select className="select" value={form.groupBy} onChange={(e) => setForm((f) => ({ ...f, groupBy: e.target.value }))}>
              {GROUP_BY_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        )}

        {['stat', 'gauge'].includes(form.type) && (
          <div className="pt-3 border-t border-surface-100">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Thresholds</label>
              <button
                type="button"
                className="text-[10px] font-bold text-primary-600"
                onClick={() => setForm((f) => ({
                  ...f,
                  thresholds: [
                    ...(f.thresholds || []),
                    { value: (f.thresholds?.length ? f.thresholds[f.thresholds.length - 1].value + 20 : 80), color: resolveBrandPrimary() },
                  ].sort((a, b) => a.value - b.value),
                }))}
              >
                + Add threshold
              </button>
            </div>
            <div className="space-y-2">
              {(form.thresholds || []).map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={t.color}
                    className="w-8 h-8 rounded cursor-pointer border border-surface-200 p-0.5"
                    onChange={(e) => setForm((f) => {
                      const next = [...f.thresholds]
                      next[i] = { ...next[i], color: e.target.value }
                      return { ...f, thresholds: next }
                    })}
                  />
                  <span className="text-xs text-surface-500 font-bold w-16">≥ value</span>
                  <input
                    type="number"
                    className="input w-20 text-sm"
                    value={t.value}
                    onChange={(e) => setForm((f) => {
                      const next = [...f.thresholds]
                      next[i] = { ...next[i], value: Number(e.target.value) }
                      return { ...f, thresholds: next }
                    })}
                  />
                  <button
                    type="button"
                    className="text-danger-500 text-xs font-bold"
                    onClick={() => setForm((f) => ({ ...f, thresholds: f.thresholds.filter((_, idx) => idx !== i) }))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-surface-100">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={form.overrideScope}
              onChange={(e) => setForm((f) => ({ ...f, overrideScope: e.target.checked, nodeId: '' }))}
            />
            <span className="text-xs font-bold text-surface-700 uppercase tracking-wide">Pin this widget to a fixed scope</span>
          </label>
          {form.overrideScope && (
            <div className="flex flex-wrap gap-3 p-3 inset-panel">
              {dropdownLevels.map((lvl, index) => (
                <div key={index} className="flex items-center gap-1.5 text-surface-500">
                  {getNodeIcon(lvl.levelName)}
                  <select
                    className="select text-xs py-1 px-2 w-auto min-w-[7.5rem]"
                    value={lvl.selectedValue}
                    onChange={(e) => handleSelectChange(index, e.target.value)}
                  >
                    <option value="">All {lvl.levelName}s</option>
                    {lvl.options.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
