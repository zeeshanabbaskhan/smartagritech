// Portal constants for Device Template → Slaves → Variables UI.

export const REGISTER_FUNCTIONS = [
  '0(Coils Status)',
  '1(Input Status)',
  '3(Holding Register)',
  '4(Input Register)',
]

export const DATA_FORMATS = [
  'Bit', 'Unsigned Word', 'Signed Word', 'Unsigned Long', 'Signed Long',
  'Unsigned Long Long', 'Signed Long Long', 'Float', 'Double', 'ASCII',
]

export const NUMBER_FORMATS = ['Integer', 'Decimal']

export const READ_WRITE_OPTIONS = ['Write&Read', 'Read Only', 'Write Only']

export const PROTOCOL_OPTIONS = ['Modbus RTU', 'Modbus TCP', 'Modbus ASCII']

export const VARIABLE_TYPE_DIRECT = 'Directly collected variables'
export const VARIABLE_TYPE_EQUATION = 'Equation variables'

export function registerDisplayCode(dataFormat) {
  const map = {
    Bit: 'bit',
    'Unsigned Word': 'ushort',
    'Signed Word': 'short',
    'Unsigned Long': 'ulong',
    'Signed Long': 'long',
    'Unsigned Long Long': 'ulonglong',
    'Signed Long Long': 'longlong',
    Float: 'float',
    Double: 'double',
    ASCII: 'ascii',
  }
  return map[dataFormat] || 'ushort'
}

/** Reverse of registerDisplayCode — portal "Value Type" column → dataFormat */
export function dataFormatFromValueType(valueType) {
  if (!valueType) return null
  const key = String(valueType).trim().toLowerCase()
  const map = {
    bit: 'Bit',
    ushort: 'Unsigned Word',
    short: 'Signed Word',
    ulong: 'Unsigned Long',
    long: 'Signed Long',
    ulonglong: 'Unsigned Long Long',
    longlong: 'Signed Long Long',
    float: 'Float',
    double: 'Double',
    ascii: 'ASCII',
  }
  if (map[key]) return map[key]
  // Already a portal dataFormat label?
  if (DATA_FORMATS.includes(valueType.trim())) return valueType.trim()
  return null
}

/**
 * CSV columns: portal table headers first (so portal-exported CSVs import),
 * then formula / register / storage extras needed for a full round-trip.
 */
export const VARIABLE_CSV_HEADERS = [
  'Number',
  'Variable Name',
  'Variable Type',
  'Value Type',
  'Register',
  'Write & Read',
  'Storage Mode',
  'Unit',
  'Acquisition Formula',
  'Control Formula',
  'Data Format',
  'Register Func',
  'Number Format',
  'Identifier',
  'Icon',
  'Main Page Selection',
  'Sort',
  'Default Unit Selection',
  'Decimal Places Padding',
]

function storageModeLabel(v) {
  return [v.storageVariable && 'Variable Storage', v.storageTiming && 'Timing Storage']
    .filter(Boolean)
    .join('-')
}

function parseStorageMode(raw) {
  const s = String(raw || '').toLowerCase()
  if (!s.trim()) return { storageVariable: true, storageTiming: true }
  return {
    storageVariable: s.includes('variable'),
    storageTiming: s.includes('timing'),
  }
}

function parseBool(raw, fallback = false) {
  if (raw == null || String(raw).trim() === '') return fallback
  const s = String(raw).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on', 'checked'].includes(s)) return true
  if (['0', 'false', 'no', 'n', 'off', ''].includes(s)) return false
  return fallback
}

function extractEquationSlaves(formula) {
  if (!formula) return []
  const out = []
  // Tokens like SlaveName$$Variable or "Slave Name"$$Voltage
  const re = /([^$+\-*/()]+?)\$\$/g
  let m
  while ((m = re.exec(String(formula)))) {
    const name = m[1].trim()
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/** Build one CSV data row aligned with VARIABLE_CSV_HEADERS */
export function variableToCsvRow(v) {
  return [
    v.number ?? '',
    v.name ?? '',
    v.variableType ?? VARIABLE_TYPE_DIRECT,
    registerDisplayCode(v.dataFormat),
    v.registerAddress ?? '',
    v.readWrite ?? '',
    storageModeLabel(v),
    v.unit ?? '',
    v.acquisitionFormula ?? '',
    v.controlFormula ?? '',
    v.dataFormat ?? '',
    v.registerFuncCode ?? '',
    v.numberFormat ?? '',
    v.identifier ?? '',
    v.icon ?? '',
    v.mainPageSelection ? 'true' : 'false',
    v.sort ?? '',
    v.defaultUnitSelection ? 'true' : 'false',
    v.decimalPlacesPadding ? 'true' : 'false',
  ]
}

/** RFC-style CSV line parser (handles quoted commas / escaped quotes) */
export function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

/**
 * Exact-alias column lookup (avoids get('unit') matching "Default Unit Selection"
 * or get('register') matching "Register Func").
 */
function csvGet(headerIndex, cols, aliases) {
  for (const alias of aliases) {
    const idx = headerIndex.get(alias)
    if (idx != null) return (cols[idx] || '').trim()
  }
  return ''
}

/**
 * Map a CSV data row → portal UI variable shape (ready for uiVarToApi).
 * Does not invent equation type from controlFormula (=s/100 stays DIRECT).
 */
export function csvRowToUiVar(headers, cols, blank) {
  const headerIndex = new Map()
  headers.forEach((h, i) => {
    const key = String(h || '').trim().toLowerCase()
    if (key && !headerIndex.has(key)) headerIndex.set(key, i)
  })

  const get = (...aliases) => csvGet(headerIndex, cols, aliases.map((a) => a.toLowerCase()))

  const name = get('variable name', 'name')
  if (!name) return null

  const typeRaw = get('variable type', 'type')
  const isEquation = typeRaw.toLowerCase().includes('equation')

  const dataFormatRaw = get('data format')
  const valueTypeRaw = get('value type')
  const dataFormat =
    (dataFormatRaw && DATA_FORMATS.includes(dataFormatRaw) ? dataFormatRaw : null)
    || dataFormatFromValueType(dataFormatRaw)
    || dataFormatFromValueType(valueTypeRaw)
    || blank.dataFormat
    || 'Unsigned Word'

  const readWrite =
    get('write & read', 'readwrite', 'read/write', 'read write')
    || blank.readWrite
    || 'Read Only'

  const storage = parseStorageMode(get('storage mode', 'storage'))
  const controlFormula = get('control formula', 'control')
  const acquisitionFormula = get('acquisition formula', 'acquisition')
  const numberRaw = get('number')
  const sortRaw = get('sort')

  const registerFunc =
    get('register func', 'register func code', 'register function')
    || blank.registerFuncCode
    || REGISTER_FUNCTIONS[0]

  const numberFormat = get('number format') || blank.numberFormat || 'Integer'

  const ui = {
    ...blank,
    name,
    unit: get('unit', 'variable unit'),
    identifier: get('identifier', 'variable identifier'),
    icon: get('icon'),
    variableType: isEquation ? VARIABLE_TYPE_EQUATION : VARIABLE_TYPE_DIRECT,
    registerAddress: get('register', 'register address'),
    registerFuncCode: registerFunc,
    dataFormat,
    numberFormat,
    readWrite,
    acquisitionFormula,
    controlFormula,
    storageVariable: storage.storageVariable,
    storageTiming: storage.storageTiming,
    mainPageSelection: parseBool(get('main page selection', 'main page'), !!blank.mainPageSelection),
    defaultUnitSelection: parseBool(get('default unit selection', 'default unit'), !!blank.defaultUnitSelection),
    decimalPlacesPadding: parseBool(get('decimal places padding', 'decimalplacespadding'), !!blank.decimalPlacesPadding),
    number: numberRaw !== '' && Number.isFinite(Number(numberRaw)) ? Number(numberRaw) : (blank.number || 0),
    sort: sortRaw !== '' ? sortRaw : (numberRaw !== '' ? numberRaw : (blank.sort || '')),
    slaves: isEquation ? extractEquationSlaves(controlFormula) : [],
  }
  return ui
}

/** Map API variable → portal UI shape */
export function apiVarToUi(v) {
  if (!v) return null
  const isEq = v.variableType === 'EQUATION'
  return {
    id: v.id,
    number: v.sortNumber ?? v.sortOrder ?? 0,
    name: v.name || '',
    unit: v.unit || '',
    icon: v.iconLabel || v.icon?.name || '',
    iconId: v.iconId || '',
    identifier: v.identifier || '',
    machineId: v.machineId || '',
    machineControl: v.machineControl || '',
    lineChartColor: v.lineChartColor || '#000000',
    lineChartLimit: v.lineChartLimit || '',
    lowLimitLineChart: v.lowLimitLineChart || '',
    peakTimeStart: v.peakTimeStart || '',
    peakTimeEnd: v.peakTimeEnd || '',
    peakOffTimeStart: v.peakOffTimeStart || '',
    peakOffTimeEnd: v.peakOffTimeEnd || '',
    peakTimeColor: v.peakTimeColor || '#00ff00',
    peakOffTimeColor: v.peakOffTimeColor || '#ff0000',
    variableType: isEq ? VARIABLE_TYPE_EQUATION : VARIABLE_TYPE_DIRECT,
    registerFuncCode: v.registerFuncCode || REGISTER_FUNCTIONS[0],
    registerAddress: v.registerAddress || '',
    dataFormat: v.dataFormat || 'Unsigned Word',
    numberFormat: v.numberFormat || 'Integer',
    decimalPlacesPadding: !!v.decimalPlacesPadding,
    storageVariable: v.storageVariable !== false,
    storageTiming: v.storageTiming !== false,
    readWrite: v.readWrite || 'Read Only',
    acquisitionFormula: v.acquisitionFormula || '',
    controlFormula: v.controlFormula || '',
    mainPageSelection: !!v.mainPageSelection,
    sort: v.sortOrder != null ? String(v.sortOrder) : (v.sortNumber != null ? String(v.sortNumber) : ''),
    defaultUnitSelection: !!v.defaultUnitSelection,
    slaves: Array.isArray(v.equationSlaveIds) ? v.equationSlaveIds : [],
    dataType: v.dataType,
    isActive: v.isActive !== false,
  }
}

/** Map portal UI shape → API body */
export function uiVarToApi(v) {
  const isEq = v.variableType === VARIABLE_TYPE_EQUATION
  return {
    name: v.name,
    displayName: v.name,
    unit: v.unit || null,
    iconLabel: v.icon || null,
    iconId: v.iconId || null,
    identifier: v.identifier || null,
    machineId: v.machineId || null,
    machineControl: v.machineControl || null,
    lineChartColor: v.lineChartColor || null,
    lineChartLimit: v.lineChartLimit || null,
    lowLimitLineChart: v.lowLimitLineChart || null,
    peakTimeStart: v.peakTimeStart || null,
    peakTimeEnd: v.peakTimeEnd || null,
    peakOffTimeStart: v.peakOffTimeStart || null,
    peakOffTimeEnd: v.peakOffTimeEnd || null,
    peakTimeColor: v.peakTimeColor || null,
    peakOffTimeColor: v.peakOffTimeColor || null,
    variableType: isEq ? 'EQUATION' : 'DIRECT',
    registerFuncCode: v.registerFuncCode || null,
    registerAddress: v.registerAddress || null,
    dataFormat: v.dataFormat || null,
    numberFormat: v.numberFormat || null,
    decimalPlacesPadding: !!v.decimalPlacesPadding,
    storageVariable: !!v.storageVariable,
    storageTiming: !!v.storageTiming,
    readWrite: v.readWrite || null,
    acquisitionFormula: v.acquisitionFormula || null,
    controlFormula: v.controlFormula || null,
    mainPageSelection: !!v.mainPageSelection,
    sortNumber: v.number != null && v.number !== '' ? Number(v.number) : null,
    sortOrder: v.sort !== '' && v.sort != null ? Number(v.sort) : (v.number != null ? Number(v.number) : null),
    defaultUnitSelection: !!v.defaultUnitSelection,
    equationSlaveIds: Array.isArray(v.slaves) ? v.slaves : [],
  }
}

/** Format API sync summary for toast */
export function formatSyncToast(sync) {
  if (!sync) return null
  const { devices = 0, slavesAdded = 0, variablesAdded = 0 } = sync
  if (!devices && !slavesAdded && !variablesAdded) return 'Saved (devices already in sync)'
  return `Auto-synced to ${devices} device(s): +${slavesAdded} slaves, +${variablesAdded} variables`
}
