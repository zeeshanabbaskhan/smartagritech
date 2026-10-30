import { useState, useMemo } from 'react'
import {
  ALLOWED_EXECUTIVE_METRICS,
  validateThresholdRule,
} from '../../utils/thresholdUtils'
import { TextInput, ToggleInput } from '../ui/FormFields'
import {
  ShieldAlert,
  Cpu,
  Zap,
  Check,
  Search,
  Filter,
  RotateCcw,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Building2,
  Layers,
  ArrowUpDown,
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

  // Top Section Navigation Tab: 'kpis' | 'equipment'
  const [activeSection, setActiveSection] = useState('equipment') // default to equipment since user is configuring slaves

  // Equipment Filtering & Search
  const [activePlantTab, setActivePlantTab] = useState('all') // 'all' | 'Ambition' | 'AFL' | deviceId
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'custom' | 'default' | 'active'

  // Multi-Selection & Optional Batch Tool
  const [selectedSlaveIds, setSelectedSlaveIds] = useState([])
  const [showBatchTool, setShowBatchTool] = useState(false)
  const [batchWarning, setBatchWarning] = useState('70')
  const [batchCritical, setBatchCritical] = useState('100')
  const [batchMetricType, setBatchMetricType] = useState('power')
  const [batchAppliedMsg, setBatchAppliedMsg] = useState('')

  // Flatten and normalize all slaves across all devices
  const allSlaves = useMemo(() => {
    return devices.flatMap((d) => {
      const slvs = d.slaves || d.configSlaves || d._raw?.configSlaves || []
      const devName = d.name || 'Gateway'
      let plantName = d.org && d.org !== '—' ? `${d.org} Plant` : 'Main Plant'
      if (/afl/i.test(devName) || d.id === 'cdd6d1b1-6fd8-48a5-9984-5e220328571d') {
        plantName = 'AFL Plant (B2)'
      } else if (/solar/i.test(devName) || d.id === 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12') {
        plantName = 'Solar Plant (AMB)'
      } else if (/ambition/i.test(devName) || /ambition/i.test(d.org || '')) {
        plantName = 'Ambition Plant (B1)'
      }

      return slvs.map((s) => {
        // Extract live load if available
        let liveKw = null
        if (s.currentKw != null && Number.isFinite(Number(s.currentKw))) {
          liveKw = Number(s.currentKw)
        } else if (s.latestMetrics) {
          const p = s.latestMetrics['Total Power'] ?? s.latestMetrics['ActivePower'] ?? s.latestMetrics['Power']
          if (p != null && Number.isFinite(Number(p))) liveKw = Number(p)
        }

        return {
          ...s,
          deviceId: d.id,
          deviceName: devName,
          plantName,
          liveKw: liveKw != null ? Math.abs(+liveKw.toFixed(1)) : null,
        }
      })
    })
  }, [devices])

  // Plant groupings for tabs
  const plants = useMemo(() => {
    const map = new Map()
    allSlaves.forEach((s) => {
      const count = map.get(s.plantName) || 0
      map.set(s.plantName, count + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [allSlaves])

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

  // Update Global Baseline Default for Slaves
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

  // Update Single Slave Threshold (Custom Limit)
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

  // Remove Custom Threshold (reverts to baseline default or disabled)
  const removeSlaveThreshold = (slaveId) => {
    if (readOnly) return
    const next = { ...slaveThresholds }
    delete next[slaveId]
    onChange?.({
      ...executiveLimits,
      slaveThresholds: next,
    })
  }

  // Multi-select handlers
  const toggleSelectSlave = (id) => {
    setSelectedSlaveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const selectAllInView = (slavesList) => {
    const ids = slavesList.map((s) => s.id)
    const allSelected = ids.every((id) => selectedSlaveIds.includes(id))
    if (allSelected) {
      setSelectedSlaveIds((prev) => prev.filter((id) => !ids.includes(id)))
    } else {
      setSelectedSlaveIds((prev) => Array.from(new Set([...prev, ...ids])))
    }
  }

  // Batch Apply to Selected Slaves Only
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

    setBatchAppliedMsg(`Applied limits to ${selectedSlaveIds.length} selected equipment (Yellow: ${w} kW, Red: ${c} kW). Click "Save Configuration" at the top to save.`)
    setTimeout(() => setBatchAppliedMsg(''), 5000)
  }

  // Filtered Slaves
  const filteredSlaves = useMemo(() => {
    return allSlaves.filter((slv) => {
      // 1. Plant filter
      if (activePlantTab !== 'all' && slv.plantName !== activePlantTab) {
        return false
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = (slv.name || '').toLowerCase().includes(q)
        const matchesPlant = (slv.plantName || '').toLowerCase().includes(q)
        const matchesDevice = (slv.deviceName || '').toLowerCase().includes(q)
        const matchesSlaveId = String(slv.slaveId || '').toLowerCase().includes(q)
        if (!matchesName && !matchesPlant && !matchesDevice && !matchesSlaveId) return false
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
  }, [allSlaves, activePlantTab, searchQuery, filterMode, slaveThresholds, slaveDefault])

  // Summary counts
  const customSlavesCount = Object.keys(slaveThresholds).length
  const defaultSlavesCount = Math.max(0, allSlaves.length - customSlavesCount)
  const activeRulesCount = allSlaves.filter((slv) => {
    const custom = slaveThresholds[slv.id]
    if (custom) return custom.enabled !== false
    return slaveDefault.enabled
  }).length

  return (
    <div className="space-y-6">
      {/* ─── Top Switcher: Plant-Level KPIs vs Equipment Limits ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-2xl bg-surface-100 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-surface-900 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSection('equipment')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSection === 'equipment'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
            }`}
          >
            <Cpu size={15} />
            Individual Equipment & Slaves ({allSlaves.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('kpis')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSection === 'kpis'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
            }`}
          >
            <ShieldAlert size={15} />
            Plant-Wide KPI Limits
          </button>
        </div>

        {/* Status Indicator Legend */}
        <div className="flex items-center gap-3 px-3 text-[11px] text-surface-500">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-white dark:bg-surface-950 border border-surface-300 dark:border-surface-700" />
            Normal
          </span>
          <span className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-2xs" />
            Warning (Yellow)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-2xs" />
            Critical (Red)
          </span>
        </div>
      </div>

      {/* ─── TAB 1: PLANT-WIDE KPI LIMITS ─── */}
      {activeSection === 'kpis' && (
        <div className="space-y-4 animate-fadeIn">
          <div>
            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
              Plant-Wide & Feeder Alert Thresholds
            </h3>
            <p className="text-xs text-surface-500">
              Configure global warning (Yellow) and critical (Red) alert limits for high-level plant power flow and grid intake.
            </p>
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
                  className="p-4 rounded-xl border bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 shadow-xs"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-surface-100 dark:border-surface-800">
                    <div>
                      <span className="text-xs font-bold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                        {metric.label}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 font-mono">
                          {metric.unit || 'ratio'}
                        </span>
                      </span>
                      <p className="text-[10px] text-surface-400 mt-0.5">
                        {isLowAlarm ? 'Alarms when dropping below limits' : 'Alarms when exceeding limits'}
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
                        placeholder={metric.key === 'powerFactor' ? '0.90' : '800'}
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
                        placeholder={metric.key === 'powerFactor' ? '0.85' : '1000'}
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
      )}

      {/* ─── TAB 2: INDIVIDUAL EQUIPMENT & BREAKER LIMITS ─── */}
      {activeSection === 'equipment' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Quick Informational Notice */}
          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Set Custom Alert Limits for Any Machine or Breaker</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Each machine can have its own unique Yellow Warning and Red Critical limits. Change the values directly in the table below, then click &quot;Save Configuration&quot; at the top.
              </p>
            </div>
          </div>

          {/* 1. Global Baseline Default (Optional Baseline Box) */}
          <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ToggleInput
                label=""
                checked={!!slaveDefault.enabled}
                onChange={(val) => updateSlaveDefault({ enabled: val })}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-surface-900 dark:text-surface-100">
                    Optional Baseline Default for Unconfigured Equipment
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    slaveDefault.enabled
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-500'
                  }`}>
                    {slaveDefault.enabled ? 'Enabled' : 'Disabled (Standard White)'}
                  </span>
                </div>
                <p className="text-[11px] text-surface-500 mt-0.5">
                  Machines without a custom limit will use these default values. Any custom limit set below overrides this.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-28">
                <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                  Default Yellow (kW)
                </label>
                <input
                  type="number"
                  value={slaveDefault.warningValue ?? '70'}
                  disabled={!slaveDefault.enabled || readOnly}
                  onChange={(e) => updateSlaveDefault({ warningValue: e.target.value })}
                  className="input py-1 px-2 text-xs font-mono w-full"
                />
              </div>

              <div className="w-28">
                <label className="text-[10px] font-bold text-red-700 dark:text-red-400 block mb-0.5">
                  Default Red (kW)
                </label>
                <input
                  type="number"
                  value={slaveDefault.criticalValue ?? '100'}
                  disabled={!slaveDefault.enabled || readOnly}
                  onChange={(e) => updateSlaveDefault({ criticalValue: e.target.value })}
                  className="input py-1 px-2 text-xs font-mono w-full"
                />
              </div>
            </div>
          </div>

          {/* 2. Plant Tabs & Search Toolbar */}
          <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 space-y-3">
            {/* Plant Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-surface-200 dark:border-surface-800">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActivePlantTab('all')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activePlantTab === 'all'
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-800 hover:border-surface-300'
                  }`}
                >
                  All Equipment ({allSlaves.length})
                </button>

                {plants.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setActivePlantTab(p.name)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activePlantTab === p.name
                        ? 'bg-primary-600 text-white shadow-xs'
                        : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-800 hover:border-surface-300'
                    }`}
                  >
                    <Building2 size={13} />
                    {p.name} ({p.count})
                  </button>
                ))}
              </div>

              {/* Optional Batch Tool Button */}
              {!readOnly && (
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
                  Batch Setup Tool (Optional)
                  <ChevronDown size={14} className={`transform transition-transform ${showBatchTool ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Optional Batch Tool Drawer */}
            {showBatchTool && !readOnly && (
              <div className="p-3 rounded-lg bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800/60 space-y-2.5 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary-900 dark:text-primary-100 flex items-center gap-1.5">
                    <Zap size={14} className="text-primary-600" />
                    Quick Batch: Check boxes below and set limits on selected machines
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
                    {selectedSlaveIds.length} machines checked
                  </span>
                </div>

                {batchAppliedMsg && (
                  <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-600" />
                    {batchAppliedMsg}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-32">
                    <label className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block mb-0.5">Warning (kW)</label>
                    <input
                      type="number"
                      value={batchWarning}
                      onChange={(e) => setBatchWarning(e.target.value)}
                      placeholder="70"
                      className="input py-1 px-2 text-xs font-mono w-full"
                    />
                  </div>

                  <div className="w-32">
                    <label className="text-[10px] font-bold text-red-700 dark:text-red-400 block mb-0.5">Critical (kW)</label>
                    <input
                      type="number"
                      value={batchCritical}
                      onChange={(e) => setBatchCritical(e.target.value)}
                      placeholder="100"
                      className="input py-1 px-2 text-xs font-mono w-full"
                    />
                  </div>

                  <div className="flex items-end gap-2 pt-4">
                    <button
                      type="button"
                      disabled={selectedSlaveIds.length === 0}
                      onClick={handleApplyToSelected}
                      className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Check size={14} /> Apply to {selectedSlaveIds.length} Selected
                    </button>

                    <button
                      type="button"
                      onClick={() => selectAllInView(filteredSlaves)}
                      className="py-1.5 px-2.5 rounded text-xs font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-800 cursor-pointer"
                    >
                      Check All in View
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedSlaveIds([])}
                      className="py-1.5 px-2.5 rounded text-xs font-medium text-surface-500 hover:text-surface-700 cursor-pointer"
                    >
                      Clear Checks
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Quick Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search machine (e.g. WAPDA, Sewing, Generator)..."
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

              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-surface-400 font-bold mr-1">Show:</span>
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
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                      filterMode === f.key
                        ? 'bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 shadow-2xs'
                        : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. The Clean Master Equipment Table */}
          <div className="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-50 dark:bg-surface-950/60 border-b border-surface-200 dark:border-surface-800 text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <button
                        type="button"
                        onClick={() => selectAllInView(filteredSlaves)}
                        className="text-surface-400 hover:text-primary-600"
                        title="Select All"
                      >
                        {filteredSlaves.length > 0 && filteredSlaves.every((s) => selectedSlaveIds.includes(s.id)) ? (
                          <CheckSquare size={15} className="text-primary-600" />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Equipment / Breaker</th>
                    <th className="py-2.5 px-3">Plant Location</th>
                    <th className="py-2.5 px-3">Current Live Load</th>
                    <th className="py-2.5 px-3">Yellow Warning Limit</th>
                    <th className="py-2.5 px-3">Red Critical Limit</th>
                    <th className="py-2.5 px-3">Limit Status</th>
                    <th className="py-2.5 px-3 text-right">Rule Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-surface-100 dark:divide-surface-800 font-sans">
                  {filteredSlaves.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-surface-400 text-xs">
                        No equipment found matching current filter or search.
                      </td>
                    </tr>
                  ) : (
                    filteredSlaves.map((slv) => {
                      const conf = slaveThresholds[slv.id]
                      const hasCustom = !!conf
                      const isSelected = selectedSlaveIds.includes(slv.id)
                      const isRuleEnabled = hasCustom ? conf.enabled !== false : slaveDefault.enabled

                      const currentWarn = hasCustom
                        ? (conf.warningValue ?? '')
                        : (slaveDefault.enabled ? slaveDefault.warningValue : '')
                      const currentCrit = hasCustom
                        ? (conf.criticalValue ?? '')
                        : (slaveDefault.enabled ? slaveDefault.criticalValue : '')
                      const currentUnit = hasCustom
                        ? (conf.unit || (conf.metricKey === 'current' ? 'A' : 'kW'))
                        : (slaveDefault.unit || 'kW')

                      // Live load alert evaluation
                      const liveVal = slv.liveKw
                      const isExceedingCrit = isRuleEnabled && liveVal != null && Number(currentCrit) > 0 && liveVal >= Number(currentCrit)
                      const isExceedingWarn = isRuleEnabled && liveVal != null && !isExceedingCrit && Number(currentWarn) > 0 && liveVal >= Number(currentWarn)

                      const error = hasCustom && conf.enabled ? validateThresholdRule(`slave-${slv.id}`, conf) : null

                      return (
                        <tr
                          key={slv.id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-primary-50/40 dark:bg-primary-950/20'
                              : isExceedingCrit
                                ? 'bg-red-50/40 dark:bg-red-950/20'
                                : isExceedingWarn
                                  ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                  : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => toggleSelectSlave(slv.id)}
                              className="text-surface-400 hover:text-primary-600"
                            >
                              {isSelected ? (
                                <CheckSquare size={15} className="text-primary-600" />
                              ) : (
                                <Square size={15} />
                              )}
                            </button>
                          </td>

                          {/* Equipment Name & Slave ID */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-surface-900 dark:text-surface-100">
                                {slv.name}
                              </span>
                              {slv.slaveId && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-surface-100 dark:bg-surface-800 text-surface-500">
                                  {slv.slaveId}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-surface-400">{slv.deviceName}</span>
                          </td>

                          {/* Plant Location */}
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] text-surface-600 dark:text-surface-300 font-medium">
                              {slv.plantName}
                            </span>
                          </td>

                          {/* Current Live Load */}
                          <td className="py-2.5 px-3">
                            {liveVal != null ? (
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  isExceedingCrit
                                    ? 'bg-red-500 animate-pulse'
                                    : isExceedingWarn
                                      ? 'bg-amber-400 animate-pulse'
                                      : 'bg-emerald-500'
                                }`} />
                                <span className="font-mono font-bold text-surface-900 dark:text-surface-100">
                                  {liveVal} kW
                                </span>
                              </div>
                            ) : (
                              <span className="text-surface-400 font-mono text-[11px]">0.0 kW</span>
                            )}
                          </td>

                          {/* Yellow Warning Limit */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                              <input
                                type="number"
                                step="1"
                                min="0"
                                placeholder="70"
                                disabled={!isRuleEnabled || readOnly}
                                value={currentWarn}
                                onChange={(e) => {
                                  updateSlaveThreshold(slv.id, {
                                    warningValue: e.target.value,
                                    enabled: true,
                                    criticalValue: currentCrit || '100',
                                  })
                                }}
                                className="input py-1 px-2 text-xs font-mono w-24"
                              />
                              <span className="text-[10px] text-surface-400 font-bold">{currentUnit}</span>
                            </div>
                          </td>

                          {/* Red Critical Limit */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                              <input
                                type="number"
                                step="1"
                                min="0"
                                placeholder="100"
                                disabled={!isRuleEnabled || readOnly}
                                value={currentCrit}
                                onChange={(e) => {
                                  updateSlaveThreshold(slv.id, {
                                    criticalValue: e.target.value,
                                    enabled: true,
                                    warningValue: currentWarn || '70',
                                  })
                                }}
                                className="input py-1 px-2 text-xs font-mono w-24"
                              />
                              <span className="text-[10px] text-surface-400 font-bold">{currentUnit}</span>
                            </div>
                            {error && (
                              <p className="text-[10px] text-danger-600 font-semibold mt-0.5">{error}</p>
                            )}
                          </td>

                          {/* Limit Status Badge */}
                          <td className="py-2.5 px-3">
                            {hasCustom ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                conf.enabled
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${conf.enabled ? 'bg-blue-600' : 'bg-surface-400'}`} />
                                {conf.enabled ? 'Custom Limit' : 'Disabled'}
                              </span>
                            ) : slaveDefault.enabled ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Baseline Default
                              </span>
                            ) : (
                              <span className="text-[10px] text-surface-400 font-medium">Unmonitored</span>
                            )}
                          </td>

                          {/* Rule Action Toggle & Reset */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <ToggleInput
                                label=""
                                checked={isRuleEnabled}
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

                              {hasCustom && !readOnly && (
                                <button
                                  type="button"
                                  onClick={() => removeSlaveThreshold(slv.id)}
                                  className="text-surface-400 hover:text-danger-600 p-1 transition-colors"
                                  title="Reset to default baseline"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
