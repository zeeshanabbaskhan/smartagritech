// Live values from Redis hash device:{id}:latest (keyed by config variable names).

const ALIASES = {
  power:       ['Total Power', 'TotalPower', 'ActivePower', 'TotalActivePower', 'Active Power', 'Total Active Power', 'ActivePowerTotal', 'Power', 'Total kW', 'kW', 'PowerConsumption'],
  current:     ['Current A', 'Current B', 'Current C', 'CurrentA', 'CurrentB', 'CurrentC', 'Ia', 'Current', 'TotalCurrent', 'CurrentTotal', 'AverageCurrent', 'Total Current'],
  currentA:    ['Current A', 'CurrentA', 'Current_A', 'Ia', 'Phase Current A', 'PhaseCurrentA', 'Phase CurrentA', 'Current 1', 'Current1', 'I1'],
  currentB:    ['Current B', 'CurrentB', 'Current_B', 'Ib', 'Phase Current B', 'PhaseCurrentB', 'Phase CurrentB', 'Current 2', 'Current2', 'I2'],
  currentC:    ['Current C', 'CurrentC', 'Current_C', 'Ic', 'Phase Current C', 'PhaseCurrentC', 'Phase CurrentC', 'Current 3', 'Current3', 'I3'],
  voltage:     ['Voltage', 'VoltageA', 'VoltageB', 'VoltageC', 'Voltage A', 'Voltage B', 'Voltage C', 'Va', 'AverageVoltage', 'VoltageAvg', 'Vab'],
  pf:          ['Power Factor', 'PowerFactor', 'PF', 'pf', 'AveragePowerFactor', 'TotalPowerFactor'],
  consumption: ['Units', 'EnergyConsumption', 'ActiveEnergy', 'PowerConsumption', 'kWh', 'TotalEnergy', 'Energy'],
}

const UNIT_HINTS = [
  [/voltage|volt|\bv\b/i, 'V'],
  [/current|\ba\b|amp/i, 'A'],
  [/powerfactor|\bpf\b/i, ''],
  [/frequency|\bhz\b/i, 'Hz'],
  [/energy|kwh|consumption/i, 'kWh'],
  [/power|kw(?!h)/i, 'kW'],
  [/temp/i, '°C'],
  [/moist/i, '%'],
  [/battery/i, '%'],
]

/**
 * Normalize instantaneous power readings to kW.
 * Ingest formulas already scale ActivePower (=s/1000); do not divide again.
 */
export function powerReadingToKw(variableName, value, unit = '') {
  const n = Number(value)
  if (!Number.isFinite(n)) return NaN
  const u = String(unit || '').toLowerCase().trim()
  if (u === 'kw' || u === 'kilowatt') return Math.abs(n)
  if (u === 'w' || u === 'watt' || u === 'watts') return Math.abs(n) / 1000
  const nm = String(variableName || '')
  if (/powerconsumption/i.test(nm) && !/active/i.test(nm)) return Math.abs(n)
  if (/activepower|^power$|totalactivepower|exportpower|solarpower|total power|totalpower|active power/i.test(nm)) {
    // If raw value is >= 2500, it is in Watts (e.g. 55000 W = 55 kW, 132000 W = 132 kW, 340000 W = 340 kW)
    if (Math.abs(n) >= 2500) return Math.abs(n) / 1000
    return Math.abs(n)
  }
  if (Math.abs(n) >= 2500) return Math.abs(n) / 1000
  return Math.abs(n)
}

/** Best-effort unit label from variable name. */
export function unitForVariable(name) {
  const n = String(name || '')
  for (const [re, unit] of UNIT_HINTS) {
    if (re.test(n)) return unit
  }
  return ''
}

const isOffline = (d) => d.status === 'Offline' || d.status === 'OFFLINE' || d.status === 'offline'

/** True when remote switch is OFF — live telemetry must be hidden. */
export const isSwitchOff = (d) => {
  if (!d) return false
  if (d.switchOn === false) return true
  const s = String(d.switchState || '').toUpperCase()
  return s === 'OFF'
}

/** Device contributes live KPIs only when switch is ON and status is Online. */
export const isTelemetryActive = (d) => !isSwitchOff(d) && !isOffline(d)

function parseMetricRaw(raw) {
  if (raw == null || raw === '') return NaN
  if (typeof raw === 'object' && raw !== null) {
    if (raw.displayValue != null && raw.displayValue !== '') {
      const d = parseFloat(raw.displayValue)
      if (Number.isFinite(d)) return d
    }
    if ('value' in raw) {
      return parseFloat(raw.value)
    }
  }
  return parseFloat(raw)
}

/** All device variables (live + configured), sorted by name. */
export function listDeviceMetricEntries(device, { limit = 24, includeEmpty = true } = {}) {
  if (isSwitchOff(device)) return []
  const metrics = device?.latestMetrics
  if (!metrics || typeof metrics !== 'object') return []
  const entries = []
  for (const [name, raw] of Object.entries(metrics)) {
    if (!name || name.startsWith('_')) continue
    const value = parseMetricRaw(raw)
    if (!includeEmpty && !Number.isFinite(value)) continue
    const unitFromMeta = raw && typeof raw === 'object' ? (raw.unit || '') : ''
    const displayLabel = raw && typeof raw === 'object' ? (raw.displayName || '') : ''
    entries.push({
      name,
      label: displayLabel || name,
      value: Number.isFinite(value) ? value : NaN,
      unit: unitFromMeta || unitForVariable(name),
    })
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  return limit > 0 ? entries.slice(0, limit) : entries
}

/** Return a numeric metric value from a device, or NaN if unavailable. */
export function readDeviceMetric(device, type) {
  if (isSwitchOff(device)) return NaN
  const metrics = device?.latestMetrics
  if (!metrics || typeof metrics !== 'object') return NaN

  const finish = (name, raw) => {
    const n = parseMetricRaw(raw)
    if (!Number.isFinite(n)) return NaN
    const unit = raw && typeof raw === 'object' ? (raw.unit || '') : ''
    // Alias 'power' and ActivePower* readings → kW for org KPIs / charts
    if (type === 'power' || (/activepower|totalactivepower|total power|totalpower/i.test(String(type)) && /activepower|totalactivepower|total power|totalpower/i.test(String(name)))) {
      return powerReadingToKw(name, n, unit)
    }
    return n
  }

  // 1. Direct variable name (exact match)
  if (metrics[type] != null && metrics[type] !== '') {
    const n = finish(type, metrics[type])
    if (Number.isFinite(n)) return n
  }

  // 2. Direct normalized match (case-insensitive, ignoring spaces and underscores)
  const normType = String(type || '').toLowerCase().replace(/[\s_\-]/g, '')
  for (const [k, v] of Object.entries(metrics)) {
    if (k.toLowerCase().replace(/[\s_\-]/g, '') === normType) {
      const n = finish(k, v)
      if (Number.isFinite(n)) return n
    }
  }

  // 3. Known aliases lookup
  const keys = ALIASES[type] ?? []
  for (const key of keys) {
    if (metrics[key] != null && metrics[key] !== '') {
      const n = finish(key, metrics[key])
      if (Number.isFinite(n) && n > 0) return n
    }
    const normKey = String(key).toLowerCase().replace(/[\s_\-]/g, '')
    for (const [k, v] of Object.entries(metrics)) {
      if (k.toLowerCase().replace(/[\s_\-]/g, '') === normKey) {
        const n = finish(k, v)
        if (Number.isFinite(n) && n > 0) return n
      }
    }
  }

  // 4. 3-Phase summation fallback for meters split into phase powers
  if (type === 'power' || normType === 'power' || normType === 'activepower' || normType === 'totalpower') {
    const pA = parseMetricRaw(metrics['PowerA'] ?? metrics['Power A'] ?? metrics['Power_A'] ?? metrics['P1'])
    const pB = parseMetricRaw(metrics['PowerB'] ?? metrics['Power B'] ?? metrics['Power_B'] ?? metrics['P2'])
    const pC = parseMetricRaw(metrics['PowerC'] ?? metrics['Power C'] ?? metrics['Power_C'] ?? metrics['P3'])
    if (Number.isFinite(pA) || Number.isFinite(pB) || Number.isFinite(pC)) {
      const sum = (Number.isFinite(pA) ? Math.abs(pA) : 0) + (Number.isFinite(pB) ? Math.abs(pB) : 0) + (Number.isFinite(pC) ? Math.abs(pC) : 0)
      if (sum > 0) return +sum.toFixed(2)
    }
  }

  // 5. First non-zero/valid alias if available
  for (const key of keys) {
    const n = finish(key, metrics[key])
    if (Number.isFinite(n)) return n
  }

  return NaN
}

/** Formatted display string for a metric ('—' when unavailable). */
export function formatDeviceMetric(device, type, { offline = false } = {}) {
  if (isSwitchOff(device)) return type === 'status' ? 'Offline' : '—'
  if (offline && type === 'status') return 'Offline'
  const n = readDeviceMetric(device, type)
  if (!Number.isFinite(n)) return '—'
  if (/powerfactor|\bpf\b/i.test(String(type))) return n.toFixed(2)
  return Math.abs(n) >= 1000 ? n.toFixed(0) : n.toFixed(1)
}

const PRIMARY_KPI_PREFERENCE = [
  'Total Power',
  'TotalPower',
  'ActivePower',
  'TotalActivePower',
  'PowerConsumption',
  'Power',
  'Active Power',
  'Current A',
  'Current B',
  'Current C',
  'CurrentA',
  'CurrentB',
  'CurrentC',
  'Phase Current A',
  'Phase Current B',
  'Phase Current C',
  'Current',
  'TotalCurrent',
  'Voltage A',
  'Voltage B',
  'Voltage C',
  'VoltageA',
  'VoltageB',
  'VoltageC',
  'Voltage',
  'Power Factor',
  'PowerFactor',
  'Frequency',
]

export function formatCardLabel(name) {
  const norm = String(name || '').toLowerCase().replace(/[\s_\-]/g, '')
  if (norm === 'currenta' || norm === 'phasecurrenta' || norm === 'ia') return 'Current A'
  if (norm === 'currentb' || norm === 'phasecurrentb' || norm === 'ib') return 'Current B'
  if (norm === 'currentc' || norm === 'phasecurrentc' || norm === 'ic') return 'Current C'
  if (norm === 'totalpower' || norm === 'activepower' || norm === 'totalactivepower' || norm === 'power') return 'Total Power'
  if (norm === 'voltagea' || norm === 'phasevoltagea' || norm === 'va') return 'Voltage A'
  if (norm === 'voltageb' || norm === 'phasevoltageb' || norm === 'vb') return 'Voltage B'
  if (norm === 'voltagec' || norm === 'phasevoltagec' || norm === 'vc') return 'Voltage C'
  if (norm === 'powerfactor' || norm === 'pf') return 'Power Factor'
  return name
}

/** Supply-side meters (never consumer loads) matched by name. */
const SOURCE_NAME_RE = /wapda|grid|solar|generator|gen\b|^g[0-9]|invt/i

/**
 * True when a node actually reports live telemetry. Slaves configured on a
 * gateway but never reporting (spare breakers, decommissioned feeders) carry no
 * live metrics; they contribute nothing to the phase-current sums, so counting
 * them would overstate the "N load slaves" subtitle.
 */
function hasLiveMetrics(node) {
  const metrics = node?.latestMetrics
  if (!metrics || typeof metrics !== 'object') return false
  for (const [name, raw] of Object.entries(metrics)) {
    if (!name || name.startsWith('_')) continue
    if (Number.isFinite(parseMetricRaw(raw))) return true
  }
  return false
}

/**
 * Fingerprint of a slave's three-phase current + power readings, or null when
 * every one of them is absent or zero.
 *
 * The API falls back to the device-level Redis hash for slaves that have no hash
 * of their own, so a non-reporting slave is served a verbatim copy of whichever
 * sibling wrote the device key last. Two real feeders on one gateway cannot
 * report identical three-phase currents to the milliamp, so a repeated non-zero
 * fingerprint identifies such a phantom and it must not be counted or summed.
 */
function phaseFingerprint(node) {
  const vals = ['Current A', 'Current B', 'Current C', 'Total Power']
    .map((t) => readDeviceMetric(node, t))
  if (!vals.some((v) => Number.isFinite(v) && v !== 0)) return null
  return vals.map((v) => (Number.isFinite(v) ? v.toFixed(3) : 'x')).join('/')
}

/** True for the per-phase current variables that must be summed across load slaves. */
export function isPhaseCurrentVariable(name) {
  const n = String(name || '').toLowerCase().replace(/[\s_\-]/g, '')
  return n === 'currenta' || n === 'currentb' || n === 'currentc'
    || n === 'phasecurrenta' || n === 'phasecurrentb' || n === 'phasecurrentc'
    || n === 'ia' || n === 'ib' || n === 'ic'
}

/** True when node matches configured source slave IDs or supply-meter regex. */
export function isSourceNode(node, sourceSlaveIds = null) {
  if (!node) return false
  if (sourceSlaveIds) {
    const idStr = String(node.id ?? '')
    if (sourceSlaveIds instanceof Set) {
      if (sourceSlaveIds.has(idStr)) return true
    } else if (Array.isArray(sourceSlaveIds)) {
      if (sourceSlaveIds.includes(idStr)) return true
    }
  }
  return SOURCE_NAME_RE.test(String(node.name || ''))
}

/**
 * Every individual online consumer-load slave across the given devices.
 * Slaves linked to a Sources group (WAPDA / Solar / Generator) — either by id
 * via `sourceSlaveIds` or by name — are excluded so phase currents sum the
 * downstream loads only. Slaves that report no live telemetry are skipped as
 * well, so the count always matches the set of readings actually summed.
 * A device with no separate slaves counts as one load.
 */
export function collectLoadSlaves(devices = [], { sourceSlaveIds = null } = {}) {
  const loads = []
  for (const d of devices) {
    if (!isTelemetryActive(d)) continue
    const slaves = d.slaves || d.configSlaves || []
    if (slaves.length) {
      // Fingerprints are per device: the phantom always mirrors a sibling slave.
      const seen = new Set()
      for (const s of slaves) {
        if (!isTelemetryActive(s)) continue
        if (isSourceNode(s, sourceSlaveIds)) continue
        if (!hasLiveMetrics(s)) continue
        const fp = phaseFingerprint(s)
        if (fp) {
          if (seen.has(fp)) continue
          seen.add(fp)
        }
        loads.push(s)
      }
    } else if (!isSourceNode(d, sourceSlaveIds) && hasLiveMetrics(d)) {
      loads.push(d)
    }
  }
  return loads
}

/**
 * Every individual online source slave across the given devices.
 * Slaves linked to a Sources group (WAPDA / Solar / Generator) — either by id
 * via `sourceSlaveIds` or by name.
 */
export function collectSourceSlaves(devices = [], { sourceSlaveIds = null } = {}) {
  const sources = []
  for (const d of devices) {
    if (!isTelemetryActive(d)) continue
    const slaves = d.slaves || d.configSlaves || []
    if (slaves.length) {
      const seen = new Set()
      for (const s of slaves) {
        if (!isTelemetryActive(s)) continue
        if (!isSourceNode(s, sourceSlaveIds)) continue
        if (!hasLiveMetrics(s)) continue
        const fp = phaseFingerprint(s)
        if (fp) {
          if (seen.has(fp)) continue
          seen.add(fp)
        }
        sources.push(s)
      }
    } else if (isSourceNode(d, sourceSlaveIds) && hasLiveMetrics(d)) {
      sources.push(d)
    }
  }
  return sources
}

/** Active source slaves on a specific device */
export function getDeviceSourceSlaves(device, { sourceSlaveIds = null } = {}) {
  if (!device || !isTelemetryActive(device)) return []
  const slaves = device.slaves || device.configSlaves || []
  if (!slaves.length) {
    return isSourceNode(device, sourceSlaveIds) && hasLiveMetrics(device) ? [device] : []
  }
  const seen = new Set()
  const result = []
  for (const s of slaves) {
    if (!isTelemetryActive(s)) continue
    if (!isSourceNode(s, sourceSlaveIds)) continue
    if (!hasLiveMetrics(s)) continue
    const fp = phaseFingerprint(s)
    if (fp) {
      if (seen.has(fp)) continue
      seen.add(fp)
    }
    result.push(s)
  }
  return result
}

/** Active load slaves on a specific device */
export function getDeviceLoadSlaves(device, { sourceSlaveIds = null } = {}) {
  if (!device || !isTelemetryActive(device)) return []
  const slaves = device.slaves || device.configSlaves || []
  if (!slaves.length) {
    return !isSourceNode(device, sourceSlaveIds) && hasLiveMetrics(device) ? [device] : []
  }
  const seen = new Set()
  const result = []
  for (const s of slaves) {
    if (!isTelemetryActive(s)) continue
    if (isSourceNode(s, sourceSlaveIds)) continue
    if (!hasLiveMetrics(s)) continue
    const fp = phaseFingerprint(s)
    if (fp) {
      if (seen.has(fp)) continue
      seen.add(fp)
    }
    result.push(s)
  }
  return result
}

/** Sum metric across only the source slaves of a device */
export function getDeviceSourceMetric(device, metric = 'power', { sourceSlaveIds = null } = {}) {
  const sources = getDeviceSourceSlaves(device, { sourceSlaveIds })
  if (!sources.length) return 0
  const vals = sources.map((s) => readDeviceMetric(s, metric)).filter(Number.isFinite)
  return +vals.reduce((sum, v) => sum + v, 0).toFixed(2)
}

/** Sum metric across only the load slaves of a device */
export function getDeviceLoadMetric(device, metric, { sourceSlaveIds = null } = {}) {
  const loads = getDeviceLoadSlaves(device, { sourceSlaveIds })
  if (!loads.length) return 0
  const vals = loads.map((s) => readDeviceMetric(s, metric)).filter(Number.isFinite)
  return +vals.reduce((sum, v) => sum + v, 0).toFixed(2)
}

/**
 * Fleet KPIs from real shared variable names across online devices.
 * Uses deterministic electrical ordering (Power -> Current A -> Current B -> Current C)
 * to avoid cards jumping or swapping when new metrics report.
 *
 * Phase-current cards sum every individual online load slave (see
 * collectLoadSlaves); all other cards aggregate per device.
 */
export function computeDynamicKpis(devices = [], { sourceSlaveIds = null } = {}) {
  const online = devices.filter((d) => isTelemetryActive(d))
  const loadSlaves = collectLoadSlaves(online, { sourceSlaveIds })
  const sourceSlaves = collectSourceSlaves(online, { sourceSlaveIds })
  const nameCounts = new Map()
  for (const d of online) {
    for (const { name, value } of listDeviceMetricEntries(d, { limit: 0 })) {
      if (!Number.isFinite(value)) continue
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1)
    }
  }

  const findMatchingKey = (candidates) => {
    // 1. Exact match
    for (const c of candidates) {
      if (nameCounts.has(c)) return c
    }
    // 2. Normalized match against available keys
    for (const c of candidates) {
      const normC = c.toLowerCase().replace(/[\s_\-]/g, '')
      for (const k of nameCounts.keys()) {
        if (k.toLowerCase().replace(/[\s_\-]/g, '') === normC) {
          return k
        }
      }
    }
    return null
  }

  // Deterministically select top 4 KPI names:
  // 1. Preferred power variable
  // 2. Current A
  // 3. Current B
  // 4. Current C
  // Fall back to other available variables if any are missing.
  const chosenNames = []
  const usedKeys = new Set()

  // Slot 1: Power variable
  const powerCandidate = findMatchingKey([
    'Total Power',
    'TotalPower',
    'ActivePower',
    'TotalActivePower',
    'Active Power',
    'Power',
    'PowerConsumption',
  ])
  if (powerCandidate) {
    chosenNames.push(powerCandidate)
    usedKeys.add(powerCandidate)
  }

  // Slot 2: Current A
  const curACandidate = findMatchingKey([
    'Current A',
    'CurrentA',
    'Current_A',
    'Phase Current A',
    'Phase CurrentA',
    'PhaseCurrentA',
    'Ia',
    'Current',
    'TotalCurrent',
  ])
  if (curACandidate && !usedKeys.has(curACandidate)) {
    chosenNames.push(curACandidate)
    usedKeys.add(curACandidate)
  }

  // Slot 3: Current B
  const curBCandidate = findMatchingKey([
    'Current B',
    'CurrentB',
    'Current_B',
    'Phase Current B',
    'Phase CurrentB',
    'PhaseCurrentB',
    'Ib',
  ])
  if (curBCandidate && !usedKeys.has(curBCandidate)) {
    chosenNames.push(curBCandidate)
    usedKeys.add(curBCandidate)
  }

  // Slot 4: Current C
  const curCCandidate = findMatchingKey([
    'Current C',
    'CurrentC',
    'Current_C',
    'Phase Current C',
    'Phase CurrentC',
    'PhaseCurrentC',
    'Ic',
  ])
  if (curCCandidate && !usedKeys.has(curCCandidate)) {
    chosenNames.push(curCCandidate)
    usedKeys.add(curCCandidate)
  }

  // If fewer than 4 chosen, fill remaining from available sorted by PRIMARY_KPI_PREFERENCE then count
  if (chosenNames.length < 4 && nameCounts.size > usedKeys.size) {
    const remaining = [...nameCounts.keys()]
      .filter((k) => !usedKeys.has(k))
      .sort((a, b) => {
        const normA = a.toLowerCase().replace(/[\s_\-]/g, '')
        const normB = b.toLowerCase().replace(/[\s_\-]/g, '')
        const idxA = PRIMARY_KPI_PREFERENCE.findIndex((p) => p.toLowerCase().replace(/[\s_\-]/g, '') === normA)
        const idxB = PRIMARY_KPI_PREFERENCE.findIndex((p) => p.toLowerCase().replace(/[\s_\-]/g, '') === normB)
        if (idxA >= 0 && idxB >= 0) return idxA - idxB
        if (idxA >= 0) return -1
        if (idxB >= 0) return 1
        const countDiff = (nameCounts.get(b) || 0) - (nameCounts.get(a) || 0)
        if (countDiff !== 0) return countDiff
        return a.localeCompare(b)
      })
    for (const r of remaining) {
      if (chosenNames.length >= 4) break
      chosenNames.push(r)
      usedKeys.add(r)
    }
  }

  if (chosenNames.length) {
    const cards = chosenNames.map((name) => {
      // Power card: sum only the supply source slaves (WAPDA + Solar + Generator)
      if (name === powerCandidate || /total power|totalpower|activepower|totalactivepower/i.test(name)) {
        if (sourceSlaves.length > 0) {
          const pVals = sourceSlaves
            .map((s) => readDeviceMetric(s, 'power'))
            .filter(Number.isFinite)
          const pSum = pVals.reduce((s, v) => s + v, 0)
          return {
            key: name,
            label: formatCardLabel(name),
            metric: name,
            unit: unitForVariable(name) || 'kW',
            value: +pSum.toFixed(2),
            agg: 'Sum',
            sub: 'Sum · All Power Sources',
            gaugeMax: pSum > 0 ? pSum * 1.2 : 100,
          }
        }
      }

      // Phase currents: true sum across every individual online load slave.
      if (isPhaseCurrentVariable(name)) {
        const curVals = loadSlaves
          .map((s) => readDeviceMetric(s, name))
          .filter(Number.isFinite)
        const curSum = curVals.reduce((s, v) => s + v, 0)
        return {
          key: name,
          label: formatCardLabel(name),
          metric: name,
          unit: unitForVariable(name),
          value: curSum,
          agg: 'Sum',
          sub: `Sum · ${loadSlaves.length} load slaves`,
          gaugeMax: curSum > 0 ? curSum * 1.2 : 100,
        }
      }
      const vals = online
        .map((d) => readDeviceMetric(d, name))
        .filter(Number.isFinite)
      const sum = vals.reduce((s, v) => s + v, 0)
      const mean = vals.length ? sum / vals.length : NaN
      const useMean = /voltage|pf|powerfactor|frequency|temp|moist|battery/i.test(name)
      return {
        key: name,
        label: formatCardLabel(name),
        metric: name,
        unit: unitForVariable(name),
        value: useMean ? mean : sum,
        agg: useMean ? 'Mean' : 'Sum',
        gaugeMax: useMean ? (mean > 0 ? mean * 1.4 : 1) : (sum > 0 ? sum * 1.2 : 100),
      }
    })
    return { cards, onlineCount: online.length, loadSlavesCount: loadSlaves.length, sourceSlavesCount: sourceSlaves.length, dynamic: true }
  }

  // Compat: no live metrics yet — classic EMS-shaped KPIs
  const nums = (type) => online.map((d) => readDeviceMetric(d, type)).filter(Number.isFinite)
  const sum = (type) => nums(type).reduce((s, v) => s + v, 0)
  const slaveNums = (type) => loadSlaves.map((s) => readDeviceMetric(s, type)).filter(Number.isFinite)
  const currentCard = (key, label, type) => {
    const vals = slaveNums(type)
    return {
      key,
      label,
      metric: type,
      unit: 'A',
      value: vals.reduce((s, v) => s + v, 0),
      agg: 'Sum',
      sub: `Sum · ${loadSlaves.length} load slaves`,
      gaugeMax: 80,
    }
  }
  const sourcePowerSum = sourceSlaves.length > 0
    ? sourceSlaves.reduce((s, sl) => s + (readDeviceMetric(sl, 'power') || 0), 0)
    : sum('power')

  return {
    cards: [
      {
        key: 'power',
        label: 'Total Power',
        metric: 'power',
        unit: 'kW',
        value: +sourcePowerSum.toFixed(2),
        agg: 'Sum',
        sub: 'Sum · All Power Sources',
        gaugeMax: 135
      },
      currentCard('currentA', 'Current A', 'currentA'),
      currentCard('currentB', 'Current B', 'currentB'),
      currentCard('currentC', 'Current C', 'currentC'),
    ],
    onlineCount: online.length,
    loadSlavesCount: loadSlaves.length,
    sourceSlavesCount: sourceSlaves.length,
    dynamic: false,
  }
}

/** @deprecated Prefer computeDynamicKpis — kept for older callers */
export function computeKpis(devices = []) {
  const { cards, onlineCount } = computeDynamicKpis(devices)
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c.value]))
  return {
    totalPower: byKey.power ?? byKey.ActivePower ?? NaN,
    totalCurrent: byKey.current ?? byKey.CurrentA ?? NaN,
    avgVoltage: byKey.voltage ?? byKey.VoltageA ?? NaN,
    avgPF: byKey.pf ?? byKey.PowerFactor ?? NaN,
    onlineCount,
    cards,
  }
}

export { isOffline, ALIASES }
