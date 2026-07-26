import { useState } from 'react'
import Modal from '../ui/Modal'
import { WIDGET_TYPES, METRIC_OPTIONS, GROUP_BY_OPTIONS, COLOR_THEMES, widgetTypeMeta } from '../../data/widgetCatalog'
import { Database, Cpu } from 'lucide-react'
import { useCustomDashboards } from '../../context/CustomDashboardContext'
import { devices as allDevices } from '../../data/dummy'

// ── Mock database schema ──────────────────────────────────────────────────────
const DB_TABLES = [
  {
    value: 'telemetry_data',
    label: 'telemetry_data',
    description: 'Raw sensor readings (energy, temperature, humidity, CO₂)',
    columns: [
      { value: 'value',       label: 'value — FLOAT',     hint: 'Raw sensor reading' },
      { value: 'metric_type', label: 'metric_type — VARCHAR', hint: 'energy / temp / humidity / co2' },
      { value: 'quality',     label: 'quality — TINYINT', hint: 'Signal quality 0–100' },
      { value: 'unit',        label: 'unit — VARCHAR',    hint: 'kWh, °C, %, lux …' },
    ],
  },
  {
    value: 'device_registry',
    label: 'device_registry',
    description: 'Device inventory — live status & heartbeat',
    columns: [
      { value: 'status',           label: 'status — VARCHAR',    hint: 'online / offline / fault' },
      { value: 'last_seen',        label: 'last_seen — TIMESTAMP', hint: 'Last heartbeat epoch' },
      { value: 'firmware_version', label: 'firmware_version — VARCHAR', hint: 'Semver string' },
    ],
  },
  {
    value: 'alarms_log',
    label: 'alarms_log',
    description: 'Alarm events with severity and resolution timestamps',
    columns: [
      { value: 'severity',     label: 'severity — VARCHAR',   hint: 'critical / warning / info' },
      { value: 'count',        label: 'count — INT',          hint: 'Open alarms per device' },
      { value: 'triggered_at', label: 'triggered_at — TIMESTAMP', hint: 'Alarm onset time' },
      { value: 'resolved_at',  label: 'resolved_at — TIMESTAMP', hint: 'Null if still active' },
    ],
  },
  {
    value: 'energy_meters',
    label: 'energy_meters',
    description: 'Power meter readings — kWh, kW, voltage, current, PF',
    columns: [
      { value: 'kWh',          label: 'kWh — FLOAT',   hint: 'Cumulative energy' },
      { value: 'kW',           label: 'kW — FLOAT',    hint: 'Instantaneous power' },
      { value: 'voltage',      label: 'voltage — FLOAT', hint: 'RMS voltage (V)' },
      { value: 'current',      label: 'current — FLOAT', hint: 'RMS current (A)' },
      { value: 'power_factor', label: 'power_factor — FLOAT', hint: '0.0 – 1.0' },
    ],
  },
  {
    value: 'occupancy_sensors',
    label: 'occupancy_sensors',
    description: 'People-counting sensors per zone',
    columns: [
      { value: 'count',           label: 'count — INT',           hint: 'People currently present' },
      { value: 'capacity',        label: 'capacity — INT',        hint: 'Max rated capacity' },
      { value: 'utilization_pct', label: 'utilization_pct — FLOAT', hint: 'count / capacity × 100' },
    ],
  },
  {
    value: 'hvac_systems',
    label: 'hvac_systems',
    description: 'HVAC unit state — temperature, fan speed, mode',
    columns: [
      { value: 'actual_temp',  label: 'actual_temp — FLOAT',  hint: 'Measured temp (°C)' },
      { value: 'setpoint_temp',label: 'setpoint_temp — FLOAT',hint: 'Target temp (°C)' },
      { value: 'fan_speed',    label: 'fan_speed — INT',      hint: 'Fan RPM' },
      { value: 'mode',         label: 'mode — VARCHAR',       hint: 'cooling / heating / ventilation / off' },
    ],
  },
]

const POLL_INTERVALS = [
  { value: '5s',  label: 'Every 5 seconds' },
  { value: '15s', label: 'Every 15 seconds' },
  { value: '30s', label: 'Every 30 seconds' },
  { value: '1m',  label: 'Every 1 minute' },
  { value: '5m',  label: 'Every 5 minutes' },
  { value: '15m', label: 'Every 15 minutes' },
  { value: '1h',  label: 'Every 1 hour' },
]

const AGGREGATIONS = [
  { value: 'last',  label: 'Last value' },
  { value: 'avg',   label: 'Average' },
  { value: 'sum',   label: 'Sum' },
  { value: 'min',   label: 'Minimum' },
  { value: 'max',   label: 'Maximum' },
  { value: 'count', label: 'Count' },
  { value: 'raw',   label: 'Raw (no aggregation)' },
]

const TIME_WINDOWS = [
  { value: '1h',  label: 'Last 1 hour' },
  { value: '6h',  label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

export default function AddWidgetModal({ open, onClose, onAdd }) {
  const [type, setType]       = useState('line')
  const [title, setTitle]     = useState('')
  const [metric, setMetric]   = useState('energyConsumption')
  const [groupBy, setGroupBy] = useState('none')
  const [color, setColor]     = useState('primary')
  const [targetDevice, setTargetDevice] = useState('')

  // Resolve orgKey from custom dashboards context
  const { orgKey } = useCustomDashboards()
  const orgDevices = allDevices.filter(d => d.org === orgKey)

  // DB mapping state
  const [dbTable,    setDbTable]    = useState(DB_TABLES[0].value)
  const [dbColumn,   setDbColumn]   = useState(DB_TABLES[0].columns[0].value)
  const [pollInterval, setPollInterval] = useState('30s')
  const [aggregation,  setAggregation]  = useState('last')
  const [timeWindow,   setTimeWindow]   = useState('1h')

  const supportsGroupBy = ['bar', 'pie', 'table'].includes(type)

  const selectedTable = DB_TABLES.find(t => t.value === dbTable)
  const selectedColumn = selectedTable?.columns.find(c => c.value === dbColumn)

  function handleTableChange(val) {
    setDbTable(val)
    const table = DB_TABLES.find(t => t.value === val)
    if (table) setDbColumn(table.columns[0].value)
  }

  const mockQuery = `SELECT ${aggregation === 'raw' ? dbColumn : `${aggregation.toUpperCase()}(${dbColumn})`
    } FROM ${dbTable} WHERE time >= NOW() - INTERVAL '${timeWindow}';`

  function handleAdd() {
    const meta = widgetTypeMeta(type)
    onAdd({
      type,
      title: title.trim() || `${meta.label} — ${METRIC_OPTIONS.find(m => m.value === metric)?.label}`,
      metric,
      groupBy: supportsGroupBy ? groupBy : 'none',
      color,
      targetDevice: targetDevice || null, // null = inherit dashboard device association
      dbMapping: {
        table: dbTable,
        column: dbColumn,
        pollInterval,
        aggregation,
        timeWindow,
      },
    })
    setTitle('')
    setTargetDevice('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Widget" size="lg" footer={
      <>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={handleAdd}>Add to Dashboard</button>
      </>
    }>
      <div className="space-y-5">
        <div>
          <label className="label">Visualization Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WIDGET_TYPES.map(w => {
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
          <input className="input" placeholder="e.g. Building A Energy Consumption" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <Cpu size={12} className="text-primary-600" />
              <span>Target Device / Asset</span>
              <span className="text-[10px] text-surface-400 font-normal">(Optional)</span>
            </label>
            <select className="select" value={targetDevice} onChange={e => setTargetDevice(e.target.value)}>
              <option value="">Inherit Dashboard Device Association</option>
              {orgDevices.map(d => (
                <option key={d.id} value={d.name}>{d.name} ({d.gateway})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Data / Metric</label>
            <select className="select" value={metric} onChange={e => setMetric(e.target.value)}>
              {METRIC_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Color Theme</label>
            <div className="flex items-center gap-2">
              {COLOR_THEMES.map(c => (
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
        </div>

        {supportsGroupBy && (
          <div>
            <label className="label">Grouping (Enterprise Drill-down)</label>
            <select className="select" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
              {GROUP_BY_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <p className="text-xs text-surface-400 mt-1.5">
              Choose "Compare Buildings/Floors/Departments" to turn this into a breakdown panel across your facility hierarchy, instead of a single scope value.
            </p>
          </div>
        )}

        {/* ── Database Mapping Panel ── */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-750 bg-surface-50/60 dark:bg-surface-850 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-primary-600" />
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">Database Mapping</span>
            <span className="ml-auto text-[10px] font-medium uppercase tracking-wide bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
              Mock
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Table</label>
              <select className="select text-xs" value={dbTable} onChange={e => handleTableChange(e.target.value)}>
                {DB_TABLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {selectedTable && <p className="text-[11px] text-surface-400 mt-1">{selectedTable.description}</p>}
            </div>
            <div>
              <label className="label">Column</label>
              <select className="select text-xs" value={dbColumn} onChange={e => setDbColumn(e.target.value)}>
                {(selectedTable?.columns ?? []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {selectedColumn && <p className="text-[11px] text-surface-400 mt-1">{selectedColumn.hint}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Aggregation</label>
              <select className="select text-xs" value={aggregation} onChange={e => setAggregation(e.target.value)}>
                {AGGREGATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Time Window</label>
              <select className="select text-xs" value={timeWindow} onChange={e => setTimeWindow(e.target.value)}>
                {TIME_WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Polling Interval</label>
            <div className="flex flex-wrap gap-1.5">
              {POLL_INTERVALS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPollInterval(p.value)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    pollInterval === p.value
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:border-primary-400 hover:text-primary-600'
                  }`}
                >
                  {p.value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Query Preview</label>
            <pre className="text-[11px] font-mono bg-surface-900 text-green-400 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed text-left">
              {mockQuery}
            </pre>
            <p className="text-[11px] text-surface-400 mt-1">
              This SQL statement represents how the backend links this card's visualization directly to database records.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
