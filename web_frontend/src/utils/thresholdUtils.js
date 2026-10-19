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
  { key: 'currentA', label: 'Phase Current A', unit: 'A', defaultDirection: 'above', min: 0, max: 10000 },
  { key: 'currentB', label: 'Phase Current B', unit: 'A', defaultDirection: 'above', min: 0, max: 10000 },
  { key: 'currentC', label: 'Phase Current C', unit: 'A', defaultDirection: 'above', min: 0, max: 10000 },
  { key: 'powerFactor', label: 'Power Factor', unit: '', defaultDirection: 'below', min: 0, max: 1.0 },
]

export const DEFAULT_EXECUTIVE_LIMITS = {
  version: 1,
  thresholds: {
    totalLoad: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    solarPower: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    generatorPower: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    gridPower: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'kW' },
    currentA: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'A' },
    currentB: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'A' },
    currentC: { enabled: false, direction: 'above', warningValue: '', criticalValue: '', unit: 'A' },
    powerFactor: { enabled: false, direction: 'below', warningValue: '', criticalValue: '', unit: '' },
  },
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
