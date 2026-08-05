/**
 * Smoke tests for formulaEngine (no jest harness in this package).
 * Run: node scripts/test-formula-engine.js
 */
const {
  evaluate,
  applyAcquisitionFormula,
  applyEquationFormula,
} = require('../utils/formulaEngine')

let passed = 0
let failed = 0

const assert = (label, cond) => {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    console.error(`  ✗ ${label}`)
  }
}

const approx = (a, b, eps = 1e-9) => Math.abs(Number(a) - Number(b)) < eps

console.log('formulaEngine smoke tests')

assert('=s/100', approx(applyAcquisitionFormula('=s/100', 2300), 23))
assert('s/100 without =', approx(applyAcquisitionFormula('s/100', 500), 5))
assert('empty formula returns raw', approx(applyAcquisitionFormula('', 42), 42))
assert('s*2+1', approx(applyAcquisitionFormula('s*2+1', 10), 21))
assert('(s+10)/2', approx(applyAcquisitionFormula('(s+10)/2', 10), 10))
assert('unary minus', approx(evaluate('-s+5', { s: 3 }), 2))
assert('equation refs', approx(
  applyEquationFormula('A$$Voltage + A$$Current', (slave, v) => {
    if (slave === 'A' && v === 'Voltage') return 10
    if (slave === 'A' && v === 'Current') return 2.5
    return null
  }),
  12.5
))
assert('equation missing → null', applyEquationFormula('X$$Y', () => null) === null)
assert('division by zero → NaN path falls back', (() => {
  const r = applyAcquisitionFormula('s/0', 5)
  // engine returns NaN from evaluate; applyAcquisitionFormula falls back to raw
  return approx(r, 5)
})())
assert('rejects unknown ident', (() => {
  try { evaluate('foo+1', {}); return false } catch { return true }
})())

const { applyIngestFormulas } = require('../utils/applyIngestFormulas')

console.log('applyIngestFormulas (control formula)')

const mkDirect = (name, { controlFormula, acquisitionFormula } = {}) => ({
  name,
  currentValue: null,
  templateVariable: {
    variableType: 'DIRECT',
    controlFormula: controlFormula || null,
    acquisitionFormula: acquisitionFormula || null,
    templateSlave: { name: 'Slave1' },
  },
  configSlave: { name: 'Slave1' },
})

{
  const out = applyIngestFormulas(
    [mkDirect('Voltage', { controlFormula: '=s/100' })],
    [{ variableName: 'Voltage', value: 2300 }]
  )
  assert('controlFormula =s/100 scales ingest', approx(out[0].value, 23))
}

{
  const out = applyIngestFormulas(
    [mkDirect('Voltage', { acquisitionFormula: '=s/10' })],
    [{ variableName: 'Voltage', value: 230 }]
  )
  assert('acquisitionFormula fallback when control empty', approx(out[0].value, 23))
}

{
  const out = applyIngestFormulas(
    [mkDirect('Voltage', { controlFormula: '=s/100', acquisitionFormula: '=s/10' })],
    [{ variableName: 'Voltage', value: 2300 }]
  )
  assert('controlFormula preferred over acquisition', approx(out[0].value, 23))
}

{
  const vars = [
    mkDirect('Voltage', { controlFormula: '=s/100' }),
    {
      name: 'Sum',
      currentValue: null,
      templateVariable: {
        variableType: 'EQUATION',
        controlFormula: 'Slave1$$Voltage * 2',
        acquisitionFormula: null,
        templateSlave: { name: 'Slave1' },
      },
      configSlave: { name: 'Slave1' },
    },
  ]
  const out = applyIngestFormulas(vars, [{ variableName: 'Voltage', value: 2300 }])
  const sum = out.find((r) => r.variableName === 'Sum')
  assert('equation uses scaled control values', sum && approx(sum.value, 46))
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
