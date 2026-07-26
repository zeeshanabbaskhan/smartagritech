import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { WIDGET_TYPES, METRIC_OPTIONS, GROUP_BY_OPTIONS, COLOR_THEMES, widgetTypeMeta } from '../../data/widgetCatalog'
import { TIME_RANGES, findNodeInTree } from '../../data/facilitiesHierarchy'
import { Network, Building, Layers, Folder, Cpu, Activity, HelpCircle } from 'lucide-react'
import { useCustomDashboards } from '../../context/CustomDashboardContext'
import { devices as allDevices } from '../../data/dummy'

// Resolve matching icon based on node type
function getNodeIcon(type) {
  switch (type) {
    case 'Campus': return <Network size={12} className="text-primary-500" />
    case 'Site': return <Building size={12} className="text-info-500" />
    case 'Building': return <Building size={12} className="text-info-500" />
    case 'Block': return <Layers size={12} className="text-warning-500" />
    case 'Wing': return <Layers size={12} className="text-warning-500" />
    case 'Floor': return <Layers size={12} className="text-info-400" />
    case 'Department': return <Folder size={12} className="text-success-500" />
    case 'Section': return <Folder size={12} className="text-success-500" />
    case 'Room': return <Folder size={12} className="text-success-500" />
    case 'Device': return <Cpu size={12} className="text-purple-500" />
    case 'Sensor': return <Activity size={12} className="text-rose-500" />
    default: return <HelpCircle size={12} className="text-surface-400" />
  }
}

export default function WidgetSettingsModal({ open, onClose, widget, hierarchy, onSave }) {
  const [form, setForm] = useState(null)
  const { orgKey } = useCustomDashboards()
  const orgDevices = allDevices.filter(d => d.org === orgKey)

  useEffect(() => {
    if (widget) {
      // Resolve nodeId from scopeOverride or legacy fields
      let nodeId = widget.scopeOverride?.nodeId
      if (!nodeId && widget.scopeOverride) {
        if (widget.scopeOverride.departmentId) nodeId = widget.scopeOverride.departmentId
        else if (widget.scopeOverride.floorId) nodeId = widget.scopeOverride.floorId
        else if (widget.scopeOverride.buildingId) nodeId = widget.scopeOverride.buildingId
      }

      setForm({
        type: widget.type || 'line',
        title: widget.title,
        metric: widget.metric,
        content: widget.content ?? '',
        thresholds: widget.thresholds || [],
        metrics: widget.metrics || null,
        groupBy: widget.groupBy || 'none',
        color: widget.color,
        timeRange: widget.timeRange || 'inherit',
        targetDevice: widget.targetDevice || '',
        overrideScope: !!widget.scopeOverride,
        nodeId: nodeId || ''
      })
    }
  }, [widget])

  if (!open || !form) return null

  const supportsGroupBy = ['bar', 'pie', 'table'].includes(form.type)

  // Resolve path from root to active node for cascading select
  const match = form.nodeId ? findNodeInTree(hierarchy.tree, form.nodeId) : null
  const selectedPath = match ? match.path : []

  // List of dropdown levels to render
  const dropdownLevels = []
  
  // Level 0: Children of root organization
  dropdownLevels.push({
    levelName: hierarchy.tree[0]?.type || 'Campus',
    options: hierarchy.tree || [],
    selectedValue: selectedPath[0]?.id || ''
  })

  // Subsequent levels based on current selection path
  for (let i = 0; i < selectedPath.length; i++) {
    const currentNode = selectedPath[i]
    if (currentNode.children && currentNode.children.length > 0) {
      dropdownLevels.push({
        levelName: currentNode.children[0].type,
        options: currentNode.children,
        selectedValue: selectedPath[i + 1]?.id || ''
      })
    }
  }

  function handleSelectChange(depth, selectedId) {
    if (!selectedId) {
      if (depth === 0) {
        setForm(f => ({ ...f, nodeId: '' }))
      } else {
        const parentNode = selectedPath[depth - 1]
        setForm(f => ({ ...f, nodeId: parentNode.id }))
      }
    } else {
      setForm(f => ({ ...f, nodeId: selectedId }))
    }
  }

  function handleSave() {
    let scopeOverride = null
    if (form.overrideScope && form.nodeId) {
      const found = findNodeInTree(hierarchy.tree, form.nodeId)
      if (found) {
        const n = found.node
        const p = found.path
        scopeOverride = {
          level: n.type.toLowerCase(),
          nodeId: n.id,
          // legacy fields
          buildingId: p.find(node => node.type === 'Building')?.id || null,
          floorId: p.find(node => node.type === 'Floor')?.id || null,
          departmentId: p.find(node => node.type === 'Department')?.id || null
        }
      }
    } else if (form.overrideScope) {
      scopeOverride = { level: 'organization', nodeId: null }
    }

    onSave({
      type: form.type,
      title: form.title,
      metric: form.metric,
      content: form.content ?? '',
      thresholds: form.thresholds || [],
      metrics: form.type === 'multiseries' ? (form.metrics || []) : undefined,
      groupBy: supportsGroupBy ? form.groupBy : 'none',
      color: form.color,
      timeRange: form.timeRange,
      targetDevice: form.targetDevice || null, // Save targetDevice association
      scopeOverride,
    })
    onClose()
  }

  const activeColorTheme = COLOR_THEMES.find(c => c.value === form.color)?.hex || '#F5A623'

  return (
    <Modal open={open} onClose={onClose} title="Widget Settings" size="lg" footer={
      <>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={handleSave}>Save Changes</button>
      </>
    }>
      <div className="space-y-5">
        {/* Visualization Type Selector */}
        <div>
          <label className="label">Visualization Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WIDGET_TYPES.map(w => {
              const Icon = w.icon
              const active = form.type === w.type
              return (
                <button
                  key={w.type}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: w.type }))}
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
          <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>

        {form.type === 'text' && (
          <div>
            <label className="label">Panel Content (Markdown supported)</label>
            <textarea
              className="input font-mono text-xs leading-relaxed"
              rows={6}
              placeholder={"# Section Title\n\nWrite **bold**, *italic*, or `code`.\n\n- Bullet one\n- Bullet two\n\n[Link text](https://example.com)"}
              value={form.content ?? ''}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />
            <p className="text-[10px] text-surface-400 mt-1">
              Supports: # headings, **bold**, *italic*, `code`, - lists, [links](url)
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.type === 'multiseries' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Metrics (2–4 series)</label>
                {(form.metrics || []).length < 4 && (
                  <button type="button"
                    className="text-[10px] font-bold text-primary-600 hover:text-primary-800"
                    onClick={() => setForm(f => ({
                      ...f,
                      metrics: [...(f.metrics || [{ key: form.metric || 'energyConsumption', label: '', color: activeColorTheme }]), { key: 'activePower', label: '', color: '#16A34A' }]
                    }))}
                  >+ Add series</button>
                )}
              </div>
              <div className="space-y-2">
                {(form.metrics || [{ key: form.metric || 'energyConsumption', label: '', color: activeColorTheme }]).map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={s.color}
                      className="w-8 h-8 rounded border border-surface-200 cursor-pointer p-0.5"
                      onChange={e => setForm(f => {
                        const next = [...(f.metrics || [{ key: f.metric || 'energyConsumption', label: '', color: activeColorTheme }])]
                        next[i] = { ...next[i], color: e.target.value }
                        return { ...f, metrics: next }
                      })}
                    />
                    <select
                      className="select flex-1 text-xs"
                      value={s.key}
                      onChange={e => setForm(f => {
                        const next = [...(f.metrics || [{ key: f.metric || 'energyConsumption', label: '', color: activeColorTheme }])]
                        next[i] = { ...next[i], key: e.target.value }
                        return { ...f, metrics: next }
                      })}
                    >
                      {METRIC_OPTIONS.filter(m => m.value !== '_none').map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="input w-28 text-xs"
                      placeholder="Label (opt.)"
                      value={s.label || ''}
                      onChange={e => setForm(f => {
                        const next = [...(f.metrics || [{ key: f.metric || 'energyConsumption', label: '', color: activeColorTheme }])]
                        next[i] = { ...next[i], label: e.target.value }
                        return { ...f, metrics: next }
                      })}
                    />
                    {i > 0 && (
                      <button type="button"
                        className="text-danger-500 hover:text-danger-700 text-xs font-bold"
                        onClick={() => setForm(f => ({
                          ...f,
                          metrics: (f.metrics || []).filter((_, idx) => idx !== i)
                        }))}
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="label">Data / Metric</label>
              <select className="select" value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}>
                {METRIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}
          
          <div>
            <label className="label">Color Theme</label>
            <div className="flex items-center gap-2">
              {COLOR_THEMES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  className={`w-7 h-7 rounded-full border-2 ${form.color === c.value ? 'border-surface-900' : 'border-transparent'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <Cpu size={12} className="text-primary-600" />
              <span>Target Device / Asset</span>
              <span className="text-[10px] text-surface-400 font-normal">(Optional)</span>
            </label>
            <select className="select" value={form.targetDevice} onChange={e => setForm(f => ({ ...f, targetDevice: e.target.value }))}>
              <option value="">Inherit Dashboard Device Association</option>
              {orgDevices.map(d => (
                <option key={d.id} value={d.name}>{d.name} ({d.gateway})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Time Range</label>
            <select className="select" value={form.timeRange} onChange={e => setForm(f => ({ ...f, timeRange: e.target.value }))}>
              <option value="inherit">Inherit from dashboard filter</option>
              {Object.entries(TIME_RANGES).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {supportsGroupBy && (
          <div>
            <label className="label">Grouping (Enterprise Drill-down)</label>
            <select className="select" value={form.groupBy} onChange={e => setForm(f => ({ ...f, groupBy: e.target.value }))}>
              {GROUP_BY_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        )}

        {['stat', 'gauge'].includes(form.type) && (
          <div className="pt-3 border-t border-surface-100">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Thresholds</label>
              <button
                type="button"
                className="text-[10px] font-bold text-primary-600 hover:text-primary-800"
                onClick={() => setForm(f => ({
                  ...f,
                  thresholds: [
                    ...(f.thresholds || []),
                    { value: (f.thresholds?.length ? f.thresholds[f.thresholds.length-1].value + 20 : 80), color: '#F5A623' }
                  ].sort((a, b) => a.value - b.value)
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
                    onChange={e => setForm(f => {
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
                    onChange={e => setForm(f => {
                      const next = [...f.thresholds]
                      next[i] = { ...next[i], value: Number(e.target.value) }
                      return { ...f, thresholds: next }
                    })}
                  />
                  <button
                    type="button"
                    className="text-danger-500 hover:text-danger-700 text-xs font-bold"
                    onClick={() => setForm(f => ({
                      ...f,
                      thresholds: f.thresholds.filter((_, idx) => idx !== i)
                    }))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {(!form.thresholds || form.thresholds.length === 0) && (
                <p className="text-[10px] text-surface-400">No thresholds — widget uses the color swatch above.</p>
              )}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-surface-100">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={form.overrideScope}
              onChange={e => setForm(f => ({ ...f, overrideScope: e.target.checked, nodeId: '' }))}
            />
            <span className="text-xs font-bold text-surface-700 uppercase tracking-wide">Pin this widget to a fixed scope</span>
          </label>
          {form.overrideScope && (
            <div className="flex flex-wrap gap-3 p-3 bg-surface-50 dark:bg-surface-850 rounded-lg border border-surface-150 dark:border-surface-750">
              {dropdownLevels.map((lvl, index) => (
                <div key={index} className="flex items-center gap-1.5 text-surface-400">
                  {getNodeIcon(lvl.levelName)}
                  <select
                    className="select text-xs py-1 px-2 w-auto min-w-[7.5rem] bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 font-bold focus:ring-1 focus:ring-primary-500 rounded cursor-pointer"
                    value={lvl.selectedValue}
                    onChange={e => handleSelectChange(index, e.target.value)}
                  >
                    <option value="">All {lvl.levelName}s</option>
                    {lvl.options.map(opt => (
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
