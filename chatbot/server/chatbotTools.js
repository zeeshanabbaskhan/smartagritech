/**
 * chatbotTools.js  — Phase B
 *
 * Org-scoped query functions over the in-memory CSV data (db).
 * These mirror what Prisma queries would return from the real database.
 * Each function corresponds to one Gemini/Groq tool call.
 */

const { db } = require('./dataLoader')

// ── helpers ───────────────────────────────────────────────────────────────────
const byOrgName = (name) =>
  db.organizations.find(o => o.name.toLowerCase().includes(name.toLowerCase()))

const byOrgId   = (id) => db.organizations.find(o => o.id === id)

const devicesByOrg = (orgId) => db.devices.filter(d => d.organizationId === orgId)

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL 1 — getOrgSummary
// ─────────────────────────────────────────────────────────────────────────────
function getOrgSummary({ orgName }) {
  const org = byOrgName(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  const devices  = devicesByOrg(org.id)
  const gateways = db.gateways.filter(g => g.organizationId === org.id)
  const online   = devices.filter(d => d.status === 'ONLINE').length
  const offline  = devices.filter(d => d.status === 'OFFLINE').length

  return {
    name:        org.name,
    description: org.description,
    status:      org.status,
    totalDevices:  devices.length,
    onlineDevices: online,
    offlineDevices: offline,
    totalGateways: gateways.length,
    devices: devices.map(d => ({ id: d.id, name: d.name, status: d.status, gatewayName: d.gatewayName })),
    gateways: gateways.map(g => ({ id: g.id, name: g.name, status: g.status })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL 2 — listDevicesForOrg
// ─────────────────────────────────────────────────────────────────────────────
function listDevicesForOrg({ orgName, statusFilter }) {
  const org = byOrgName(orgName)
  if (!org) return { error: `No organization found matching "${orgName}"` }

  let devices = devicesByOrg(org.id)
  if (statusFilter) {
    devices = devices.filter(d => d.status === statusFilter.toUpperCase())
  }

  return {
    organization: org.name,
    count: devices.length,
    devices: devices.map(d => ({
      name:              d.name,
      status:            d.status,
      gatewayName:       d.gatewayName,
      switchState:       d.switchState,
      lastDataReceivedAt: d.lastDataReceivedAt,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL 3 — getDeviceStatus
// ─────────────────────────────────────────────────────────────────────────────
function getDeviceStatus({ deviceName, orgName }) {
  let devices = db.devices
  if (orgName) {
    const org = byOrgName(orgName)
    if (org) devices = devices.filter(d => d.organizationId === org.id)
  }
  const device = devices.find(d => d.name.toLowerCase().includes(deviceName.toLowerCase()))
  if (!device) return { error: `No device found matching "${deviceName}"` }

  const gateway = db.gateways.find(g => g.id === device.gatewayId)

  return {
    name:              device.name,
    status:            device.status,
    switchState:       device.switchState,
    organization:      device.organizationName,
    gateway:           gateway ? { name: gateway.name, status: gateway.status } : null,
    lastDataReceivedAt: device.lastDataReceivedAt,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL 4 — getVariableValue
// ─────────────────────────────────────────────────────────────────────────────
function getVariableValue({ deviceName, variableName }) {
  const device = db.devices.find(d => d.name.toLowerCase().includes(deviceName.toLowerCase()))
  if (!device) return { error: `No device found matching "${deviceName}"` }

  const vars = db.deviceConfigVariables.filter(
    v => v.deviceId === device.id &&
         (variableName ? v.name.toLowerCase().includes(variableName.toLowerCase()) : true)
  )

  if (vars.length === 0) {
    return { error: `No variable "${variableName}" found on device "${device.name}"` }
  }

  return {
    device:    device.name,
    status:    device.status,
    variables: vars.map(v => ({
      name:          v.name,
      displayName:   v.displayName,
      currentValue:  v.currentValue,
      unit:          v.unit,
      lastUpdatedAt: v.lastUpdatedAt,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL 5 — getActiveAlarms
// ─────────────────────────────────────────────────────────────────────────────
function getActiveAlarms({ orgName, alarmState, limit }) {
  let alarms = db.alarmHistories

  if (orgName) {
    const org = byOrgName(orgName)
    if (org) alarms = alarms.filter(a => a.organizationId === org.id)
  }

  if (alarmState) {
    alarms = alarms.filter(a => a.alarmState === alarmState.toUpperCase())
  }

  // Sort newest first
  alarms = alarms.sort((a, b) => new Date(b.alarmTime) - new Date(a.alarmTime))

  if (limit) alarms = alarms.slice(0, parseInt(limit))

  return {
    count: alarms.length,
    alarms: alarms.map(a => ({
      deviceName:          a.deviceName,
      organizationName:    a.organizationName,
      variableName:        a.variableName,
      triggerName:         a.triggerName,
      currentValue:        a.currentValue,
      triggeringCondition: a.triggeringCondition,
      alarmState:          a.alarmState,
      processState:        a.processState,
      alarmTime:           a.alarmTime,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL 6 — getEnergyConsumption
// ─────────────────────────────────────────────────────────────────────────────
function getEnergyConsumption({ orgName, deviceName, lastDays }) {
  let records = db.intervalHistories

  if (orgName) {
    const org = byOrgName(orgName)
    if (org) records = records.filter(r => r.organizationId === org.id)
  }

  if (deviceName) {
    records = records.filter(r => r.deviceName.toLowerCase().includes(deviceName.toLowerCase()))
  }

  if (lastDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(lastDays))
    records = records.filter(r => new Date(r.startDate) >= cutoff)
  }

  // Sort newest first
  records = records.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))

  // Aggregate totals per device
  const byDevice = {}
  records.forEach(r => {
    if (!byDevice[r.deviceName]) {
      byDevice[r.deviceName] = {
        deviceName: r.deviceName,
        organization: r.organizationName,
        totalKwh: 0,
        totalTariff: 0,
        days: 0,
        records: [],
      }
    }
    byDevice[r.deviceName].totalKwh    += parseFloat(r.totalUnit) || 0
    byDevice[r.deviceName].totalTariff += parseFloat(r.tariff)    || 0
    byDevice[r.deviceName].days        += 1
    byDevice[r.deviceName].records.push({
      date:      r.startDate.slice(0, 10),
      kwh:       parseFloat(r.totalUnit).toFixed(2),
      tariff:    parseFloat(r.tariff).toFixed(2),
    })
  })

  const summary = Object.values(byDevice).map(d => ({
    ...d,
    totalKwh:    d.totalKwh.toFixed(2),
    totalTariff: d.totalTariff.toFixed(2),
  }))

  return {
    count: summary.length,
    period: lastDays ? `last ${lastDays} days` : 'all available',
    devices: summary,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL 7 — getGatewayStatus
// ─────────────────────────────────────────────────────────────────────────────
function getGatewayStatus({ orgName, statusFilter }) {
  let gateways = db.gateways

  if (orgName) {
    const org = byOrgName(orgName)
    if (org) gateways = gateways.filter(g => g.organizationId === org.id)
  }

  if (statusFilter) {
    gateways = gateways.filter(g => g.status.toUpperCase() === statusFilter.toUpperCase())
  }

  return {
    count: gateways.length,
    gateways: gateways.map(g => {
      const org = byOrgId(g.organizationId)
      const connectedDevices = db.devices.filter(d => d.gatewayId === g.id)
      return {
        name:       g.name,
        status:     g.status,
        model:      g.model,
        organization: org?.name,
        lastSeenAt: g.lastSeenAt,
        deviceCount: connectedDevices.length,
      }
    }),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL 8 — getUserDevices
// ─────────────────────────────────────────────────────────────────────────────
function getUserDevices({ userEmail }) {
  const user = db.users.find(u => u.email.toLowerCase() === userEmail.toLowerCase())
  if (!user) return { error: `No user found with email "${userEmail}"` }

  const assignments = db.deviceUsers.filter(du => du.userId === user.id)
  const devices = assignments.map(du => {
    const d = db.devices.find(dev => dev.id === du.deviceId)
    return d ? { name: d.name, status: d.status, organization: d.organizationName } : null
  }).filter(Boolean)

  return {
    user:        user.fullName,
    email:       user.email,
    deviceCount: devices.length,
    devices,
  }
}

// ── Tool dispatch map ─────────────────────────────────────────────────────────
const TOOLS = {
  getOrgSummary,
  listDevicesForOrg,
  getDeviceStatus,
  getVariableValue,
  getActiveAlarms,
  getEnergyConsumption,
  getGatewayStatus,
  getUserDevices,
}

function callTool(name, args) {
  const fn = TOOLS[name]
  if (!fn) return { error: `Unknown tool: ${name}` }
  try {
    return fn(args)
  } catch (err) {
    return { error: err.message }
  }
}

module.exports = { callTool, TOOLS }
