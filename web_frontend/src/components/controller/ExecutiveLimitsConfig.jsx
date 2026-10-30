import { useState, useMemo } from 'react'
import {
  ALLOWED_EXECUTIVE_METRICS,
  PLANT_TOTALS_METRICS,
  STANDARD_ENERGY_SOURCES,
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
  Activity,
  Sun,
  Fuel,
} from 'lucide-react'

export default function ExecutiveLimitsConfig({
  executiveLimits = {},
  onChange,
  devices = [],
  sources = [],
  sites = [],
  readOnly = false,
}) {
  // Top-level thresholds & configurations
  const thresholds = executiveLimits?.thresholds || {}
  const sourceThresholds = executiveLimits?.sourceThresholds || {}
  const totalThresholds = executiveLimits?.totalThresholds || {}
  const slaveThresholds = executiveLimits?.slaveThresholds || {}
  const slaveDefault = executiveLimits?.slaveDefault || {
    enabled: false,
    warningValue: '70',
    criticalValue: '100',
    unit: 'kW',
  }

  // Top Section Navigation Tab: 'equipment' | 'sources' | 'totals'
  const [activeSection, setActiveSection] = useState('equipment')

  // Equipment Filtering & Search
  const [activePlantTab, setActivePlantTab] = useState('all') // 'all' | plantName
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
  // Strictly assign every machine into its physical factory site (Ambition B1 vs AFL B2)
  const allSlaves = useMemo(() => {
    return devices.flatMap((d) => {
      const slvs = d.slaves || d.configSlaves || d._raw?.configSlaves || []
      const devName = d.name || 'Gateway'
      const devLower = devName.toLowerCase()
      const dId = d.id || ''

      // Automatic physical site mapping:
      // AFL gateways -> AFL Plant (B2)
      // Ambition, Solar, Washing, Drying -> Ambition Plant (B1)
      let plantName = 'Ambition Plant (B1)'
      if (
        devLower.includes('afl') ||
        dId === 'cdd6d1b1-6fd8-48a5-9984-5e220328571d' ||
        dId === '3a3636fa-05ed-4b3c-94de-2637d1292b4b' ||
        dId === '6f8725c8-e15a-43e8-a340-c30d5ed7e8ac'
      ) {
        plantName = 'AFL Plant (B2)'
      } else if (sites && sites.length > 0) {
        const matchedSite = sites.find((st) => st.id === d.siteId || st.name?.toLowerCase() === devLower)
        if (matchedSite) plantName = matchedSite.name
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

        // Check if individual slave has AFL in name
        const sNameLower = (s.name || '').toLowerCase()
        let slavePlant = plantName
        if (sNameLower.includes('afl')) {
          slavePlant = 'AFL Plant (B2)'
        }

        return {
          ...s,
          deviceId: d.id,
          deviceName: devName,
          plantName: slavePlant,
          liveKw: liveKw != null ? Math.abs(+liveKw.toFixed(1)) : null,
        }
      })
    })
  }, [devices, sites])

  // Plant groupings for tabs
  const plants = useMemo(() => {
    const map = new Map()
    allSlaves.forEach((s) => {
      const count = map.get(s.plantName) || 0
      map.set(s.plantName, count + 1)
    })
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [allSlaves])

  // Normalize all Energy Sources (standard plant supply + user-configured sources)
  const allSources = useMemo(() => {
    const std = STANDARD_ENERGY_SOURCES.map((s) => {
      // Find live kW from devices/slaves if possible
      let liveKw = null
      const matchedSlave = allSlaves.find((slv) => {
        const sName = (slv.name || '').toLowerCase()
        if (s.id === 'b1-wapda') return sName.includes('wapda-amb') || sName.includes('wapda amb')
        if (s.id === 'b1-solar') return sName.includes('solar amb') || sName.includes('solar-invt')
        if (s.id === 'b1-genset1') return sName === 'g1'
        if (s.id === 'b1-genset2') return sName === 'g2'
        if (s.id === 'b2-wapda') return sName.includes('wapda-afl') || sName.includes('wapda afl')
        if (s.id === 'b2-solar') return sName.includes('solar afl')
        if (s.id === 'b2-genset') return sName.includes('g3 afl') || sName.includes('gen afl')
        return false
      })
      if (matchedSlave && matchedSlave.liveKw != null) liveKw = matchedSlave.liveKw

      return {
        ...s,
        liveKw,
      }
    })

    // Also incorporate custom sources from the Energy Sources tab
    const customList = (sources || []).map((s) => {
      const exists = std.find((x) => x.id === s.id || x.name.toLowerCase() === (s.name || '').toLowerCase())
      if (exists) return null

      const siteObj = sites.find((st) => st.id === s.siteId)
      const plant = siteObj?.name || (s.siteId === 'site-1' ? 'Ambition Plant (B1)' : 'AFL Plant (B2)')

      return {
        id: s.id,
        name: s.name,
        plant,
        type: s.type || 'custom',
        unit: 'kW',
        defaultWarn: '500',
        defaultCrit: '800',
        liveKw: s.valueKw != null ? Number(s.valueKw) : null,
      }
    }).filter(Boolean)

    return [...std, ...customList]
  }, [allSlaves, sources, sites])

  // Normalize all Plant Totals (Dual facility, WAPDA, Solar, Generators, Building 1, Building 2)
  const allTotals = useMemo(() => {
    return PLANT_TOTALS_METRICS.map((tm) => {
      let liveKw = null
      if (tm.key === 'totalWapda') {
        const b1W = allSlaves.find((s) => (s.name || '').toLowerCase().includes('wapda-amb'))?.liveKw || 0
        const b2W = allSlaves.find((s) => (s.name || '').toLowerCase().includes('wapda-afl'))?.liveKw || 0
        if (b1W || b2W) liveKw = +(b1W + b2W).toFixed(1)
      } else if (tm.key === 'solarTotal') {
        const sSum = allSlaves.filter((s) => (s.name || '').toLowerCase().includes('solar')).reduce((sum, s) => sum + (s.liveKw || 0), 0)
        if (sSum) liveKw = +sSum.toFixed(1)
      } else if (tm.key === 'totalGenset') {
        const gSum = allSlaves
          .filter((s) => {
            const n = (s.name || '').toLowerCase()
            return n === 'g1' || n === 'g2' || n.includes('g3 afl')
          })
          .reduce((sum, s) => sum + (s.liveKw || 0), 0)
        if (gSum) liveKw = +gSum.toFixed(1)
      } else if (tm.key === 'totalRunningLoadB1') {
        const b1Sum = allSlaves.filter((s) => s.plantName === 'Ambition Plant (B1)').reduce((sum, s) => sum + (s.liveKw || 0), 0)
        if (b1Sum) liveKw = +b1Sum.toFixed(1)
      } else if (tm.key === 'totalRunningLoadB2') {
        const b2Sum = allSlaves.filter((s) => s.plantName === 'AFL Plant (B2)').reduce((sum, s) => sum + (s.liveKw || 0), 0)
        if (b2Sum) liveKw = +b2Sum.toFixed(1)
      } else if (tm.key === 'totalRunningLoad') {
        const allSum = allSlaves.reduce((sum, s) => sum + (s.liveKw || 0), 0)
        if (allSum) liveKw = +allSum.toFixed(1)
      }

      return {
        ...tm,
        liveKw,
      }
    })
  }, [allSlaves])

  // ─── CHANGE HANDLERS ────────────────────────────────────────────────────────

  // Update Single Energy Source Threshold (WAPDA-AMB, Solar AMB, Genset, etc.)
  const updateSourceThreshold = (sourceId, patch) => {
    if (readOnly) return
    const src = allSources.find((s) => s.id === sourceId)
    const current = sourceThresholds[sourceId] || {
      enabled: true,
      direction: 'above',
      warningValue: src?.defaultWarn || '500',
      criticalValue: src?.defaultCrit || '800',
      unit: 'kW',
      sourceName: src?.name || '',
      plantName: src?.plant || '',
    }

    const updated = {
      ...executiveLimits,
      sourceThresholds: {
        ...sourceThresholds,
        [sourceId]: {
          ...current,
          ...patch,
          sourceName: src?.name || current.sourceName,
          plantName: src?.plant || current.plantName,
        },
      },
    }
    onChange?.(updated)
  }

  // Remove Source Threshold
  const removeSourceThreshold = (sourceId) => {
    if (readOnly) return
    const next = { ...sourceThresholds }
    delete next[sourceId]
    onChange?.({
      ...executiveLimits,
      sourceThresholds: next,
    })
  }

  // Update Plant Total / Inflow Threshold (Total Running Load, Total WAPDA, etc.)
  const updateTotalThreshold = (totalKey, patch) => {
    if (readOnly) return
    const tm = allTotals.find((t) => t.key === totalKey)
    const current = totalThresholds[totalKey] || thresholds[totalKey] || {
      enabled: true,
      direction: 'above',
      warningValue: tm?.defaultWarn || '800',
      criticalValue: tm?.defaultCrit || '1200',
      unit: 'kW',
      totalName: tm?.label || '',
    }

    const updated = {
      ...executiveLimits,
      totalThresholds: {
        ...totalThresholds,
        [totalKey]: {
          ...current,
          ...patch,
          totalName: tm?.label || current.totalName,
        },
      },
      thresholds: {
        ...thresholds,
        [totalKey]: {
          ...current,
          ...patch,
        },
      },
    }
    onChange?.(updated)
  }

  // Remove Total Threshold
  const removeTotalThreshold = (totalKey) => {
    if (readOnly) return
    const nextTot = { ...totalThresholds }
    delete nextTot[totalKey]
    const nextThresh = { ...thresholds }
    delete nextThresh[totalKey]
    onChange?.({
      ...executiveLimits,
      totalThresholds: nextTot,
      thresholds: nextThresh,
    })
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

  // Remove Custom Threshold
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
  const activeSourcesCount = Object.values(sourceThresholds).filter((s) => s.enabled).length
  const activeTotalsCount = Object.values(totalThresholds).filter((t) => t.enabled).length

  return (
    <div className="space-y-6">
      {/* ─── Top Switcher: Slaves vs Energy Sources vs Plant Totals ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-2xl bg-surface-100 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-surface-900 shadow-2xs flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSection('equipment')}
            className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
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
            onClick={() => setActiveSection('sources')}
            className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSection === 'sources'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
            }`}
          >
            <Zap size={15} />
            Energy Sources ({allSources.length})
            {activeSourcesCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                {activeSourcesCount} Active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('totals')}
            className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSection === 'totals'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
            }`}
          >
            <Activity size={15} />
            Plant Totals & Inflow ({allTotals.length})
            {activeTotalsCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                {activeTotalsCount} Active
              </span>
            )}
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

      {/* ─── SECTION 1: ENERGY SUPPLY SOURCES ─── */}
      {activeSection === 'sources' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Set Warning (Yellow) & Critical (Red) Thresholds for Supply Sources</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Configure limits for incoming WAPDA grid feeders, solar inverters, and backup generators. Cards on the Executive Dashboard turn yellow or red when telemetry reaches these limits.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 dark:bg-surface-800/80 text-surface-600 dark:text-surface-400 uppercase text-[10px] tracking-wider border-b border-surface-200 dark:border-surface-800">
                <tr>
                  <th className="py-2.5 px-3">Source Name</th>
                  <th className="py-2.5 px-3">Plant Site</th>
                  <th className="py-2.5 px-3">Live Telemetry</th>
                  <th className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-bold">Warning (Yellow)</th>
                  <th className="py-2.5 px-3 text-red-700 dark:text-red-400 font-bold">Critical (Red)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Active / Reset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {allSources.map((src) => {
                  const conf = sourceThresholds[src.id] || {
                    enabled: false,
                    warningValue: src.defaultWarn || '500',
                    criticalValue: src.defaultCrit || '800',
                    unit: 'kW',
                  }
                  const isEnabled = !!conf.enabled
                  const warnVal = conf.warningValue ?? src.defaultWarn
                  const critVal = conf.criticalValue ?? src.defaultCrit
                  const liveKw = src.liveKw
                  const isCrit = isEnabled && liveKw != null && Number(critVal) > 0 && liveKw >= Number(critVal)
                  const isWarn = isEnabled && !isCrit && liveKw != null && Number(warnVal) > 0 && liveKw >= Number(warnVal)
                  const error = validateThresholdRule(`source-${src.id}`, conf)

                  const isWapda = src.type === 'grid' || /wapda|grid/i.test(src.name)
                  const isSolar = src.type === 'solar' || /solar/i.test(src.name)
                  const isGenset = src.type === 'generator' || /genset|gen/i.test(src.name)

                  return (
                    <tr
                      key={src.id}
                      className={`hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors ${
                        isCrit
                          ? 'bg-red-50/50 dark:bg-red-950/20'
                          : isWarn
                          ? 'bg-amber-50/50 dark:bg-amber-950/20'
                          : ''
                      }`}
                    >
                      {/* Name & Type */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg shrink-0 ${
                            isWapda
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : isSolar
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          }`}>
                            {isWapda && <Zap size={14} />}
                            {isSolar && <Sun size={14} />}
                            {isGenset && <Fuel size={14} />}
                          </div>
                          <div>
                            <span className="font-bold text-surface-900 dark:text-surface-100 block">
                              {src.name}
                            </span>
                            <span className="text-[10px] text-surface-400 capitalize">
                              {src.type || 'Source'} Supply
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Plant / Site */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
                          <Building2 size={11} className="text-surface-400" />
                          {src.plant}
                        </span>
                      </td>

                      {/* Live Telemetry */}
                      <td className="py-2.5 px-3">
                        {liveKw != null ? (
                          <span className={`font-mono font-bold text-xs ${
                            isCrit
                              ? 'text-red-700 dark:text-red-400'
                              : isWarn
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-surface-900 dark:text-surface-100'
                          }`}>
                            {liveKw.toFixed(1)} <span className="text-[10px] text-surface-400">kW</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-surface-400 font-mono">—</span>
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
                            placeholder={src.defaultWarn || '500'}
                            disabled={!isEnabled || readOnly}
                            value={warnVal}
                            onChange={(e) => {
                              updateSourceThreshold(src.id, {
                                warningValue: e.target.value,
                                enabled: true,
                                criticalValue: critVal || '800',
                              })
                            }}
                            className="input py-1 px-2 text-xs font-mono w-28"
                          />
                          <span className="text-[10px] text-surface-400 font-bold">kW</span>
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
                            placeholder={src.defaultCrit || '800'}
                            disabled={!isEnabled || readOnly}
                            value={critVal}
                            onChange={(e) => {
                              updateSourceThreshold(src.id, {
                                criticalValue: e.target.value,
                                enabled: true,
                                warningValue: warnVal || '500',
                              })
                            }}
                            className="input py-1 px-2 text-xs font-mono w-28"
                          />
                          <span className="text-[10px] text-surface-400 font-bold">kW</span>
                        </div>
                        {error && (
                          <p className="text-[10px] text-danger-600 font-semibold mt-0.5">{error}</p>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3">
                        {isCrit ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            Critical Exceeded
                          </span>
                        ) : isWarn ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Warning Level
                          </span>
                        ) : isEnabled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active Monitor
                          </span>
                        ) : (
                          <span className="text-[11px] text-surface-400 font-medium">Unmonitored</span>
                        )}
                      </td>

                      {/* Action Toggle & Reset */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ToggleInput
                            label=""
                            checked={isEnabled}
                            onChange={(val) => {
                              updateSourceThreshold(src.id, {
                                enabled: val,
                                warningValue: warnVal || src.defaultWarn || '500',
                                criticalValue: critVal || src.defaultCrit || '800',
                              })
                            }}
                          />
                          {isEnabled && !readOnly && (
                            <button
                              type="button"
                              onClick={() => removeSourceThreshold(src.id)}
                              className="text-surface-400 hover:text-danger-600 p-1 transition-colors"
                              title="Reset source limit"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SECTION 2: PLANT TOTALS & INFLOW LIMITS ─── */}
      {activeSection === 'totals' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Set Warning (Yellow) & Critical (Red) Thresholds for Factory Totals</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Configure high-level plant thresholds including Total Running Load (B1 + B2), Total WAPDA Inflow, Solar Total Generation, Total Genset, and Individual Building Total Substation loads.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 dark:bg-surface-800/80 text-surface-600 dark:text-surface-400 uppercase text-[10px] tracking-wider border-b border-surface-200 dark:border-surface-800">
                <tr>
                  <th className="py-2.5 px-3">Total / KPI Name</th>
                  <th className="py-2.5 px-3">Scope</th>
                  <th className="py-2.5 px-3">Live Total Reading</th>
                  <th className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-bold">Warning (Yellow)</th>
                  <th className="py-2.5 px-3 text-red-700 dark:text-red-400 font-bold">Critical (Red)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Active / Reset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {allTotals.map((tm) => {
                  const conf = totalThresholds[tm.key] || thresholds[tm.key] || {
                    enabled: false,
                    warningValue: tm.defaultWarn || '800',
                    criticalValue: tm.defaultCrit || '1200',
                    unit: 'kW',
                  }
                  const isEnabled = !!conf.enabled
                  const warnVal = conf.warningValue ?? tm.defaultWarn
                  const critVal = conf.criticalValue ?? tm.defaultCrit
                  const liveKw = tm.liveKw
                  const isCrit = isEnabled && liveKw != null && Number(critVal) > 0 && liveKw >= Number(critVal)
                  const isWarn = isEnabled && !isCrit && liveKw != null && Number(warnVal) > 0 && liveKw >= Number(warnVal)
                  const error = validateThresholdRule(`total-${tm.key}`, conf)

                  return (
                    <tr
                      key={tm.key}
                      className={`hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors ${
                        isCrit
                          ? 'bg-red-50/50 dark:bg-red-950/20'
                          : isWarn
                          ? 'bg-amber-50/50 dark:bg-amber-950/20'
                          : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                            <Activity size={14} />
                          </div>
                          <div>
                            <span className="font-bold text-surface-900 dark:text-surface-100 block">
                              {tm.label}
                            </span>
                            <span className="text-[10px] text-surface-400 font-mono">
                              Key: {tm.key}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Scope Category */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
                          <Layers size={11} className="text-surface-400" />
                          {tm.category}
                        </span>
                      </td>

                      {/* Live Reading */}
                      <td className="py-2.5 px-3">
                        {liveKw != null ? (
                          <span className={`font-mono font-bold text-xs ${
                            isCrit
                              ? 'text-red-700 dark:text-red-400'
                              : isWarn
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-surface-900 dark:text-surface-100'
                          }`}>
                            {liveKw.toFixed(1)} <span className="text-[10px] text-surface-400">kW</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-surface-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Warning (Yellow) */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder={tm.defaultWarn || '800'}
                            disabled={!isEnabled || readOnly}
                            value={warnVal}
                            onChange={(e) => {
                              updateTotalThreshold(tm.key, {
                                warningValue: e.target.value,
                                enabled: true,
                                criticalValue: critVal || '1200',
                              })
                            }}
                            className="input py-1 px-2 text-xs font-mono w-28"
                          />
                          <span className="text-[10px] text-surface-400 font-bold">kW</span>
                        </div>
                      </td>

                      {/* Critical (Red) */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder={tm.defaultCrit || '1200'}
                            disabled={!isEnabled || readOnly}
                            value={critVal}
                            onChange={(e) => {
                              updateTotalThreshold(tm.key, {
                                criticalValue: e.target.value,
                                enabled: true,
                                warningValue: warnVal || '800',
                              })
                            }}
                            className="input py-1 px-2 text-xs font-mono w-28"
                          />
                          <span className="text-[10px] text-surface-400 font-bold">kW</span>
                        </div>
                        {error && (
                          <p className="text-[10px] text-danger-600 font-semibold mt-0.5">{error}</p>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3">
                        {isCrit ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            Critical Exceeded
                          </span>
                        ) : isWarn ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Warning Level
                          </span>
                        ) : isEnabled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active Monitor
                          </span>
                        ) : (
                          <span className="text-[11px] text-surface-400 font-medium">Unmonitored</span>
                        )}
                      </td>

                      {/* Action Toggle & Reset */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ToggleInput
                            label=""
                            checked={isEnabled}
                            onChange={(val) => {
                              updateTotalThreshold(tm.key, {
                                enabled: val,
                                warningValue: warnVal || tm.defaultWarn || '800',
                                criticalValue: critVal || tm.defaultCrit || '1200',
                              })
                            }}
                          />
                          {isEnabled && !readOnly && (
                            <button
                              type="button"
                              onClick={() => removeTotalThreshold(tm.key)}
                              className="text-surface-400 hover:text-danger-600 p-1 transition-colors"
                              title="Reset total limit"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SECTION 3: INDIVIDUAL EQUIPMENT & BREAKER LIMITS ─── */}
      {activeSection === 'equipment' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Quick Informational Notice */}
          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Set Custom Alert Limits for Any Machine or Breaker</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Every machine has its own unique Yellow Warning and Red Critical limits. All Ambition solar inverters are organized inside the Ambition Plant (B1) tab, and Solar AFL is organized inside AFL Plant (B2). Change the values directly in the table below, then click &quot;Save Configuration&quot; at the top.
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
                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Check size={14} /> Apply to Selected ({selectedSlaveIds.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedSlaveIds([])}
                      disabled={selectedSlaveIds.length === 0}
                      className="btn-secondary text-xs py-1.5 px-2.5 disabled:opacity-50"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Filter Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search machine name, gateway, or slave..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-8 py-1.5 text-xs w-full"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <Filter size={13} className="text-surface-400" />
                <span className="text-surface-500 font-bold text-[11px]">Filter:</span>

                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`py-1 px-2.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-surface-800 text-white dark:bg-surface-200 dark:text-surface-900 shadow-2xs'
                      : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-800'
                  }`}
                >
                  All ({allSlaves.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('custom')}
                  className={`py-1 px-2.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    filterMode === 'custom'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-800'
                  }`}
                >
                  Custom Limits ({customSlavesCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('default')}
                  className={`py-1 px-2.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    filterMode === 'default'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-800'
                  }`}
                >
                  Using Default ({defaultSlavesCount})
                </button>
              </div>
            </div>
          </div>

          {/* 3. The Master Equipment Table */}
          <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 dark:bg-surface-800/80 text-surface-600 dark:text-surface-400 uppercase text-[10px] tracking-wider border-b border-surface-200 dark:border-surface-800">
                <tr>
                  {!readOnly && (
                    <th className="py-2.5 px-3 w-8">
                      <button
                        type="button"
                        onClick={() => selectAllInView(filteredSlaves)}
                        className="text-surface-500 hover:text-surface-800 dark:hover:text-surface-200"
                        title="Select/Deselect all visible equipment"
                      >
                        {filteredSlaves.length > 0 && filteredSlaves.every((s) => selectedSlaveIds.includes(s.id)) ? (
                          <CheckSquare size={15} className="text-primary-600" />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="py-2.5 px-3">Equipment / Machine Name</th>
                  <th className="py-2.5 px-3">Plant & Gateway</th>
                  <th className="py-2.5 px-3">Live Power</th>
                  <th className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-bold">
                    Warning Limit (Yellow)
                  </th>
                  <th className="py-2.5 px-3 text-red-700 dark:text-red-400 font-bold">
                    Critical Limit (Red)
                  </th>
                  <th className="py-2.5 px-3">Rule Type</th>
                  <th className="py-2.5 px-3 text-right">Active / Reset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {filteredSlaves.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 7 : 8} className="py-8 text-center text-surface-400">
                      No machines found matching the selected filter or search term.
                    </td>
                  </tr>
                ) : (
                  filteredSlaves.map((slv) => {
                    const isSelected = selectedSlaveIds.includes(slv.id)
                    const conf = slaveThresholds[slv.id]
                    const hasCustom = !!conf
                    const isRuleEnabled = hasCustom ? conf.enabled !== false : !!slaveDefault.enabled

                    // Evaluate values
                    const currentWarn = hasCustom
                      ? conf.warningValue
                      : slaveDefault.enabled
                      ? slaveDefault.warningValue
                      : ''
                    const currentCrit = hasCustom
                      ? conf.criticalValue
                      : slaveDefault.enabled
                      ? slaveDefault.criticalValue
                      : ''
                    const currentUnit = conf?.unit || 'kW'

                    // Live evaluation
                    const liveKw = slv.liveKw
                    const isCriticalAlarm =
                      isRuleEnabled &&
                      liveKw != null &&
                      Number(currentCrit) > 0 &&
                      liveKw >= Number(currentCrit)
                    const isWarningAlarm =
                      isRuleEnabled &&
                      !isCriticalAlarm &&
                      liveKw != null &&
                      Number(currentWarn) > 0 &&
                      liveKw >= Number(currentWarn)

                    const error = hasCustom && conf.enabled ? validateThresholdRule(`slave-${slv.id}`, conf) : null

                    return (
                      <tr
                        key={slv.id}
                        className={`hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors ${
                          isSelected ? 'bg-primary-50/40 dark:bg-primary-950/20' : ''
                        } ${
                          isCriticalAlarm
                            ? 'bg-red-50/60 dark:bg-red-950/20'
                            : isWarningAlarm
                            ? 'bg-amber-50/60 dark:bg-amber-950/20'
                            : ''
                        }`}
                      >
                        {/* Checkbox */}
                        {!readOnly && (
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => toggleSelectSlave(slv.id)}
                              className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare size={15} className="text-primary-600" />
                              ) : (
                                <Square size={15} />
                              )}
                            </button>
                          </td>
                        )}

                        {/* Equipment Name */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
                              <Cpu size={13} />
                            </div>
                            <div>
                              <span className="font-bold text-surface-900 dark:text-surface-100 block">
                                {slv.name || 'Unnamed Machine'}
                              </span>
                              <span className="text-[10px] text-surface-400 font-mono">
                                ID: {slv.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Plant & Gateway */}
                        <td className="py-2.5 px-3">
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-surface-700 dark:text-surface-300">
                              <Building2 size={11} className="text-surface-400" />
                              {slv.plantName}
                            </span>
                            <span className="text-[10px] text-surface-400 block">
                              Gateway: {slv.deviceName}
                            </span>
                          </div>
                        </td>

                        {/* Live Telemetry */}
                        <td className="py-2.5 px-3">
                          {liveKw != null ? (
                            <span
                              className={`font-mono font-bold text-xs ${
                                isCriticalAlarm
                                  ? 'text-red-700 dark:text-red-400'
                                  : isWarningAlarm
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-surface-900 dark:text-surface-100'
                              }`}
                            >
                              {liveKw.toFixed(1)} <span className="text-[10px] text-surface-400">kW</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-surface-400 font-mono">—</span>
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
      )}
    </div>
  )
}
