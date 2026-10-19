import { useState } from 'react'
import {
  ALLOWED_EXECUTIVE_METRICS,
  validateThresholdRule,
} from '../../utils/thresholdUtils'
import { TextInput, ToggleInput, SelectInput } from '../ui/FormFields'
import { AlertTriangle, CheckCircle, ShieldAlert, Cpu, Plus, Trash2, Info } from 'lucide-react'

export default function ExecutiveLimitsConfig({
  executiveLimits = {},
  onChange,
  devices = [],
  readOnly = false,
}) {
  const [selectedSlaveId, setSelectedSlaveId] = useState('')
  const [slaveMetricType, setSlaveMetricType] = useState('power')

  const thresholds = executiveLimits?.thresholds || {}
  const slaveThresholds = executiveLimits?.slaveThresholds || {}

  // Flatten all slaves across all devices for slave threshold selection
  const allSlaves = devices.flatMap((d) => {
    const slvs = d.slaves || d.configSlaves || d._raw?.configSlaves || []
    return slvs.map((s) => ({
      ...s,
      deviceId: d.id,
      deviceName: d.name,
    }))
  })

  const updateMetric = (metricKey, patch) => {
    if (readOnly) return
    const current = thresholds[metricKey] || {
      enabled: false,
      direction: metricKey === 'powerFactor' ? 'below' : 'above',
      warningValue: '',
      criticalValue: '',
      unit: ALLOWED_EXECUTIVE_METRICS.find((m) => m.key === metricKey)?.unit || 'kW',
    }
    const updated = {
      ...executiveLimits,
      thresholds: {
        ...thresholds,
        [metricKey]: {
          ...current,
          ...patch,
        },
      },
    }
    onChange?.(updated)
  }

  const addSlaveThreshold = () => {
    if (!selectedSlaveId || readOnly) return
    const slv = allSlaves.find((s) => s.id === selectedSlaveId)
    if (!slv) return

    const updated = {
      ...executiveLimits,
      slaveThresholds: {
        ...slaveThresholds,
        [selectedSlaveId]: {
          enabled: true,
          direction: 'above',
          metricKey: slaveMetricType,
          warningValue: '',
          criticalValue: '',
          unit: slaveMetricType === 'power' ? 'kW' : 'A',
          slaveName: slv.name,
          deviceName: slv.deviceName,
        },
      },
    }
    onChange?.(updated)
    setSelectedSlaveId('')
  }

  const updateSlaveThreshold = (slaveId, patch) => {
    if (readOnly) return
    const current = slaveThresholds[slaveId]
    if (!current) return
    const updated = {
      ...executiveLimits,
      slaveThresholds: {
        ...slaveThresholds,
        [slaveId]: {
          ...current,
          ...patch,
        },
      },
    }
    onChange?.(updated)
  }

  const removeSlaveThreshold = (slaveId) => {
    if (readOnly) return
    const next = { ...slaveThresholds }
    delete next[slaveId]
    onChange?.({
      ...executiveLimits,
      slaveThresholds: next,
    })
  }

  // Available slaves not yet configured
  const unconfiguredSlaves = allSlaves.filter((s) => !slaveThresholds[s.id])

  return (
    <div className="space-y-8">
      {/* Visual Status Legend & Safety Rules */}
      <div className="rounded-xl p-4 bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 space-y-3">
        <div className="flex items-center gap-2">
          <Info size={18} className="text-primary-600 flex-shrink-0" />
          <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100">
            Threshold Evaluation & Color Coding Standard
          </h4>
        </div>
        <p className="text-xs text-surface-600 dark:text-surface-400">
          All thresholds are <strong>disabled by default</strong> until explicitly enabled and configured by an authorized operator.
          Unconfigured or offline metrics remain in the standard white neutral state to prevent false alarm noise.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center gap-2.5 shadow-xs">
            <CheckCircle size={16} className="text-surface-400" />
            <div>
              <p className="text-xs font-bold text-surface-800 dark:text-surface-200">Normal State</p>
              <p className="text-[10px] text-surface-400 font-medium">Crisp White background</p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Warning State</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Soft Amber / Yellow background</p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/80 flex items-center gap-2.5">
            <ShieldAlert size={16} className="text-red-600 dark:text-red-400" />
            <div>
              <p className="text-xs font-bold text-red-900 dark:text-red-200">Critical State</p>
              <p className="text-[10px] text-red-700 dark:text-red-300 font-medium">Red background for action</p>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Executive Dashboard Metrics */}
      <div>
        <div className="mb-4">
          <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">
            Executive KPI Thresholds
          </h3>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            Configure upper/lower alarm limits for main plant totals and phase variables.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALLOWED_EXECUTIVE_METRICS.map((meta) => {
            const conf = thresholds[meta.key] || {
              enabled: false,
              direction: meta.defaultDirection,
              warningValue: '',
              criticalValue: '',
              unit: meta.unit,
            }

            const error = validateThresholdRule(meta.key, conf)

            return (
              <div
                key={meta.key}
                className={`p-4 rounded-xl border transition-all ${
                  conf.enabled
                    ? 'bg-white dark:bg-surface-900 border-primary-300 dark:border-primary-800 shadow-xs'
                    : 'bg-surface-50/50 dark:bg-surface-900/30 border-surface-200 dark:border-surface-800 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-surface-100 dark:border-surface-800">
                  <div>
                    <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                      {meta.label}
                      {meta.unit && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 font-mono">
                          {meta.unit}
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      {meta.defaultDirection === 'below'
                        ? 'Alarms when value drops below threshold'
                        : 'Alarms when value exceeds threshold'}
                    </p>
                  </div>
                  <ToggleInput
                    label=""
                    checked={!!conf.enabled}
                    onChange={(val) => updateMetric(meta.key, { enabled: val })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="label text-[11px] text-amber-700 dark:text-amber-400 font-bold mb-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Warning {meta.defaultDirection === 'below' ? 'Min' : 'Max'}
                    </label>
                    <TextInput
                      type="number"
                      step={meta.key === 'powerFactor' ? '0.01' : '0.1'}
                      min="0"
                      max={meta.max}
                      placeholder={meta.key === 'powerFactor' ? 'e.g. 0.90' : 'e.g. 500'}
                      disabled={!conf.enabled || readOnly}
                      value={conf.warningValue ?? ''}
                      onChange={(e) => updateMetric(meta.key, { warningValue: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label text-[11px] text-red-700 dark:text-red-400 font-bold mb-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Critical {meta.defaultDirection === 'below' ? 'Min' : 'Max'}
                    </label>
                    <TextInput
                      type="number"
                      step={meta.key === 'powerFactor' ? '0.01' : '0.1'}
                      min="0"
                      max={meta.max}
                      placeholder={meta.key === 'powerFactor' ? 'e.g. 0.80' : 'e.g. 750'}
                      disabled={!conf.enabled || readOnly}
                      value={conf.criticalValue ?? ''}
                      onChange={(e) => updateMetric(meta.key, { criticalValue: e.target.value })}
                    />
                  </div>
                </div>

                {error && conf.enabled && (
                  <p className="text-[11px] text-danger-600 dark:text-danger-400 font-semibold mt-2 flex items-center gap-1">
                    <span>⚠</span> {error}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Slave-Level Limits Configuration */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <Cpu size={18} className="text-primary-600" />
              Equipment & Slave Specific Thresholds
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Apply dedicated warning and critical power/current limits to specific machines or feeders.
            </p>
          </div>
        </div>

        {/* Add slave threshold picker */}
        {!readOnly && (
          <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900/40 border border-surface-200 dark:border-surface-800 mb-4">
            <h4 className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-2">
              Add Equipment Rule
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <SelectInput
                  label="Select Equipment / Slave"
                  value={selectedSlaveId}
                  onChange={(e) => setSelectedSlaveId(e.target.value)}
                  options={[
                    { value: '', label: 'Choose a slave/meter...' },
                    ...unconfiguredSlaves.map((s) => ({
                      value: s.id,
                      label: `${s.deviceName} → ${s.name}${s.isDefault ? ' (Default)' : ''}`,
                    })),
                  ]}
                />
              </div>
              <div className="sm:col-span-4">
                <SelectInput
                  label="Measurement Type"
                  value={slaveMetricType}
                  onChange={(e) => setSlaveMetricType(e.target.value)}
                  options={[
                    { value: 'power', label: 'Active Power (kW)' },
                    { value: 'current', label: 'Phase Current (A)' },
                  ]}
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={!selectedSlaveId}
                  onClick={addSlaveThreshold}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List of configured slave thresholds */}
        {Object.keys(slaveThresholds).length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-surface-200 dark:border-surface-800 text-xs text-surface-400">
            No equipment-specific thresholds configured. All individual slave tiles operate in standard normal white.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(slaveThresholds).map(([slaveId, conf]) => {
              const slv = allSlaves.find((s) => s.id === slaveId)
              const slaveTitle = conf.slaveName || slv?.name || `Slave ${slaveId.slice(0, 8)}`
              const deviceTitle = conf.deviceName || slv?.deviceName || 'Device'
              const error = validateThresholdRule(`slave-${slaveId}`, conf)

              return (
                <div
                  key={slaveId}
                  className="p-4 rounded-xl border bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 shadow-xs"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-surface-100 dark:border-surface-800">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-surface-900 dark:text-surface-100 truncate">
                          {slaveTitle}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 font-mono">
                          {conf.unit || (conf.metricKey === 'current' ? 'A' : 'kW')}
                        </span>
                      </div>
                      <p className="text-[10px] text-surface-400 truncate">
                        {deviceTitle} · {conf.metricKey === 'current' ? 'Current Alarm' : 'Power Alarm'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <ToggleInput
                        label=""
                        checked={!!conf.enabled}
                        onChange={(val) => updateSlaveThreshold(slaveId, { enabled: val })}
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeSlaveThreshold(slaveId)}
                          className="text-surface-400 hover:text-danger-600 p-1 transition-colors"
                          title="Remove Rule"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="label text-[11px] text-amber-700 dark:text-amber-400 font-bold mb-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Warning Max
                      </label>
                      <TextInput
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="e.g. 100"
                        disabled={!conf.enabled || readOnly}
                        value={conf.warningValue ?? ''}
                        onChange={(e) => updateSlaveThreshold(slaveId, { warningValue: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-[11px] text-red-700 dark:text-red-400 font-bold mb-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Critical Max
                      </label>
                      <TextInput
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="e.g. 150"
                        disabled={!conf.enabled || readOnly}
                        value={conf.criticalValue ?? ''}
                        onChange={(e) => updateSlaveThreshold(slaveId, { criticalValue: e.target.value })}
                      />
                    </div>
                  </div>

                  {error && conf.enabled && (
                    <p className="text-[11px] text-danger-600 dark:text-danger-400 font-semibold mt-2 flex items-center gap-1">
                      <span>⚠</span> {error}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
