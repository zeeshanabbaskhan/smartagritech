/** Realistic ranges for energy-monitor variables (shared by seeder + device simulator). */

const READING_RANGES = {
  VoltageA:         [218, 242],
  VoltageB:         [217, 241],
  VoltageC:         [219, 243],
  CurrentA:         [1,   45],
  CurrentB:         [1,   45],
  CurrentC:         [1,   45],
  ActivePower:      [0.5, 9.5],
  ReactivePower:    [0.1, 4.5],
  ApparentPower:    [0.6, 11],
  PowerConsumption: [5,   80],
  ExportPower:      [0,   15],
  PowerFactor:      [0.72, 0.99],
  Frequency:        [49.5, 50.5],
  VoltageImbalance: [0,   4.5],
  CurrentImbalance: [0,   9],
  THD_V:            [0,   4.8],
  THD_I:            [0,   14],
  TotalCost:        [10,  500],
}

const VARIABLE_UNITS = {
  VoltageA: 'V', VoltageB: 'V', VoltageC: 'V',
  CurrentA: 'A', CurrentB: 'A', CurrentC: 'A',
  ActivePower: 'kW', ReactivePower: 'kVar', ApparentPower: 'kVA',
  PowerConsumption: 'kWh', ExportPower: 'kWh',
  PowerFactor: 'ratio', Frequency: 'Hz',
  VoltageImbalance: '%', CurrentImbalance: '%',
  THD_V: '%', THD_I: '%', TotalCost: 'PKR',
}

const CUMULATIVE_VARS = new Set(['PowerConsumption', 'ExportPower', 'TotalCost'])

const rand = (min, max, dp = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(dp))

const initValue = (name, range) => {
  const [min, max] = range
  if (CUMULATIVE_VARS.has(name)) return rand(min, min + (max - min) * 0.3)
  return rand(min, max)
}

const nextValue = (name, current, range) => {
  const [min, max] = range
  if (CUMULATIVE_VARS.has(name)) {
    const step = name === 'TotalCost' ? rand(0.5, 3) : rand(0.02, 0.2)
    return parseFloat(Math.min(max, current + step).toFixed(2))
  }
  const band = (max - min) * 0.04
  const next = current + (Math.random() - 0.5) * band
  return parseFloat(Math.max(min, Math.min(max, next)).toFixed(2))
}

module.exports = { READING_RANGES, VARIABLE_UNITS, CUMULATIVE_VARS, rand, initValue, nextValue }
