/**
 * Generate synthetic EMS chatbot sample CSVs matching Prisma schema shapes.
 *
 * Usage (from repo root):
 *   node data/chatbot/scripts/generate-sample-data.js
 *
 * Does not require DATABASE_URL. Output lands in data/chatbot/*.csv
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const OUT_DIR = path.join(__dirname, '..')

// Deterministic UUIDs from a label (stable across regenerations)
const id = (label) => {
  const h = crypto.createHash('sha256').update(`ems-chatbot-sample:${label}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

const csvEscape = (v) => {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const writeCsv = (filename, headers, rows) => {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  }
  const filePath = path.join(OUT_DIR, filename)
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8')
  console.log(`  ${filename}: ${rows.length} rows`)
  return rows.length
}

// Fixed "now" for reproducible timestamps (aligned with dataset narrative)
const NOW = new Date('2026-08-06T10:00:00.000Z')
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString()
const daysAgo = (d) => new Date(NOW.getTime() - d * 86400 * 1000).toISOString()
const iso = (d) => (d instanceof Date ? d.toISOString() : d)

const VARIABLE_DEFS = [
  { name: 'VoltageA', displayName: 'Voltage Phase A', unit: 'V', range: [218, 242] },
  { name: 'VoltageB', displayName: 'Voltage Phase B', unit: 'V', range: [217, 241] },
  { name: 'VoltageC', displayName: 'Voltage Phase C', unit: 'V', range: [219, 243] },
  { name: 'CurrentA', displayName: 'Current Phase A', unit: 'A', range: [1, 45] },
  { name: 'CurrentB', displayName: 'Current Phase B', unit: 'A', range: [1, 45] },
  { name: 'CurrentC', displayName: 'Current Phase C', unit: 'A', range: [1, 45] },
  { name: 'ActivePower', displayName: 'Active Power', unit: 'kW', range: [0.5, 9.5] },
  { name: 'ReactivePower', displayName: 'Reactive Power', unit: 'kVar', range: [0.1, 4.5] },
  { name: 'ApparentPower', displayName: 'Apparent Power', unit: 'kVA', range: [0.6, 11] },
  { name: 'PowerConsumption', displayName: 'Energy Consumption', unit: 'kWh', range: [5, 80], cumulative: true },
  { name: 'ExportPower', displayName: 'Export Energy', unit: 'kWh', range: [0, 15], cumulative: true },
  { name: 'PowerFactor', displayName: 'Power Factor', unit: 'ratio', range: [0.72, 0.99] },
  { name: 'Frequency', displayName: 'Frequency', unit: 'Hz', range: [49.5, 50.5] },
  { name: 'VoltageImbalance', displayName: 'Voltage Imbalance', unit: '%', range: [0, 4.5] },
  { name: 'CurrentImbalance', displayName: 'Current Imbalance', unit: '%', range: [0, 9] },
  { name: 'THD_V', displayName: 'THD Voltage', unit: '%', range: [0, 4.8] },
  { name: 'THD_I', displayName: 'THD Current', unit: '%', range: [0, 14] },
  { name: 'TotalCost', displayName: 'Total Cost', unit: 'PKR', range: [10, 500], cumulative: true },
]

// Seeded PRNG for reproducibility
let seed = 42
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 0xffffffff
}
const rand = (min, max, dp = 2) => parseFloat((rnd() * (max - min) + min).toFixed(dp))
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]

const valueFor = (def, deviceIndex, hourOffset = 0) => {
  const [min, max] = def.range
  if (def.cumulative) {
    const base = min + deviceIndex * 3.7 + Math.max(0, -hourOffset) * 0.08
    return parseFloat(Math.min(max, base).toFixed(2))
  }
  // Mild device + time variation within range
  const mid = (min + max) / 2
  const wobble = Math.sin((deviceIndex + 1) * 1.7 + hourOffset * 0.4) * ((max - min) * 0.15)
  return parseFloat(Math.max(min, Math.min(max, mid + wobble + (rnd() - 0.5) * (max - min) * 0.05)).toFixed(2))
}

function main() {
  console.log('Generating chatbot sample CSVs →', OUT_DIR)

  // --- Organizations ---
  const orgs = [
    {
      id: id('org:greenfield'),
      name: 'Greenfield Energy Co',
      description: 'Commercial campus EMS — Lahore',
      status: 'ACTIVE',
      createdAt: daysAgo(120),
      updatedAt: hoursAgo(2),
    },
    {
      id: id('org:riverdale'),
      name: 'Riverdale Manufacturing',
      description: 'Industrial plant energy monitoring — Karachi',
      status: 'ACTIVE',
      createdAt: daysAgo(90),
      updatedAt: hoursAgo(5),
    },
    {
      id: id('org:demo-inactive'),
      name: 'Demo Inactive Org',
      description: 'Inactive sandbox for chatbot edge cases',
      status: 'INACTIVE',
      createdAt: daysAgo(200),
      updatedAt: daysAgo(30),
    },
  ]
  writeCsv('organizations.csv', ['id', 'name', 'description', 'status', 'createdAt', 'updatedAt'], orgs)

  // --- Users (no password hashes) ---
  const users = [
    {
      id: id('user:gf-admin'),
      fullName: 'Ayesha Khan',
      email: 'ayesha.khan@greenfield-energy.example',
      phone: '+92-300-1110001',
      role: 'ORG_ADMIN',
      organizationId: orgs[0].id,
      organizationName: orgs[0].name,
      status: 'ACTIVE',
    },
    {
      id: id('user:gf-ops'),
      fullName: 'Bilal Ahmed',
      email: 'bilal.ahmed@greenfield-energy.example',
      phone: '+92-300-1110002',
      role: 'USER',
      organizationId: orgs[0].id,
      organizationName: orgs[0].name,
      status: 'ACTIVE',
    },
    {
      id: id('user:rd-admin'),
      fullName: 'Sara Malik',
      email: 'sara.malik@riverdale-mfg.example',
      phone: '+92-321-2220001',
      role: 'ORG_ADMIN',
      organizationId: orgs[1].id,
      organizationName: orgs[1].name,
      status: 'ACTIVE',
    },
    {
      id: id('user:rd-ops'),
      fullName: 'Omar Sheikh',
      email: 'omar.sheikh@riverdale-mfg.example',
      phone: '+92-321-2220002',
      role: 'USER',
      organizationId: orgs[1].id,
      organizationName: orgs[1].name,
      status: 'ACTIVE',
    },
  ]
  writeCsv(
    'users.csv',
    ['id', 'fullName', 'email', 'phone', 'role', 'organizationId', 'organizationName', 'status'],
    users
  )

  // --- Templates (one per active org) ---
  const templates = orgs.slice(0, 2).map((org, i) => ({
    id: id(`template:${org.id}`),
    name: i === 0 ? 'Agritech Energy Monitor' : 'Plant Power Meter',
    organizationId: org.id,
    organizationName: org.name,
    totalSlaves: 1,
    totalVariables: VARIABLE_DEFS.length,
  }))

  const slaves = templates.map((t) => ({
    id: id(`slave:${t.id}`),
    templateId: t.id,
    organizationId: t.organizationId,
    name: 'Main Meter',
    protocol: 'ModbusTCP',
  }))

  const templateVars = []
  for (const slave of slaves) {
    VARIABLE_DEFS.forEach((v, idx) => {
      templateVars.push({
        id: id(`tvar:${slave.id}:${v.name}`),
        templateSlaveId: slave.id,
        templateId: slave.templateId,
        organizationId: slave.organizationId,
        name: v.name,
        displayName: v.displayName,
        unit: v.unit,
        dataType: 'FLOAT',
        sortNumber: idx + 1,
        isActive: true,
      })
    })
  }

  // --- Gateways ---
  const gatewayModels = ['N510', 'N520', 'EG5000', 'RUT241', 'Moxa-IA240']
  const gateways = []
  const gwSpecs = [
    { org: orgs[0], name: 'Building A Gateway', serial: 'GW-GF-001', model: gatewayModels[0], status: 'ONLINE', lastSeenH: 0.1 },
    { org: orgs[0], name: 'Building B Gateway', serial: 'GW-GF-002', model: gatewayModels[1], status: 'ONLINE', lastSeenH: 0.2 },
    { org: orgs[0], name: 'Parking Lot Gateway', serial: 'GW-GF-003', model: gatewayModels[2], status: 'OFFLINE', lastSeenH: 18 },
    { org: orgs[1], name: 'Line 1 Gateway', serial: 'GW-RD-001', model: gatewayModels[3], status: 'ONLINE', lastSeenH: 0.05 },
    { org: orgs[1], name: 'Line 2 Gateway', serial: 'GW-RD-002', model: gatewayModels[4], status: 'GATEWAY_ALARM', lastSeenH: 1.5 },
    { org: orgs[1], name: 'Warehouse Gateway', serial: 'GW-RD-003', model: gatewayModels[0], status: 'ONLINE', lastSeenH: 0.3 },
  ]
  for (const g of gwSpecs) {
    gateways.push({
      id: id(`gw:${g.serial}`),
      name: g.name,
      serialNumber: g.serial,
      model: g.model,
      status: g.status,
      organizationId: g.org.id,
      organizationName: g.org.name,
      lastSeenAt: hoursAgo(g.lastSeenH),
      createdAt: daysAgo(60),
      updatedAt: hoursAgo(g.lastSeenH),
    })
  }
  writeCsv(
    'gateways.csv',
    ['id', 'name', 'serialNumber', 'model', 'status', 'organizationId', 'organizationName', 'lastSeenAt', 'createdAt', 'updatedAt'],
    gateways
  )

  // --- Devices ---
  const deviceSpecs = [
    // Greenfield
    { org: orgs[0], gw: gateways[0], name: 'Energy Meter 001', status: 'ONLINE', switchState: 'ON', lastH: 0.05 },
    { org: orgs[0], gw: gateways[0], name: 'Energy Meter 002', status: 'ONLINE', switchState: 'ON', lastH: 0.1 },
    { org: orgs[0], gw: gateways[1], name: 'Energy Meter 003', status: 'ONLINE', switchState: 'OFF', lastH: 0.15 },
    { org: orgs[0], gw: gateways[1], name: 'Energy Meter 004', status: 'OFFLINE', switchState: 'OFF', lastH: 26 },
    { org: orgs[0], gw: gateways[2], name: 'Energy Meter 005', status: 'OFFLINE', switchState: 'OFF', lastH: 20 },
    { org: orgs[0], gw: gateways[0], name: 'HVAC Meter North', status: 'ONLINE', switchState: 'ON', lastH: 0.08 },
    // Riverdale
    { org: orgs[1], gw: gateways[3], name: 'Press Line Meter A', status: 'ONLINE', switchState: 'ON', lastH: 0.02 },
    { org: orgs[1], gw: gateways[3], name: 'Press Line Meter B', status: 'ONLINE', switchState: 'ON', lastH: 0.04 },
    { org: orgs[1], gw: gateways[4], name: 'Compressor Bank Meter', status: 'ONLINE', switchState: 'ON', lastH: 0.2 },
    { org: orgs[1], gw: gateways[4], name: 'Paint Shop Meter', status: 'OFFLINE', switchState: 'OFF', lastH: 12 },
    { org: orgs[1], gw: gateways[5], name: 'Warehouse Main Meter', status: 'ONLINE', switchState: 'ON', lastH: 0.25 },
    { org: orgs[1], gw: gateways[5], name: 'Cold Storage Meter', status: 'ONLINE', switchState: 'ON', lastH: 0.12 },
  ]

  const devices = deviceSpecs.map((d, i) => {
    const template = templates.find((t) => t.organizationId === d.org.id)
    return {
      id: id(`device:${d.name}`),
      name: d.name,
      gatewayId: d.gw.id,
      gatewayName: d.gw.name,
      organizationId: d.org.id,
      organizationName: d.org.name,
      templateId: template.id,
      templateName: template.name,
      switchState: d.switchState,
      status: d.status,
      lastDataReceivedAt: hoursAgo(d.lastH),
      createdAt: daysAgo(45 - (i % 10)),
      updatedAt: hoursAgo(d.lastH),
      _index: i + 1,
    }
  })

  writeCsv(
    'devices.csv',
    [
      'id',
      'name',
      'gatewayId',
      'gatewayName',
      'organizationId',
      'organizationName',
      'templateId',
      'templateName',
      'switchState',
      'status',
      'lastDataReceivedAt',
      'createdAt',
      'updatedAt',
    ],
    devices
  )

  // Device–user assignments (org USER role)
  const deviceUsers = []
  const gfUser = users[1]
  const rdUser = users[3]
  devices
    .filter((d) => d.organizationId === orgs[0].id)
    .slice(0, 4)
    .forEach((d) => {
      deviceUsers.push({
        id: id(`du:${d.id}:${gfUser.id}`),
        deviceId: d.id,
        deviceName: d.name,
        userId: gfUser.id,
        userEmail: gfUser.email,
        organizationId: d.organizationId,
        assignedAt: daysAgo(20),
      })
    })
  devices
    .filter((d) => d.organizationId === orgs[1].id)
    .slice(0, 4)
    .forEach((d) => {
      deviceUsers.push({
        id: id(`du:${d.id}:${rdUser.id}`),
        deviceId: d.id,
        deviceName: d.name,
        userId: rdUser.id,
        userEmail: rdUser.email,
        organizationId: d.organizationId,
        assignedAt: daysAgo(15),
      })
    })
  writeCsv(
    'device_users.csv',
    ['id', 'deviceId', 'deviceName', 'userId', 'userEmail', 'organizationId', 'assignedAt'],
    deviceUsers
  )

  // --- Config slaves + variables (current values) ---
  const configSlaves = []
  const configVars = []
  for (const device of devices) {
    const template = templates.find((t) => t.id === device.templateId)
    const slave = slaves.find((s) => s.templateId === template.id)
    const csId = id(`cslave:${device.id}`)
    configSlaves.push({
      id: csId,
      deviceId: device.id,
      deviceName: device.name,
      templateSlaveId: slave.id,
      organizationId: device.organizationId,
      name: 'Main Meter',
      isDefault: true,
      isActive: true,
    })

    for (const v of VARIABLE_DEFS) {
      const tvar = templateVars.find(
        (tv) => tv.templateSlaveId === slave.id && tv.name === v.name
      )
      const current = valueFor(v, device._index, 0)
      // Offline devices: slightly stale lastUpdatedAt
      const lastUpdatedAt =
        device.status === 'OFFLINE' ? hoursAgo(12 + device._index) : hoursAgo(0.05 + device._index * 0.01)
      configVars.push({
        id: id(`cvar:${device.id}:${v.name}`),
        deviceId: device.id,
        deviceName: device.name,
        deviceConfigSlaveId: csId,
        templateVariableId: tvar.id,
        organizationId: device.organizationId,
        organizationName: device.organizationName,
        name: v.name,
        displayName: v.displayName,
        unit: v.unit,
        currentValue: String(current),
        lastUpdatedAt,
        isActive: true,
        deviceStatus: device.status,
      })
    }
  }
  writeCsv(
    'device_config_slaves.csv',
    ['id', 'deviceId', 'deviceName', 'templateSlaveId', 'organizationId', 'name', 'isDefault', 'isActive'],
    configSlaves
  )
  writeCsv(
    'device_config_variables.csv',
    [
      'id',
      'deviceId',
      'deviceName',
      'deviceConfigSlaveId',
      'templateVariableId',
      'organizationId',
      'organizationName',
      'name',
      'displayName',
      'unit',
      'currentValue',
      'lastUpdatedAt',
      'isActive',
      'deviceStatus',
    ],
    configVars
  )

  // --- Alarm settings + history ---
  const alarmSettings = [
    {
      id: id('alarm:gf-overvoltage'),
      name: 'Overvoltage Phase A',
      organizationId: orgs[0].id,
      organizationName: orgs[0].name,
      status: 'ACTIVE',
      pushType: 'EMAIL',
      pushBody: 'VoltageA exceeded threshold',
    },
    {
      id: id('alarm:gf-low-pf'),
      name: 'Low Power Factor',
      organizationId: orgs[0].id,
      organizationName: orgs[0].name,
      status: 'ACTIVE',
      pushType: 'PUSH',
      pushBody: 'PowerFactor below 0.80',
    },
    {
      id: id('alarm:rd-imbalance'),
      name: 'Current Imbalance High',
      organizationId: orgs[1].id,
      organizationName: orgs[1].name,
      status: 'ACTIVE',
      pushType: 'EMAIL',
      pushBody: 'CurrentImbalance exceeded 6%',
    },
    {
      id: id('alarm:rd-overcurrent'),
      name: 'Overcurrent Phase A',
      organizationId: orgs[1].id,
      organizationName: orgs[1].name,
      status: 'ACTIVE',
      pushType: 'SMS',
      pushBody: 'CurrentA exceeded 40A',
    },
  ]
  writeCsv(
    'alarm_settings.csv',
    ['id', 'name', 'organizationId', 'organizationName', 'status', 'pushType', 'pushBody'],
    alarmSettings
  )

  const alarmEvents = [
    { device: devices[0], setting: alarmSettings[0], variable: 'VoltageA', value: 248.2, cond: 'VoltageA GT 245', state: 'RESOLVED', process: 'PROCESSED', h: 36 },
    { device: devices[1], setting: alarmSettings[1], variable: 'PowerFactor', value: 0.74, cond: 'PowerFactor LT 0.80', state: 'ACTIVE', process: 'UNPROCESSED', h: 4 },
    { device: devices[5], setting: alarmSettings[0], variable: 'VoltageA', value: 246.8, cond: 'VoltageA GT 245', state: 'ACTIVE', process: 'UNPROCESSED', h: 1.5 },
    { device: devices[6], setting: alarmSettings[2], variable: 'CurrentImbalance', value: 7.2, cond: 'CurrentImbalance GT 6', state: 'ACTIVE', process: 'UNPROCESSED', h: 2 },
    { device: devices[8], setting: alarmSettings[3], variable: 'CurrentA', value: 42.5, cond: 'CurrentA GT 40', state: 'RESOLVED', process: 'PROCESSED', h: 28 },
    { device: devices[7], setting: alarmSettings[2], variable: 'CurrentImbalance', value: 6.8, cond: 'CurrentImbalance GT 6', state: 'RESOLVED', process: 'PROCESSED', h: 48 },
    { device: devices[11], setting: alarmSettings[3], variable: 'CurrentA', value: 41.1, cond: 'CurrentA GT 40', state: 'ACTIVE', process: 'UNPROCESSED', h: 0.8 },
    { device: devices[2], setting: alarmSettings[1], variable: 'PowerFactor', value: 0.76, cond: 'PowerFactor LT 0.80', state: 'RESOLVED', process: 'PROCESSED', h: 72 },
    { device: devices[9], setting: alarmSettings[3], variable: 'CurrentA', value: 43.0, cond: 'CurrentA GT 40', state: 'ACTIVE', process: 'UNPROCESSED', h: 10 },
    { device: devices[4], setting: alarmSettings[0], variable: 'VoltageA', value: 247.0, cond: 'VoltageA GT 245', state: 'RESOLVED', process: 'PROCESSED', h: 96 },
  ]

  const alarmHistories = alarmEvents.map((e, i) => ({
    id: id(`alarmhist:${i}`),
    alarmSettingId: e.setting.id,
    alarmSettingName: e.setting.name,
    deviceId: e.device.id,
    deviceName: e.device.name,
    organizationId: e.device.organizationId,
    organizationName: e.device.organizationName,
    variableName: e.variable,
    triggerName: e.setting.name,
    triggerType: e.variable.includes('Voltage') ? 'voltage' : e.variable.includes('Current') ? 'current' : 'custom',
    slaveName: 'Main Meter',
    currentValue: e.value,
    triggeringCondition: e.cond,
    alarmTime: hoursAgo(e.h),
    alarmState: e.state,
    processState: e.process,
  }))
  writeCsv(
    'alarm_histories.csv',
    [
      'id',
      'alarmSettingId',
      'alarmSettingName',
      'deviceId',
      'deviceName',
      'organizationId',
      'organizationName',
      'variableName',
      'triggerName',
      'triggerType',
      'slaveName',
      'currentValue',
      'triggeringCondition',
      'alarmTime',
      'alarmState',
      'processState',
    ],
    alarmHistories
  )

  // Alarm notifications (recent)
  const alarmNotifications = alarmHistories.slice(0, 6).map((h, i) => ({
    id: id(`alarmnotif:${i}`),
    alarmSettingId: h.alarmSettingId,
    organizationId: h.organizationId,
    deviceId: h.deviceId,
    deviceName: h.deviceName,
    message: `${h.triggerName}: ${h.triggeringCondition} (value=${h.currentValue})`,
    pushType: alarmSettings.find((s) => s.id === h.alarmSettingId)?.pushType || 'EMAIL',
    sentTo: h.organizationId === orgs[0].id ? users[0].email : users[2].email,
    sentAt: h.alarmTime,
    status: i === 5 ? 'FAILED' : 'SENT',
  }))
  writeCsv(
    'alarm_history_notifications.csv',
    ['id', 'alarmSettingId', 'organizationId', 'deviceId', 'deviceName', 'message', 'pushType', 'sentTo', 'sentAt', 'status'],
    alarmNotifications
  )

  // --- Limited sensor readings (time series sample) ---
  // ~8 devices × 6 hours × key variables ≈ manageable set
  const sampleDevices = devices.filter((d) => d.status === 'ONLINE').slice(0, 8)
  const sampleVarNames = [
    'VoltageA',
    'VoltageB',
    'VoltageC',
    'CurrentA',
    'ActivePower',
    'PowerFactor',
    'PowerConsumption',
    'Frequency',
  ]
  const readingHours = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12] // 10 timestamps
  const sensorReadings = []
  const sensorReadingValues = []
  let readingIdx = 0

  for (const device of sampleDevices) {
    const cs = configSlaves.find((s) => s.deviceId === device.id)
    for (const h of readingHours) {
      const ts = hoursAgo(h)
      const readingsObj = {}
      for (const vn of sampleVarNames) {
        const def = VARIABLE_DEFS.find((v) => v.name === vn)
        readingsObj[vn] = valueFor(def, device._index, -h)
      }
      const readingId = id(`sread:${device.id}:h${h}`)
      sensorReadings.push({
        id: readingId,
        deviceId: device.id,
        deviceName: device.name,
        deviceConfigSlaveId: cs.id,
        organizationId: device.organizationId,
        organizationName: device.organizationName,
        timestamp: ts,
        readings: JSON.stringify(readingsObj),
      })
      for (const vn of sampleVarNames) {
        sensorReadingValues.push({
          id: id(`srv:${readingId}:${vn}`),
          sensorReadingId: readingId,
          deviceId: device.id,
          deviceName: device.name,
          deviceConfigSlaveId: cs.id,
          organizationId: device.organizationId,
          organizationName: device.organizationName,
          variableName: vn,
          unit: VARIABLE_DEFS.find((v) => v.name === vn).unit,
          value: readingsObj[vn],
          timestamp: ts,
        })
      }
      readingIdx++
    }
  }
  writeCsv(
    'sensor_readings_sample.csv',
    ['id', 'deviceId', 'deviceName', 'deviceConfigSlaveId', 'organizationId', 'organizationName', 'timestamp', 'readings'],
    sensorReadings
  )
  writeCsv(
    'sensor_reading_values_sample.csv',
    [
      'id',
      'sensorReadingId',
      'deviceId',
      'deviceName',
      'deviceConfigSlaveId',
      'organizationId',
      'organizationName',
      'variableName',
      'unit',
      'value',
      'timestamp',
    ],
    sensorReadingValues
  )

  // --- Interval histories (daily energy / cost for chatbot "consumption" Qs) ---
  const intervalHistories = []
  let ih = 0
  for (const device of devices) {
    const cs = configSlaves.find((s) => s.deviceId === device.id)
    for (let day = 1; day <= 7; day++) {
      const end = new Date(NOW.getTime() - (day - 1) * 86400 * 1000)
      end.setUTCHours(0, 0, 0, 0)
      const start = new Date(end.getTime() - 86400 * 1000)
      const totalUnit = parseFloat((12 + device._index * 1.8 + rnd() * 4).toFixed(2))
      const tariff = parseFloat((totalUnit * (28 + rnd() * 4)).toFixed(2))
      intervalHistories.push({
        id: id(`ih:${device.id}:d${day}`),
        organizationId: device.organizationId,
        organizationName: device.organizationName,
        deviceId: device.id,
        deviceName: device.name,
        deviceConfigSlaveId: cs.id,
        variableName: 'PowerConsumption',
        slaveName: 'Main Meter',
        totalUnit,
        tariff,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        computedAt: hoursAgo(day * 24 - 2),
      })
      ih++
    }
  }
  writeCsv(
    'interval_histories.csv',
    [
      'id',
      'organizationId',
      'organizationName',
      'deviceId',
      'deviceName',
      'deviceConfigSlaveId',
      'variableName',
      'slaveName',
      'totalUnit',
      'tariff',
      'startDate',
      'endDate',
      'computedAt',
    ],
    intervalHistories
  )

  // --- Option B: denormalized chatbot facts (easy RAG ingest) ---
  const facts = []

  // Org / fleet inventory facts
  for (const org of orgs.filter((o) => o.status === 'ACTIVE')) {
    const orgDevices = devices.filter((d) => d.organizationId === org.id)
    const online = orgDevices.filter((d) => d.status === 'ONLINE').length
    const offline = orgDevices.filter((d) => d.status === 'OFFLINE').length
    const orgGws = gateways.filter((g) => g.organizationId === org.id)
    facts.push({
      factType: 'org_summary',
      organizationId: org.id,
      organizationName: org.name,
      deviceId: '',
      deviceName: '',
      gatewayId: '',
      gatewayName: '',
      variableName: '',
      displayName: '',
      unit: '',
      value: '',
      timestamp: NOW.toISOString(),
      alarmState: '',
      status: org.status,
      text: `${org.name} has ${orgDevices.length} devices (${online} ONLINE, ${offline} OFFLINE) and ${orgGws.length} gateways.`,
    })
  }

  for (const d of devices) {
    facts.push({
      factType: 'device_status',
      organizationId: d.organizationId,
      organizationName: d.organizationName,
      deviceId: d.id,
      deviceName: d.name,
      gatewayId: d.gatewayId,
      gatewayName: d.gatewayName,
      variableName: '',
      displayName: '',
      unit: '',
      value: '',
      timestamp: d.lastDataReceivedAt,
      alarmState: '',
      status: d.status,
      text: `Device ${d.name} (${d.organizationName}) is ${d.status}, switch ${d.switchState}, on gateway ${d.gatewayName}. Last data at ${d.lastDataReceivedAt}.`,
    })
  }

  // Current readings — prioritize chatbot-useful vars
  const factVars = ['VoltageA', 'VoltageB', 'VoltageC', 'CurrentA', 'ActivePower', 'PowerFactor', 'PowerConsumption', 'Frequency', 'VoltageImbalance', 'CurrentImbalance']
  for (const cv of configVars.filter((c) => factVars.includes(c.name))) {
    facts.push({
      factType: 'current_reading',
      organizationId: cv.organizationId,
      organizationName: cv.organizationName,
      deviceId: cv.deviceId,
      deviceName: cv.deviceName,
      gatewayId: '',
      gatewayName: '',
      variableName: cv.name,
      displayName: cv.displayName,
      unit: cv.unit,
      value: cv.currentValue,
      timestamp: cv.lastUpdatedAt,
      alarmState: '',
      status: cv.deviceStatus,
      text: `${cv.deviceName} (${cv.organizationName}): ${cv.displayName} (${cv.name}) = ${cv.currentValue} ${cv.unit} as of ${cv.lastUpdatedAt} [device ${cv.deviceStatus}].`,
    })
  }

  for (const a of alarmHistories) {
    facts.push({
      factType: 'alarm',
      organizationId: a.organizationId,
      organizationName: a.organizationName,
      deviceId: a.deviceId,
      deviceName: a.deviceName,
      gatewayId: '',
      gatewayName: '',
      variableName: a.variableName,
      displayName: a.triggerName,
      unit: '',
      value: String(a.currentValue),
      timestamp: a.alarmTime,
      alarmState: a.alarmState,
      status: a.processState,
      text: `Alarm "${a.triggerName}" on ${a.deviceName} (${a.organizationName}): ${a.triggeringCondition}, value=${a.currentValue}, state=${a.alarmState}, process=${a.processState}, at ${a.alarmTime}.`,
    })
  }

  // Daily energy rollups (last 3 days, all devices) for consumption Qs
  for (const ihRow of intervalHistories.filter((r) => {
    const start = new Date(r.startDate)
    return NOW.getTime() - start.getTime() < 4 * 86400 * 1000
  })) {
    facts.push({
      factType: 'energy_interval',
      organizationId: ihRow.organizationId,
      organizationName: ihRow.organizationName,
      deviceId: ihRow.deviceId,
      deviceName: ihRow.deviceName,
      gatewayId: '',
      gatewayName: '',
      variableName: ihRow.variableName,
      displayName: 'Daily Energy Consumption',
      unit: 'kWh',
      value: String(ihRow.totalUnit),
      timestamp: ihRow.endDate,
      alarmState: '',
      status: '',
      text: `${ihRow.deviceName} (${ihRow.organizationName}) consumed ${ihRow.totalUnit} kWh (cost ${ihRow.tariff} PKR) from ${ihRow.startDate} to ${ihRow.endDate}.`,
    })
  }

  // A slice of historical reading values for trend questions
  for (const srv of sensorReadingValues.filter((r) =>
    ['VoltageA', 'ActivePower', 'PowerConsumption', 'PowerFactor'].includes(r.variableName)
  )) {
    facts.push({
      factType: 'historical_reading',
      organizationId: srv.organizationId,
      organizationName: srv.organizationName,
      deviceId: srv.deviceId,
      deviceName: srv.deviceName,
      gatewayId: '',
      gatewayName: '',
      variableName: srv.variableName,
      displayName: srv.variableName,
      unit: srv.unit,
      value: String(srv.value),
      timestamp: srv.timestamp,
      alarmState: '',
      status: '',
      text: `At ${srv.timestamp}, ${srv.deviceName} (${srv.organizationName}) ${srv.variableName}=${srv.value} ${srv.unit}.`,
    })
  }

  writeCsv(
    'chatbot_facts.csv',
    [
      'factType',
      'organizationId',
      'organizationName',
      'deviceId',
      'deviceName',
      'gatewayId',
      'gatewayName',
      'variableName',
      'displayName',
      'unit',
      'value',
      'timestamp',
      'alarmState',
      'status',
      'text',
    ],
    facts
  )

  // Manifest for quick inventory
  const manifest = {
    generatedAt: new Date().toISOString(),
    dataAsOf: NOW.toISOString(),
    source: 'synthetic',
    note: 'No live DATABASE_URL was available; IDs and values are synthetic but match Prisma field names and EMS reading profiles.',
    files: {
      'organizations.csv': orgs.length,
      'users.csv': users.length,
      'gateways.csv': gateways.length,
      'devices.csv': devices.length,
      'device_users.csv': deviceUsers.length,
      'device_config_slaves.csv': configSlaves.length,
      'device_config_variables.csv': configVars.length,
      'alarm_settings.csv': alarmSettings.length,
      'alarm_histories.csv': alarmHistories.length,
      'alarm_history_notifications.csv': alarmNotifications.length,
      'sensor_readings_sample.csv': sensorReadings.length,
      'sensor_reading_values_sample.csv': sensorReadingValues.length,
      'interval_histories.csv': intervalHistories.length,
      'chatbot_facts.csv': facts.length,
    },
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log('  manifest.json written')
  console.log('Done. Total denormalized facts:', facts.length)
}

main()
