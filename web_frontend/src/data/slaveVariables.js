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
