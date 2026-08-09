/**
 * Wide "DeviceData" CSV layout (CF-style): one row per timestamp reading,
 * metrics as columns — not long/tidy variableName|value|unit|timestamp rows.
 */

const PREFERRED_METRIC_COLUMNS = [
  'Voltage A',
  'Voltage B',
  'Voltage C',
  'Current A',
  'Current B',
  'Current C',
  'Operating',
  'Power Factor',
  'Frequency',
  'Units',
  'Temperature',
]

/** Canonical column → accepted raw variableName aliases (normalized match). */
const COLUMN_ALIASES = {
  'Voltage A': ['voltagea', 'voltage_a', 'voltage a', 'va', 'phasevoltagea', 'phase_voltage_a', 'vab'],
  'Voltage B': ['voltageb', 'voltage_b', 'voltage b', 'vb', 'phasevoltageb', 'phase_voltage_b', 'vbc'],
  'Voltage C': ['voltagec', 'voltage_c', 'voltage c', 'vc', 'phasevoltagec', 'phase_voltage_c', 'vca'],
  'Current A': ['currenta', 'current_a', 'current a', 'ia', 'phasecurrenta'],
  'Current B': ['currentb', 'current_b', 'current b', 'ib', 'phasecurrentb'],
  'Current C': ['currentc', 'current_c', 'current c', 'ic', 'phasecurrentc'],
  Operating: ['operating', 'activepower', 'active_power', 'operatingpower', 'operating_power', 'power'],
  'Power Factor': ['powerfactor', 'power_factor', 'power factor', 'pf'],
  Frequency: ['frequency', 'freq', 'hz'],
  Units: [
    'units', 'powerconsumption', 'power_consumption', 'energy', 'totalenergy',
    'importenergy', 'activeenergy', 'energyimport', 'kwh',
  ],
  Temperature: ['temperature', 'temp', 'tempc'],
}

const IDENTITY_COLUMNS = ['Device Name', 'Slave Name', 'Received Time']

function normalizeVarName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

const ALIAS_TO_COLUMN = (() => {
  const map = new Map()
  for (const [col, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const a of aliases) map.set(normalizeVarName(a), col)
  }
  // Also map the display column itself
  for (const col of PREFERRED_METRIC_COLUMNS) {
    map.set(normalizeVarName(col), col)
  }
  return map
})()

function mapVariableToColumn(variableName) {
  if (!variableName) return null
  return ALIAS_TO_COLUMN.get(normalizeVarName(variableName)) || null
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** DD-MM-YYYY or DD-MM-YYYY HH:mm:ss (always include time for readings). */
function formatReceivedTime(ts) {
  const d = ts instanceof Date ? ts : new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const date = `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  return `${date} ${time}`
}

function deviceDataFilename(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const stamp = [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate()),
    pad2(d.getHours()),
    pad2(d.getMinutes()),
    pad2(d.getSeconds()),
  ].join('')
  return `DeviceData_${stamp}.csv`
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csvLine(values) {
  return values.map(csvEscape).join(',')
}

/**
 * Pivot one SensorReading row (readings JSON array) into a wide values map.
 * @returns {{ metrics: Record<string, string|number>, extras: Record<string, string|number> }}
 */
function pivotReadingsArray(readings) {
  const metrics = {}
  const extras = {}
  const arr = Array.isArray(readings) ? readings : []
  for (const entry of arr) {
    const name = entry?.variableName ?? entry?.name
    if (!name) continue
    const col = mapVariableToColumn(name)
    const val = entry.value
    if (col) {
      if (metrics[col] === undefined || metrics[col] === '') metrics[col] = val
    } else {
      const key = String(name)
      if (extras[key] === undefined || extras[key] === '') extras[key] = val
    }
  }
  return { metrics, extras }
}

/**
 * Build header + data lines for wide DeviceData CSV.
 * Includes preferred metric columns that appear in data; appends unmapped vars.
 */
function buildDeviceDataCsv({
  rows,
  deviceName = '',
  slaveNameFallback = '',
  includeEmptyPreferred = false,
}) {
  const wideRows = []
  const usedPreferred = new Set()
  const extraKeys = new Set()

  for (const row of rows) {
    const { metrics, extras } = pivotReadingsArray(row.readings)
    for (const k of Object.keys(metrics)) {
      if (metrics[k] !== undefined && metrics[k] !== '') usedPreferred.add(k)
    }
    for (const k of Object.keys(extras)) {
      if (extras[k] !== undefined && extras[k] !== '') extraKeys.add(k)
    }
    wideRows.push({
      deviceName: row.deviceName ?? deviceName ?? '',
      slaveName: row.slaveName ?? slaveNameFallback ?? '',
      receivedTime: formatReceivedTime(row.timestamp),
      metrics,
      extras,
    })
  }

  const metricCols = includeEmptyPreferred
    ? [...PREFERRED_METRIC_COLUMNS]
    : PREFERRED_METRIC_COLUMNS.filter((c) => usedPreferred.has(c))
  const extraCols = [...extraKeys].sort()
  const header = [...IDENTITY_COLUMNS, ...metricCols, ...extraCols]

  const lines = [csvLine(header)]
  for (const r of wideRows) {
    const values = [
      r.deviceName,
      r.slaveName,
      r.receivedTime,
      ...metricCols.map((c) => (r.metrics[c] ?? '')),
      ...extraCols.map((c) => (r.extras[c] ?? '')),
    ]
    lines.push(csvLine(values))
  }
  return { header, csv: lines.join('\n'), filename: deviceDataFilename() }
}

module.exports = {
  PREFERRED_METRIC_COLUMNS,
  IDENTITY_COLUMNS,
  mapVariableToColumn,
  formatReceivedTime,
  deviceDataFilename,
  csvEscape,
  csvLine,
  pivotReadingsArray,
  buildDeviceDataCsv,
}
