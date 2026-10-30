import { useState, useMemo } from 'react'
import {
  ALLOWED_EXECUTIVE_METRICS,
  validateThresholdRule,
} from '../../utils/thresholdUtils'
import { TextInput, ToggleInput, SelectInput } from '../ui/FormFields'
import {
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Cpu,
  Plus,
  Trash2,
  Info,
  Zap,
  Check,
  Search,
  SlidersHorizontal,
  Layers,
  Filter,
  RotateCcw,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Settings2,
} from 'lucide-react'

export default function ExecutiveLimitsConfig({
  executiveLimits = {},
  onChange,
  devices = [],
  readOnly = false,
}) {
  // Top-level thresholds & slave configurations
  const thresholds = executiveLimits?.thresholds || {}
  const slaveThresholds = executiveLimits?.slaveThresholds || {}
  const slaveDefault = executiveLimits?.slaveDefault || {
    enabled: false,
    warningValue: '70',
    criticalValue: '100',
    unit: 'kW',
  }

  // Filter & Search states
  const [activeDeviceTab, setActiveDeviceTab] = useState('all') // 'all' | deviceId
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'custom' | 'default' | 'active'
  const [selectedSlaveIds, setSelectedSlaveIds] = useState([])

  // Batch setup tool states (Optional)
  const [showBatchTool, setShowBatchTool] = useState(false)
  const [batchWarning, setBatchWarning] = useState('70')
  const [batchCritical, setBatchCritical] = useState('100')
  const [batchMetricType, setBatchMetricType] = useState('power')
  const [batchAppliedMsg, setBatchAppliedMsg] = useState('')

  // Single slave quick-add
  const [quickAddSlaveId, setQuickAddSlaveId] = useState('')
  const [quickAddMetric, setQuickAddMetric] = useState('power')

  // Flatten all slaves across all devices with device metadata
  const allSlaves = useMemo(() => {
    return devices.flatMap((d) => {
      const slvs = d.slaves || d.configSlaves || d._raw?.configSlaves || []
      return slvs.map((s) => ({
        ...s,
        deviceId: d.id,
        deviceName: d.name || 'Device',
      }))
    })
  }, [devices])

  // Distinct devices list for tabs
  const deviceList = useMemo(() => {
    return devices.map((d) => {
      const count = (d.slaves || d.configSlaves || d._raw?.configSlaves || []).length
      return { id: d.id, name: d.name || 'Device', count }
    })
  }, [devices])

  // Update Plant-Level KPI Metric
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

  // Update Global Default for Slaves
  const updateSlaveDefault = (patch) => {
    if (readOnly) return
    const updated = {
      ...executiveLimits,
      slaveDefault: {
        ...slaveDefault,
        ...patch,
      },
    }
    onChange?.(updated)
  }

  // Update a Single Slave Threshold (Custom Limit)
  const updateSlaveThreshold = (slaveId, patch) => {
    if (readOnly) return
    const slv = allSlaves.find((s) => s.id === slaveId)
    const current = slaveThresholds[slaveId] || {
      enabled: true,
      direction: 'above',
      metricKey: 'power',
      warningValue: slaveDefault.warningValue || '70',
      criticalValue: slaveDefault.criticalValue || '100',
      unit: 'kW',
      slaveName: slv?.name || '',
      deviceName: slv?.deviceName || '',
    }

    const updated = {
      ...executiveLimits,
      slaveThresholds: {
        ...slaveThresholds,
        [slaveId]: {
          ...current,
          ...patch,
          slaveName: slv?.name || current.slaveName,
          deviceName: slv?.deviceName || current.deviceName,
        },
      },
    }
    onChange?.(updated)
  }

  // Remove Custom Threshold for a Slave (reverts to Default)
  const removeSlaveThreshold = (slaveId) => {
    if (readOnly) return
    const next = { ...slaveThresholds }
    delete next[slaveId]
    onChange?.({
      ...executiveLimits,
      slaveThresholds: next,
    })
  }

  // Quick Add Slave Custom Limit
  const handleQuickAdd = () => {
    if (!quickAddSlaveId || readOnly) return
    const slv = allSlaves.find((s) => s.id === quickAddSlaveId)
    if (!slv) return

    updateSlaveThreshold(quickAddSlaveId, {
      enabled: true,
      direction: 'above',
      metricKey: quickAddMetric,
      warningValue: slaveDefault.warningValue || '70',
      criticalValue: slaveDefault.criticalValue || '100',
      unit: quickAddMetric === 'power' ? 'kW' : 'A',
    })
    setQuickAddSlaveId('')
  }

  // Multi-Selection Handlers
  const toggleSelectSlave = (id) => {
    setSelectedSlaveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectAllInCurrentView = (slavesList) => {
    const ids = slavesList.map((s) => s.id)
    const allSelected = ids.every((id) => selectedSlaveIds.includes(id))
    if (allSelected) {
      setSelectedSlaveIds((prev) => prev.filter((id) => !ids.includes(id)))
    } else {
      setSelectedSlaveIds((prev) => Array.from(new Set([...prev, ...ids])))
    }
  }

  // Apply Batch Limits to Selected Slaves Only (Optional)
  const handleApplyToSelected = () => {
    if (readOnly || selectedSlaveIds.length === 0) return
    const w = String(batchWarning || '70').trim()
    const c = String(batchCritical || '100').trim()
    const next = { ...slaveThresholds }

    for (const slaveId of selectedSlaveIds) {
      const slv = allSlaves.find((s) => s.id === slaveId)
      next[slaveId] = {
        enabled: true,
        direction: 'above',
        metricKey: batchMetricType,
        warningValue: w,
        criticalValue: c,
        unit: batchMetricType === 'power' ? 'kW' : 'A',
        slaveName: slv?.name || '',
        deviceName: slv?.deviceName || '',
      }
    }

    onChange?.({
      ...executiveLimits,
      slaveThresholds: next,
    })

    setBatchAppliedMsg(`Successfully applied custom limits to ${selectedSlaveIds.length} selected slaves (Yellow: ${w} ${batchMetricType === 'power' ? 'kW' : 'A'}, Red: ${c} ${batchMetricType === 'power' ? 'kW' : 'A'}).`)
    setTimeout(() => setBatchAppliedMsg(''), 5000)
  }

  // Optional: Apply Batch to ALL Slaves across the plant
  const handleApplyToAllSlaves = () => {
    if (readOnly) return
    const w = String(batchWarning || '70').trim()
    const c = String(batchCritical || '100').trim()
    const next = { ...slaveThresholds }

    for (const slv of allSlaves) {
      next[slv.id] = {
        enabled: true,
        direction: 'above',
        metricKey: batchMetricType,
        warningValue: w,
        criticalValue: c,
        unit: batchMetricType === 'power' ? 'kW' : 'A',
        slaveName: slv.name,
        deviceName: slv.deviceName,
      }
    }

    onChange?.({
      ...executiveLimits,
      slaveDefault: {
        enabled: true,
        warningValue: w,
        criticalValue: c,
        unit: batchMetricType === 'power' ? 'kW' : 'A',
      },
      slaveThresholds: next,
    })

    setBatchAppliedMsg(`Configured all ${allSlaves.length} connected slaves! Remember to click "Save Configuration" at the top.`)
    setTimeout(() => setBatchAppliedMsg(''), 5000)
  }

  // Filtered slaves according to active tab, search query, and filter mode
  const filteredSlaves = useMemo(() => {
    return allSlaves.filter((slv) => {
      // 1. Device filter
      if (activeDeviceTab !== 'all' && slv.deviceId !== activeDeviceTab) {
        return false
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = (slv.name || '').toLowerCase().includes(q)
        const matchesDevice = (slv.deviceName || '').toLowerCase().includes(q)
        const matchesSlaveId = String(slv.slaveId || '').toLowerCase().includes(q)
        if (!matchesName && !matchesDevice && !matchesSlaveId) return false
      }

      // 3. Status filter mode
      const hasCustom = !!slaveThresholds[slv.id]
      const customConf = slaveThresholds[slv.id]
      const isCustomEnabled = hasCustom && customConf?.enabled !== false

      if (filterMode === 'custom') return hasCustom
      if (filterMode === 'default') return !hasCustom
      if (filterMode === 'active') {
        return isCustomEnabled || (!hasCustom && slaveDefault.enabled)
      }

      return true
    })
  }, [allSlaves, activeDeviceTab, searchQuery, filterMode, slaveThresholds, slaveDefault])

  // Summary statistics
  const customSlavesCount = Object.keys(slaveThresholds).length
  const defaultSlavesCount = Math.max(0, allSlaves.length - customSlavesCount)
  const activeRulesCount = allSlaves.filter((slv) => {
    const custom = slaveThresholds[slv.id]
    if (custom) return custom.enabled !== false
    return slaveDefault.enabled
  }).length

  const unconfiguredForQuickAdd = allSlaves.filter((s) => !slaveThresholds[s.id])

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
          <div className="p-2.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-950 shrink-0" />
            <div>
              <p className="text-xs font-bold text-surface-900 dark:text-surface-100">Normal / Safe</p>
              <p className="text-[10px] text-surface-500">Value below warning limit or unmonitored</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shrink-0 shadow-xs" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-100">Warning State (Yellow)</p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400">Value &ge; Warning Threshold</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 shrink-0 shadow-xs" />
            <div>
              <p className="text-xs font-bold text-red-900 dark:text-red-100">Critical Alarm (Red)</p>
              <p className="text-[10px] text-red-700 dark:text-red-400">Value &ge; Critical Threshold</p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Overall Plant & Feeder Level Thresholds */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <ShieldAlert size={18} className="text-primary-600" />
              Plant-Wide & Feeder KPI Limits
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Configure global warning (Yellow) and critical (Red) alert thresholds for main feeders and high-level KPIs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALLOWED_EXECUTIVE_METRICS.map((metric) => {
            const conf = thresholds[metric.key] || {
              enabled: false,
              direction: metric.defaultDirection,
              warningValue: '',
              criticalValue: '',
              unit: metric.unit,
            }
            const isLowAlarm = metric.defaultDirection === 'below' || metric.key === 'powerFactor'
            const error = validateThresholdRule(metric.key, conf)

            return (
              <div
                key={metric.key}
                className="p-4 rounded-xl border bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 shadow-xs transition-shadow"
              >
                <div className="flex items-center justify-between pb-3 border-b border-surface-100 dark:border-surface-800">
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-bold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                      {metric.label}
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 font-mono">
                        {metric.unit || 'ratio'}
                      </span>
                    </span>
                    <p className="text-[10px] text-surface-400 mt-0.5">
                      {isLowAlarm ? 'Triggers alarm when metric drops below limits' : 'Triggers alarm when metric exceeds limits'}
                    </p>
                  </div>

                  <ToggleInput
                    label=""
                    checked={!!conf.enabled}
                    onChange={(val) => updateMetric(metric.key, { enabled: val })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="label text-[11px] text-amber-700 dark:text-amber-400 font-bold mb-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      {isLowAlarm ? 'Warning Min' : 'Warning Max'}
                    </label>
                    <TextInput
                      type="number"
                      step={metric.key === 'powerFactor' ? '0.01' : '1'}
                      min={metric.min}
                      max={metric.max}
                      placeholder={metric.key === 'powerFactor' ? 'e.g. 0.90' : 'e.g. 800'}
                      disabled={!conf.enabled || readOnly}
                      value={conf.warningValue ?? ''}
                      onChange={(e) => updateMetric(metric.key, { warningValue: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label text-[11px] text-red-700 dark:text-red-400 font-bold mb-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      {isLowAlarm ? 'Critical Min' : 'Critical Max'}
                    </label>
                    <TextInput
                      type="number"
                      step={metric.key === 'powerFactor' ? '0.01' : '1'}
                      min={metric.min}
                      max={metric.max}
                      placeholder={metric.key === 'powerFactor' ? 'e.g. 0.85' : 'e.g. 1000'}
                      disabled={!conf.enabled || readOnly}
                      value={conf.criticalValue ?? ''}
                      onChange={(e) => updateMetric(metric.key, { criticalValue: e.target.value })}
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

      {/* 2. Equipment & Slave Specific Thresholds (Clean, Organized & Fully Flexible) */}
      <div className="space-y-4 pt-4 border-t border-surface-200 dark:border-surface-800">
        {/* Header with Title & Quick Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <Cpu size={18} className="text-primary-600" />
              Equipment & Slave Specific Thresholds
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Configure different individual limits for specific slaves, use an optional baseline default, or selectively batch-configure machines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBatchTool(!showBatchTool)}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                showBatchTool
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 border-primary-300 dark:border-primary-700'
                  : 'bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-800 hover:border-surface-300'
              }`}
            >
              <Zap size={14} className={showBatchTool ? 'text-primary-600' : 'text-surface-400'} />
              Batch Actions (Optional)
              <ChevronDown size={14} className={`transform transition-transform ${showBatchTool ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Top Summary Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Total Slaves</span>
            <p className="text-lg font-black text-surface-900 dark:text-surface-100 mt-0.5">{allSlaves.length}</p>
          </div>

          <div className="p-3 rounded-xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200/60 dark:border-primary-800/40">
            <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">Custom Slave Limits</span>
            <p className="text-lg font-black text-primary-700 dark:text-primary-300 mt-0.5">{customSlavesCount}</p>
          </div>

          <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Using Global Default</span>
            <p className="text-lg font-black text-surface-700 dark:text-surface-300 mt-0.5">
              {slaveDefault.enabled ? defaultSlavesCount : '0'}
              <span className="text-[10px] font-normal text-surface-400 ml-1">
                {slaveDefault.enabled ? `(${slaveDefault.warningValue}/${slaveDefault.criticalValue} kW)` : '(Disabled)'}
              </span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Alert Rules</span>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{activeRulesCount}</p>
          </div>
        </div>

        {/* Global Slave Default (Optional Baseline) */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-surface-100 dark:border-surface-800">
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-primary-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-surface-900 dark:text-surface-100">
                  Global Baseline Default for Unconfigured Slaves
                </h4>
                <p className="text-[11px] text-surface-500">
                  When enabled, any slave that doesn&apos;t have a custom limit will use these default values. Slaves with custom limits always take precedence.
                </p>
              </div>
            </div>

            <ToggleInput
              label=""
              checked={!!slaveDefault.enabled}
              onChange={(val) => updateSlaveDefault({ enabled: val })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5">
            <div>
              <label className="label text-[11px] text-amber-700 dark:text-amber-400 font-bold mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Default Warning Threshold (kW)
              </label>
              <TextInput
                type="number"
                step="1"
                min="0"
                disabled={!slaveDefault.enabled || readOnly}
                value={slaveDefault.warningValue ?? '70'}
                onChange={(e) => updateSlaveDefault({ warningValue: e.target.value })}
                placeholder="70"
              />
            </div>

            <div>
              <label className="label text-[11px] text-red-700 dark:text-red-400 font-bold mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Default Critical Threshold (kW)
              </label>
              <TextInput
                type="number"
                step="1"
                min="0"
                disabled={!slaveDefault.enabled || readOnly}
                value={slaveDefault.criticalValue ?? '100'}
                onChange={(e) => updateSlaveDefault({ criticalValue: e.target.value })}
                placeholder="100"
              />
            </div>
          </div>
        </div>

        {/* Optional Batch Operations Drawer */}
        {showBatchTool && !readOnly && (
          <div className="p-4 rounded-xl bg-primary-50/40 dark:bg-primary-950/20 border-2 border-primary-200 dark:border-primary-800/60 shadow-xs space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-primary-600" />
                <h4 className="text-xs font-black text-primary-900 dark:text-primary-100 uppercase tracking-wider">
                  Optional Batch Tool: Apply Limits to Selected Slaves
                </h4>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
                {selectedSlaveIds.length} of {allSlaves.length} slaves selected
              </span>
            </div>

            <p className="text-[11px] text-surface-500 dark:text-surface-400">
              Check specific slave boxes below and apply limits directly to the selected machines, without affecting other customized slaves.
            </p>

            {batchAppliedMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Check size={14} className="text-emerald-600" />
                {batchAppliedMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-3">
                <SelectInput
                  label="Measurement"
                  value={batchMetricType}
                  onChange={(e) => setBatchMetricType(e.target.value)}
                  options={[
                    { value: 'power', label: 'Active Power (kW)' },
                    { value: 'current', label: 'Phase Current (A)' },
                  ]}
                />
              </div>

              <div className="sm:col-span-3">
                <TextInput
                  label={`Warning (${batchMetricType === 'power' ? 'kW' : 'A'})`}
                  type="number"
                  value={batchWarning}
                  onChange={(e) => setBatchWarning(e.target.value)}
                  placeholder="e.g. 70"
                />
              </div>

              <div className="sm:col-span-3">
                <TextInput
                  label={`Critical (${batchMetricType === 'power' ? 'kW' : 'A'})`}
                  type="number"
                  value={batchCritical}
                  onChange={(e) => setBatchCritical(e.target.value)}
                  placeholder="e.g. 100"
                />
              </div>

              <div className="sm:col-span-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={selectedSlaveIds.length === 0}
                  onClick={handleApplyToSelected}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check size={14} /> Apply to Selected ({selectedSlaveIds.length})
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-primary-200/60 dark:border-primary-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSlaveIds(filteredSlaves.map((s) => s.id))}
                  className="text-primary-600 hover:text-primary-700 font-bold underline cursor-pointer"
                >
                  Select All in View ({filteredSlaves.length})
                </button>
                <span className="text-surface-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedSlaveIds([])}
                  className="text-surface-500 hover:text-surface-700 font-medium cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>

              <button
                type="button"
                onClick={handleApplyToAllSlaves}
                className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Apply to ALL {allSlaves.length} Slaves Plant-Wide (Mass Override)
              </button>
            </div>
          </div>
        )}

        {/* Quick Add Specific Slave Rule Picker */}
        {!readOnly && unconfiguredForQuickAdd.length > 0 && (
          <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-900/40 border border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-auto">
              <span className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider block">
                Quick Setup Individual Slave:
              </span>
              <span className="text-[11px] text-surface-400">
                Choose an unconfigured slave to give it a custom limit.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="min-w-[200px] flex-1 sm:flex-initial">
                <SelectInput
                  label=""
                  value={quickAddSlaveId}
                  onChange={(e) => setQuickAddSlaveId(e.target.value)}
                  options={[
                    { value: '', label: 'Select equipment to customize...' },
                    ...unconfiguredForQuickAdd.map((s) => ({
                      value: s.id,
                      label: `${s.deviceName} → ${s.name}${s.isDefault ? ' (Default)' : ''}`,
                    })),
                  ]}
                />
              </div>

              <div className="w-36">
                <SelectInput
                  label=""
                  value={quickAddMetric}
                  onChange={(e) => setQuickAddMetric(e.target.value)}
                  options={[
                    { value: 'power', label: 'Power (kW)' },
                    { value: 'current', label: 'Current (A)' },
                  ]}
                />
              </div>

              <button
                type="button"
                disabled={!quickAddSlaveId}
                onClick={handleQuickAdd}
                className="btn-primary py-2 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} /> Customize
              </button>
            </div>
          </div>
        )}

        {/* Organization Navigation: Device Tabs, Search & Filters */}
        <div className="space-y-3 pt-2">
          {/* Device Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-surface-200 dark:border-surface-800">
            <button
              type="button"
              onClick={() => setActiveDeviceTab('all')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                activeDeviceTab === 'all'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
            >
              All Devices & Slaves ({allSlaves.length})
            </button>

            {deviceList.map((dev) => (
              <button
                key={dev.id}
                type="button"
                onClick={() => setActiveDeviceTab(dev.id)}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeDeviceTab === dev.id
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                }`}
              >
                <Layers size={13} />
                {dev.name} ({dev.count})
              </button>
            ))}
          </div>

          {/* Search Bar & Filter Chips */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Live Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search equipment by name, slave ID, feeder..."
                className="input pl-9 py-1.5 text-xs w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="text-surface-400 font-bold mr-1 flex items-center gap-1">
                <Filter size={12} /> Filter:
              </span>

              {[
                { key: 'all', label: `All (${allSlaves.length})` },
                { key: 'custom', label: `Custom (${customSlavesCount})` },
                { key: 'default', label: `Default (${defaultSlavesCount})` },
                { key: 'active', label: `Active (${activeRulesCount})` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterMode(f.key)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    filterMode === f.key
                      ? 'bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 shadow-2xs'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Organized Slaves List / Cards */}
        {filteredSlaves.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-surface-200 dark:border-surface-800 text-xs text-surface-400 space-y-1">
            <p className="font-bold text-surface-600 dark:text-surface-300">No equipment matching current filter.</p>
            <p>Try clearing your search query or switching device tabs.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Table Header / Selection Bar */}
            <div className="flex items-center justify-between px-2 text-xs text-surface-500 font-medium">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectAllInCurrentView(filteredSlaves)}
                  className="p-1 text-surface-400 hover:text-primary-600 transition-colors"
                  title="Select all in view"
                >
                  {filteredSlaves.every((s) => selectedSlaveIds.includes(s.id)) ? (
                    <CheckSquare size={16} className="text-primary-600" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
                <span>Showing {filteredSlaves.length} connected equipment meters</span>
              </div>

              {selectedSlaveIds.length > 0 && (
                <span className="text-primary-600 dark:text-primary-400 font-bold">
                  {selectedSlaveIds.length} selected for batch actions
                </span>
              )}
            </div>

            {/* Grid of Clean Slave Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredSlaves.map((slv) => {
                const conf = slaveThresholds[slv.id]
                const hasCustom = !!conf
                const isSelected = selectedSlaveIds.includes(slv.id)
                const isEnabled = hasCustom ? conf.enabled !== false : slaveDefault.enabled

                // Values to show
                const currentWarning = hasCustom
                  ? (conf.warningValue ?? '')
                  : (slaveDefault.enabled ? slaveDefault.warningValue : '')
                const currentCritical = hasCustom
                  ? (conf.criticalValue ?? '')
                  : (slaveDefault.enabled ? slaveDefault.criticalValue : '')
                const currentUnit = hasCustom
                  ? (conf.unit || (conf.metricKey === 'current' ? 'A' : 'kW'))
                  : (slaveDefault.unit || 'kW')
                const error = hasCustom && conf.enabled ? validateThresholdRule(`slave-${slv.id}`, conf) : null

                return (
                  <div
                    key={slv.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/20 dark:bg-primary-950/10'
                        : hasCustom
                          ? 'bg-white dark:bg-surface-900 border-primary-200 dark:border-primary-900/60 shadow-xs'
                          : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 shadow-xs'
                    }`}
                  >
                    {/* Card Header: Selection, Title, Badges & Toggles */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-surface-100 dark:border-surface-800">
                      <div className="flex items-start gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleSelectSlave(slv.id)}
                          className="pt-0.5 text-surface-400 hover:text-primary-600 transition-colors shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare size={15} className="text-primary-600" />
                          ) : (
                            <Square size={15} />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-surface-900 dark:text-surface-100 truncate">
                              {slv.name}
                            </span>
                            {slv.slaveId && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">
                                {slv.slaveId}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-surface-400 truncate mt-0.5">
                            {slv.deviceName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status Chip */}
                        {hasCustom ? (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            conf.enabled
                              ? 'bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                              : 'bg-surface-100 dark:bg-surface-800 text-surface-500 border border-surface-200 dark:border-surface-700'
                          }`}>
                            Custom Limit
                          </span>
                        ) : slaveDefault.enabled ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Global Default
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-400">
                            Unmonitored
                          </span>
                        )}

                        <ToggleInput
                          label=""
                          checked={isEnabled}
                          onChange={(val) => {
                            if (hasCustom) {
                              updateSlaveThreshold(slv.id, { enabled: val })
                            } else {
                              updateSlaveThreshold(slv.id, {
                                enabled: val,
                                warningValue: slaveDefault.warningValue || '70',
                                criticalValue: slaveDefault.criticalValue || '100',
                              })
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Card Body: Editable Limits */}
                    <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                      <div>
                        <label className="label text-[10px] text-amber-700 dark:text-amber-400 font-bold mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Warning
                          </span>
                          <span className="font-mono text-[9px] text-surface-400 font-normal">({currentUnit})</span>
                        </label>
                        <TextInput
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="e.g. 70"
                          disabled={!isEnabled || readOnly}
                          value={currentWarning}
                          onChange={(e) => {
                            updateSlaveThreshold(slv.id, { warningValue: e.target.value, enabled: true })
                          }}
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] text-red-700 dark:text-red-400 font-bold mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Critical
                          </span>
                          <span className="font-mono text-[9px] text-surface-400 font-normal">({currentUnit})</span>
                        </label>
                        <TextInput
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="e.g. 100"
                          disabled={!isEnabled || readOnly}
                          value={currentCritical}
                          onChange={(e) => {
                            updateSlaveThreshold(slv.id, { criticalValue: e.target.value, enabled: true })
                          }}
                        />
                      </div>
                    </div>

                    {/* Card Footer: Measurement Type, Reset & Error alerts */}
                    <div className="mt-2.5 pt-2 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1">
                        <span className="text-surface-400">Unit:</span>
                        <select
                          value={hasCustom ? (conf.metricKey || 'power') : 'power'}
                          disabled={!hasCustom || readOnly}
                          onChange={(e) => {
                            const newKey = e.target.value
                            updateSlaveThreshold(slv.id, {
                              metricKey: newKey,
                              unit: newKey === 'power' ? 'kW' : 'A',
                            })
                          }}
                          className="bg-transparent text-surface-700 dark:text-surface-300 font-bold cursor-pointer disabled:cursor-default"
                        >
                          <option value="power">Active Power (kW)</option>
                          <option value="current">Current (A)</option>
                        </select>
                      </div>

                      {hasCustom && !readOnly && (
                        <button
                          type="button"
                          onClick={() => removeSlaveThreshold(slv.id)}
                          className="text-surface-400 hover:text-danger-600 font-medium cursor-pointer transition-colors flex items-center gap-1"
                          title="Reset to default baseline"
                        >
                          <RotateCcw size={11} /> Reset to Default
                        </button>
                      )}
                    </div>

                    {error && (
                      <p className="text-[10px] text-danger-600 dark:text-danger-400 font-semibold mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {error}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
