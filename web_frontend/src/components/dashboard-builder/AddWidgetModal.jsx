import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import { WIDGET_TYPES, METRIC_OPTIONS, GROUP_BY_OPTIONS, COLOR_THEMES, widgetTypeMeta } from '../../data/widgetCatalog'
import { Cpu } from 'lucide-react'
import { fetchDeviceVariables } from '../../utils/sensorReadings'

const SYSTEM_METRICS = METRIC_OPTIONS.filter((m) =>
  ['devicesOnline', 'activeAlarms', '_none', 'cost', 'carbonEmissions'].includes(m.value)
)

export default function AddWidgetModal({ open, onClose, onAdd, devices = [], dashboardDeviceId = null }) {
  const [type, setType] = useState('line')
  const [title, setTitle] = useState('')
  const [metric, setMetric] = useState('energyConsumption')
  const [variableName, setVariableName] = useState('')
  const [groupBy, setGroupBy] = useState('none')
  const [color, setColor] = useState('primary')
  const [targetDeviceId, setTargetDeviceId] = useState('')
  const [deviceVars, setDeviceVars] = useState([])
  const [varsLoading, setVarsLoading] = useState(false)

  const supportsGroupBy = ['bar', 'pie', 'table'].includes(type)
  const effectiveDeviceId = targetDeviceId || dashboardDeviceId || ''

  useEffect(() => {
    if (!open) return
    let cancelled = false
    if (!effectiveDeviceId) {
      setDeviceVars([])
      return undefined
    }
    setVarsLoading(true)
    fetchDeviceVariables(effectiveDeviceId)
      .then((vars) => {
        if (cancelled) return
        setDeviceVars(vars)
        if (vars[0]?.name) {
          setVariableName((prev) => prev || vars[0].name)
          setMetric(vars[0].name)
        }
      })
      .catch(() => { if (!cancelled) setDeviceVars([]) })
      .finally(() => { if (!cancelled) setVarsLoading(false) })
    return () => { cancelled = true }
  }, [open, effectiveDeviceId])

  const metricOptions = useMemo(() => {
    const fromDevice = deviceVars.map((v) => ({
      value: v.name,
      label: `${v.name}${v.unit ? ` (${v.unit})` : ''}${v.slaveName ? ` · ${v.slaveName}` : ''}`,
      unit: v.unit || '',
    }))
    return [...fromDevice, ...SYSTEM_METRICS]
  }, [deviceVars])

  function handleAdd() {
    const meta = widgetTypeMeta(type)
    const device = devices.find((d) => d.id === targetDeviceId)
    const selected = metricOptions.find((m) => m.value === metric)
    const isSystem = SYSTEM_METRICS.some((m) => m.value === metric)
    const resolvedVar = isSystem ? null : (variableName || metric)
    onAdd({
      type,
      title: title.trim() || `${meta.label} — ${selected?.label || metric}`,
      metric: isSystem ? metric : (resolvedVar || 'activePower'),
      variableName: resolvedVar,
      unit: selected?.unit || null,
      groupBy: supportsGroupBy ? groupBy : 'none',
      color,
      targetDeviceId: targetDeviceId || null,
      targetDevice: device?.name || null,
    })
    setTitle('')
    setTargetDeviceId('')
    setVariableName('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Widget"
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleAdd}>Add to Dashboard</button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label">Visualization Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WIDGET_TYPES.map((w) => {
              const Icon = w.icon
              const active = type === w.type
              return (
                <button
                  key={w.type}
                  type="button"
                  onClick={() => setType(w.type)}
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
          <label className="label">Widget Title (optional)</label>
          <input className="input" placeholder="e.g. VoltageA live" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <Cpu size={12} className="text-primary-600" />
              Target Device
            </label>
            <select className="select" value={targetDeviceId} onChange={(e) => setTargetDeviceId(e.target.value)}>
              <option value="">Inherit Dashboard Device</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Device Variable / Metric</label>
            <select
              className="select"
              value={metric}
              onChange={(e) => {
                const v = e.target.value
                setMetric(v)
                if (!SYSTEM_METRICS.some((m) => m.value === v)) setVariableName(v)
                else setVariableName('')
              }}
            >
              {!effectiveDeviceId && (
                <option value="energyConsumption">Select a device to load its variables</option>
              )}
              {varsLoading && <option value="">Loading variables…</option>}
              {metricOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-surface-400 mt-1">
              Options come from the device template variables (live MQTT registers).
            </p>
          </div>
        </div>

        <div>
          <label className="label">Color Theme</label>
          <div className="flex items-center gap-2">
            {COLOR_THEMES.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setColor(c.value)}
                className={`w-7 h-7 rounded-full border-2 ${color === c.value ? 'border-surface-900' : 'border-transparent'}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>

        {supportsGroupBy && (
          <div>
            <label className="label">Grouping</label>
            <select className="select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              {GROUP_BY_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  )
}
