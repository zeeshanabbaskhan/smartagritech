/**
 * Centralized Threshold Utilities for Executive Dashboard & Controller
 * 
 * Defines metric units, allowed ranges, validation logic, and pure evaluation
 * functions for warning/critical alert states.
 */

export const ALLOWED_EXECUTIVE_METRICS = [
  { key: 'totalLoad', label: 'Total Load / Power', unit: 'kW', defaultDirection: 'above', min: 0, max: 100000 },
  { key: 'solarPower', label: 'Solar Power', unit: 'kW', defaultDirection: 'above', min: 0, max: 50000 },
  { key: 'generatorPower', label: 'Generator Power', unit: 'kW', defaultDirection: 'above', min: 0, max: 50000 },
  { key: 'gridPower', label: 'WAPDA / Grid Power', unit: 'kW', defaultDirection: 'above', min: 0, max: 100000 },
  { key: 'totalRunningLoad', label: 'Total Running Load (Dual B1+B2)', unit: 'kW', defaultDirection: 'above', min: 0, max: 100000 },
  { key: 'totalWapda', label: 'Total WAPDA Grid Inflow', unit: 'kW', defaultDirection: 'above', min: 0, max: 100000 },
  { key: 'solarTotal', label: 'Solar Total Generation', unit: 'kW', defaultDirection: 'above', min: 0, max: 50000 },
  { key: 'totalGenset', label: 'Total Generators Generation', unit: 'kW', defaultDirection: 'above', min: 0, max: 50000 },
  { key: 'totalRunningLoadB1', label: 'Total Running Load B1 (Ambition)', unit: 'kW', defaultDirection: 'above', min: 0, max: 50000 },
  { key: 'totalRunningLoadB2', label: 'Total Running Load B2 (AFL)', unit: 'kW', defaultDirection: 'above', min: 0, max: 50000 },
  { key: 'currentA', label: 'Phase Current A', unit: 'A', defaultDirection: 'above', min: 0, max: 10000 },
  { key: 'currentB', label: 'Phase Current B', unit: 'A', defaultDirection: 'above', min: 0, max: 10000 },
  { key: 'currentC', label: 'Phase Current C', unit: 'A', defaultDirection: 'above', min: 0, max: 10000 },
  { key: 'powerFactor', label: 'Power Factor', unit: '', defaultDirection: 'below', min: 0, max: 1.0 },
]

export const PLANT_TOTALS_METRICS = [
  { key: 'totalRunningLoad', label: 'Total Running Load (Dual Facility B1 + B2)', category: 'Plant Combined Inflow', unit: 'kW', defaultDirection: 'above', defaultWarn: '1200', defaultCrit: '1500' },
  { key: 'totalWapda', label: 'Total WAPDA Grid Inflow', category: 'Grid Inflow (Dual B1 + B2)', unit: 'kW', defaultDirection: 'above', defaultWarn: '800', defaultCrit: '1000' },
  { key: 'solarTotal', label: 'Solar Total Generation (All 7 Inverters)', category: 'Solar Farm Inflow', unit: 'kW', defaultDirection: 'above', defaultWarn: '400', defaultCrit: '600' },
  { key: 'totalGenset', label: 'Total Diesel Generators Generation', category: 'Generators Totalizer', unit: 'kW', defaultDirection: 'above', defaultWarn: '500', defaultCrit: '800' },
  { key: 'totalRunningLoadB1', label: 'Total Running Load B1 (Ambition Plant)', category: 'Building 1 Total Substation', unit: 'kW', defaultDirection: 'above', defaultWarn: '700', defaultCrit: '900' },
  { key: 'totalRunningLoadB2', label: 'Total Running Load B2 (AFL Plant)', category: 'Building 2 Total Substation', unit: 'kW', defaultDirection: 'above', defaultWarn: '300', defaultCrit: '500' },
]

export const STANDARD_ENERGY_SOURCES = [
  // Ambition Plant (B1)
  { id: 'b1-wapda', name: 'WAPDA - AMB', plant: 'Ambition Plant (B1)', type: 'grid', unit: 'kW', defaultWarn: '500', defaultCrit: '700' },
  { id: 'b1-solar', name: 'Solar AMB (Inverters 1-5)', plant: 'Ambition Plant (B1)', type: 'solar', unit: 'kW', defaultWarn: '250', defaultCrit: '400' },
  { id: 'b1-genset1', name: 'Genset 1 (G1 AMB)', plant: 'Ambition Plant (B1)', type: 'generator', unit: 'kW', defaultWarn: '300', defaultCrit: '500' },
  { id: 'b1-genset2', name: 'Genset 2 (G2 AMB)', plant: 'Ambition Plant (B1)', type: 'generator', unit: 'kW', defaultWarn: '300', defaultCrit: '500' },
  // AFL Plant (B2)
  { id: 'b2-wapda', name: 'Wapda - B2 (AFL)', plant: 'AFL Plant (B2)', type: 'grid', unit: 'kW', defaultWarn: '200', defaultCrit: '350' },
  { id: 'b2-solar', name: 'Solar AFL', plant: 'AFL Plant (B2)', type: 'solar', unit: 'kW', defaultWarn: '100', defaultCrit: '200' },
  { id: 'b2-genset', name: 'Genset (G3 AFL)', plant: 'AFL Plant (B2)', type: 'generator', unit: 'kW', defaultWarn: '200', defaultCrit: '350' },
]

export const DEFAULT_EXECUTIVE_LIMITS = {
  version: 1,
  thresholds: {
    totalLoad: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    solarPower: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    generatorPower: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    gridPower: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    totalRunningLoad: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    totalWapda: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    solarTotal: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    totalGenset: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    totalRunningLoadB1: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    totalRunningLoadB2: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    currentA: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'A' },
    currentB: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'A' },
    currentC: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'A' },
    powerFactor: { enabled: false, direction: 'below', warningValue: '', criticalValue: '', unit: '' },
  },
  sourceThresholds: {},
  totalThresholds: {},
  slaveThresholds: {},
}

/**
 * Pure evaluation function for KPI card background colors and alert status.
 * Never produces false alarms for missing, invalid, or offline readings.
 */
export function evaluateThresholdStatus(value, thresholdConfig, options = {}) {
  const { isOffline = false, metricKey = '' } = options

  // Normal white state classes (factory default)
  const NORMAL_CLASSES = 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800'
  const NEUTRAL_OFFLINE_CLASSES = 'bg-surface-50 dark:bg-surface-950/60 border-surface-200 dark:border-surface-800 opacity-90'

  // 1. If device is explicitly offline or telemetry is marked stale, return neutral state
  if (isOffline) {
    return {
      status: 'offline',
      bgClass: NEUTRAL_OFFLINE_CLASSES,
      badgeText: 'Offline',
      isOffline: true,
    }
  }

  // 2. If threshold is disabled, null, or not configured, return standard crisp white
  if (!thresholdConfig || !thresholdConfig.enabled) {
    return {
      status: 'normal',
      bgClass: NORMAL_CLASSES,
      isNormal: true,
      isDisabled: true,
    }
  }

  // 3. If reading is missing or invalid, return neutral state (never evaluate NaN as 0)
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return {
      status: 'missing',
      bgClass: NORMAL_CLASSES,
      badgeText: 'No Data',
      isMissing: true,
    }
  }

  const numVal = Number(value)
  const warn = Number(thresholdConfig.warningValue)
  const crit = Number(thresholdConfig.criticalValue)

  // If configured numbers are invalid, stay safe in normal white
  if (!Number.isFinite(warn) || !Number.isFinite(crit)) {
    return { status: 'normal', bgClass: NORMAL_CLASSES, isNormal: true }
  }

  // 4. Special Low-Limit Guard for Power Factor:
  // If meter is powered down, PF may register 0.00. Disconnected meters must never trigger a critical red alert.
  if (metricKey === 'powerFactor' || thresholdConfig.direction === 'below') {
    if (numVal <= 0) {
      return { status: 'missing', bgClass: NORMAL_CLASSES, badgeText: 'Inactive', isMissing: true }
    }

    // Direction: below (Alarm on drop below limit)
    // Critical: <= crit
    // Warning: <= warn
    if (numVal <= crit) {
      return {
        status: 'critical',
        bgClass: 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800/80 text-red-950 dark:text-red-100',
        badgeText: 'Critical Low',
        isCritical: true,
      }
    }
    if (numVal <= warn) {
      return {
        status: 'warning',
        bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-100',
        badgeText: 'Warning Low',
        isWarning: true,
      }
    }
    return { status: 'normal', bgClass: NORMAL_CLASSES, isNormal: true }
  }

  // 5. High-Limit Evaluation (Default for Total Load, Currents, Slaves):
  // Warning: >= warn
  // Critical: >= crit
  if (numVal >= crit) {
    return {
      status: 'critical',
      bgClass: 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800/80 text-red-950 dark:text-red-100',
      badgeText: 'Critical High',
      isCritical: true,
    }
  }
  if (numVal >= warn) {
    return {
      status: 'warning',
      bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-100',
      badgeText: 'Warning High',
      isWarning: true,
    }
  }

  return { status: 'normal', bgClass: NORMAL_CLASSES, isNormal: true }
}

/**
 * Validates threshold limits on client before saving.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateThresholdRule(key, conf) {
  if (!conf || !conf.enabled) return null

  const w = Number(conf.warningValue)
  const c = Number(conf.criticalValue)

  if (!Number.isFinite(w) || w < 0) {
    return `Warning threshold for ${key} must be a positive number`
  }
  if (!Number.isFinite(c) || c < 0) {
    return `Critical threshold for ${key} must be a positive number`
  }

  if (conf.direction === 'below' || key === 'powerFactor') {
    if (w > 1.0 || c > 1.0) {
      return 'Power Factor thresholds cannot exceed 1.00'
    }
    if (c >= w) {
      return `For low-limit metrics (Power Factor), critical limit (${c}) must be strictly less than warning limit (${w})`
    }
  } else {
    if (c <= w) {
      return `For ${key}, critical threshold (${c}) must be strictly greater than warning threshold (${w})`
    }
  }

  return null
}
