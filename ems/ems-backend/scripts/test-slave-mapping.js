/**
 * Regression tests for MQTT bridge slave-name → config slave mapping (AFL3 / AFL2).
 * Exercises the production mapReadings / SLAVE_ALIASES directly.
 * Run: node scripts/test-slave-mapping.js
 */
const { normalizeSlave, SLAVE_ALIASES, mapReadings } = require('../services/mqttBridgeService')

const makeVariables = () => [
  { name: 'Current A', unit: 'A', templateVariable: { registerAddress: '40089' } },
  { name: 'Phase VoltageA', unit: 'V', templateVariable: { registerAddress: '40077' } },
  { name: 'Units', unit: 'kWh', templateVariable: { registerAddress: '40139' } },
]

const makeSlave = (id, name) => ({
  id,
  name,
  templateSlave: { name },
  configVariables: makeVariables(),
})

const AFL3 = {
  id: 'afl3-device',
  name: 'AFL3',
  configSlaves: [
    makeSlave('3a70e759-535c-4422-a411-05ea5ae6b757', '1F-MAIN DB-FINISHING'),
    makeSlave('84f266fb-2b03-4337-9bf5-9a735e5ad7d7', '2F-MAIN DB-SEWING'),
    makeSlave('74297703-0566-4be8-b28f-865011cf8489', '3F-MAIN DB-SEWING'),
    makeSlave('f6fcaf8d-8ecb-40d1-ac88-e5ebaa066336', 'COMP-132KW'),
    makeSlave('d8b447ec-4f66-407b-bdcc-61860590a421', 'ETP-AFL'),
    makeSlave('139d6c5f-f39c-4ec5-af2b-0532080c18c8', '55KW Comp'),
    makeSlave('0ecda43c-c693-4575-9401-bedbe16c4b8b', 'Spare'),
  ],
}

const AFL2 = {
  id: 'afl2-device',
  name: 'AFL2',
  configSlaves: [
    makeSlave('d6720abf-4da9-4623-99c3-fe32eed08ba5', '1F Back Side DB'),
    makeSlave('d1ba2cce-5de6-471c-855d-cb5a6f37d8d2', 'Air Cooler 2nd Floor'),
  ],
}

// Ambition2 mid-rename: one config still on the old SHall1 name, one on Sewing-1F-AMB
const AMB2_OLD = {
  id: 'amb2-device-old',
  name: 'Ambition2 (old)',
  configSlaves: [
    makeSlave('amb2-shall1', 'SHall1'),
    makeSlave('amb2-sh3', 'Sewing-3F-AMB'),
  ],
}

const AMB2_NEW = {
  id: 'amb2-device-new',
  name: 'Ambition2 (new)',
  configSlaves: [
    makeSlave('amb2-shall1', 'Sewing-1F-AMB'),
    makeSlave('amb2-sh3', 'Sewing-3F-AMB'),
  ],
}

const ID = {
  floor1: '3a70e759-535c-4422-a411-05ea5ae6b757',
  floor2: '84f266fb-2b03-4337-9bf5-9a735e5ad7d7',
  floor3: '74297703-0566-4be8-b28f-865011cf8489',
  comp132: 'f6fcaf8d-8ecb-40d1-ac88-e5ebaa066336',
  etp: 'd8b447ec-4f66-407b-bdcc-61860590a421',
  comp55: '139d6c5f-f39c-4ec5-af2b-0532080c18c8',
  spare: '0ecda43c-c693-4575-9401-bedbe16c4b8b',
  back1f: 'd6720abf-4da9-4623-99c3-fe32eed08ba5',
  cooler2f: 'd1ba2cce-5de6-471c-855d-cb5a6f37d8d2',
  shall1: 'amb2-shall1',
  sh3: 'amb2-sh3',
}

const REGISTERS = { 40089: 12.5, 40077: 231.4, 40139: 98765.4 }
const EXPECTED_VARS = ['Current A', 'Phase VoltageA', 'Units']

let passed = 0
let failed = 0

const expectSlave = (device, slaveName, expectedId) => {
  const label = `${device.name}: '${slaveName}' (norm '${normalizeSlave(slaveName)}') → ${expectedId}`
  const result = mapReadings(device, slaveName, REGISTERS)
  const problems = []
  if (!result) {
    problems.push('no slave matched')
  } else {
    if (result.slaveId !== expectedId) problems.push(`got slaveId ${result.slaveId}`)
    const names = result.readings.map((r) => r.variableName).sort()
    if (names.join('|') !== [...EXPECTED_VARS].sort().join('|')) {
      problems.push(`readings mismatch [${names.join(', ')}]`)
    }
  }
  if (problems.length) {
    failed += 1
    console.error(`  ✗ ${label} — ${problems.join('; ')}`)
  } else {
    passed += 1
    console.log(`  ✓ ${label}`)
  }
}

const expectNull = (device, slaveName) => {
  const label = `${device.name}: '${slaveName}' → null`
  const result = mapReadings(device, slaveName, REGISTERS)
  if (result === null) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    console.error(`  ✗ ${label} — got slaveId ${result.slaveId}`)
  }
}

console.log('MQTT bridge slave mapping regression tests\n')

console.log('a) AFL3 affected gateway names')
expectSlave(AFL3, '1stFloorPR', ID.floor1)
expectSlave(AFL3, '2ndFloor', ID.floor2)
expectSlave(AFL3, '3rdFloor', ID.floor3)

console.log('\nb) Existing keys and variants')
expectSlave(AFL3, '1stfloorpr', ID.floor1)
expectSlave(AFL3, '1st floor pr', ID.floor1)
expectSlave(AFL3, '2ndfloor', ID.floor2)
expectSlave(AFL3, '2nd floor', ID.floor2)
expectSlave(AFL3, '3rdfloor', ID.floor3)
expectSlave(AFL3, '3rd floor', ID.floor3)
expectSlave(AFL3, '1f-main db-finishing', ID.floor1)
expectSlave(AFL3, '2f-main db-sewing', ID.floor2)
expectSlave(AFL3, '3f-main db-sewing', ID.floor3)

console.log('\nc) Other AFL3 slaves')
expectSlave(AFL3, '132kwComp', ID.comp132)
expectSlave(AFL3, 'comp-132kw', ID.comp132)
expectSlave(AFL3, 'etpdryer', ID.etp)
expectSlave(AFL3, 'etp-afl', ID.etp)
expectSlave(AFL3, '55kwcomp', ID.comp55)
expectSlave(AFL3, '55kw comp', ID.comp55)
expectSlave(AFL3, 'spare', ID.spare)

console.log('\nd) AFL2 slaves')
expectSlave(AFL2, '1fback', ID.back1f)
expectSlave(AFL2, '1f back side db', ID.back1f)
expectSlave(AFL2, '2fcooler', ID.cooler2f)
expectSlave(AFL2, 'air cooler 2nd floor', ID.cooler2f)

console.log('\ne) Ambition2 SHall1 → Sewing-1F-AMB rename')
expectSlave(AMB2_OLD, 'SHall1', ID.shall1)
expectSlave(AMB2_OLD, 'shall1', ID.shall1)
expectSlave(AMB2_NEW, 'SHall1', ID.shall1)
expectSlave(AMB2_NEW, 'shall1', ID.shall1)
expectSlave(AMB2_NEW, 'S Hall 1', ID.shall1)
expectSlave(AMB2_NEW, 'sewing-1f-amb', ID.shall1)
expectSlave(AMB2_NEW, 'sh3', ID.sh3)

console.log('\nf) Negative')
expectNull(AFL3, 'unknown-meter-name')

const aliasKeys = Object.keys(SLAVE_ALIASES).length
console.log(`\n${passed} passed, ${failed} failed (${passed + failed} total, ${aliasKeys} alias keys loaded)`)
process.exit(failed > 0 ? 1 : 0)
