/**
 * Wide "DeviceData" CSV layout (CF-style): one row per timestamp,
 * metrics as columns — not long/tidy variableName|value|unit|timestamp.
 */
import { downloadCsv } from './csv'

export const PREFERRED_METRIC_COLUMNS = [
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

export const IDENTITY_COLUMNS = ['Device Name', 'Slave Name', 'Received Time']

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
  for (const col of PREFERRED_METRIC_COLUMNS) {
    map.set(normalizeVarName(col), col)
  }
  return map
})()

export function mapVariableToColumn(variableName) {
  if (!variableName) return null
  return ALIAS_TO_COLUMN.get(normalizeVarName(variableName)) || null
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** DD-MM-YYYY HH:mm:ss */
export function formatReceivedTime(ts) {
  const d = ts instanceof Date ? ts : new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts || '')
  const date = `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  return `${date} ${time}`
}

export function deviceDataFilename(date = new Date()) {
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

export function pivotReadingsArray(readings) {
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
 * Pivot long rows { variableName, value, timestamp } into wide DeviceData rows.
 */
export function pivotLongRowsToWide(longRows, { deviceName = '', slaveName = '' } = {}) {
  const byTs = new Map()
  for (const r of longRows || []) {
    const ts = r.timestamp ?? r.receivedTime ?? r.time
    const key = `${ts}||${r.slaveName ?? slaveName}`
    if (!byTs.has(key)) {
      byTs.set(key, {
        deviceName: r.deviceName ?? deviceName,
        slaveName: r.slaveName ?? slaveName,
        timestamp: ts,
        readings: [],
      })
    }
    byTs.get(key).readings.push({
      variableName: r.variableName ?? r.variable ?? r.name,
      value: r.value,
    })
  }
  return [...byTs.values()]
}

/**
 * Build wide header + row arrays and trigger CSV download.
 * @param {Array<{ deviceName?, slaveName?, timestamp, readings?: array } | { metrics, extras, ... }>} rows
 */
export function downloadDeviceDataCsv(rows, {
  deviceName = '',
  slaveName = '',
} = {}) {
  const wideRows = []
  const usedPreferred = new Set()
  const extraKeys = new Set()

  for (const row of rows || []) {
    let metrics = row.metrics
    let extras = row.extras
    if (!metrics) {
      const pivoted = pivotReadingsArray(row.readings)
      metrics = pivoted.metrics
      extras = pivoted.extras
    }
    for (const [k, v] of Object.entries(metrics || {})) {
      if (v !== undefined && v !== '') usedPreferred.add(k)
    }
    for (const [k, v] of Object.entries(extras || {})) {
      if (v !== undefined && v !== '') extraKeys.add(k)
    }
    wideRows.push({
      deviceName: row.deviceName ?? deviceName,
      slaveName: row.slaveName ?? slaveName,
      receivedTime: row.receivedTime ?? formatReceivedTime(row.timestamp),
      metrics: metrics || {},
      extras: extras || {},
    })
  }

  const metricCols = PREFERRED_METRIC_COLUMNS.filter((c) => usedPreferred.has(c))
  const extraCols = [...extraKeys].sort()
  const header = [...IDENTITY_COLUMNS, ...metricCols, ...extraCols]
  const dataRows = wideRows.map((r) => [
    r.deviceName,
    r.slaveName,
    r.receivedTime,
    ...metricCols.map((c) => r.metrics[c] ?? ''),
    ...extraCols.map((c) => r.extras[c] ?? ''),
  ])

  const filename = deviceDataFilename()
  downloadCsv(filename, header, dataRows)
  return { filename, header, rowCount: dataRows.length }
}
