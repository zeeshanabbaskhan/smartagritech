/**
 * Sample /UploadTopic (or any topic), invent templates/gateways/devices for every
 * unique MQTT device seen, then create Device Groups.
 *
 * Usage (on server or laptop that can reach the broker):
 *   node scripts/provisionMqttFleet.js
 *   node scripts/provisionMqttFleet.js --seconds 30 --dry-run
 *   node scripts/provisionMqttFleet.js --host 172.18.0.1 --user mosquitto_admin --pass '...'
 *
 * Env (optional):
 *   MQTT_HOST MQTT_PORT MQTT_USER MQTT_PASS MQTT_TOPIC
 *   ORG_NAME  (default: first org / Smart Agritech Lab)
 */
require('dotenv').config()
const mqtt = require('mqtt')
const prisma = require('../config/database')
const { provisionDevice } = require('../utils/provisionDevice')

const META = new Set(['device', 'serial_number', 'mac_address', 'sys_time', 'timestamp', 'time'])

const args = process.argv.slice(2)
const flag = (name, def = null) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return def
  return args[i + 1] ?? def
}
const has = (name) => args.includes(`--${name}`)

const HOST = flag('host', process.env.MQTT_HOST || '127.0.0.1')
const PORT = parseInt(flag('port', process.env.MQTT_PORT || '1883'), 10)
const USER = flag('user', process.env.MQTT_USER || 'mosquitto_admin')
const PASS = flag('pass', process.env.MQTT_PASS || 'LeHyp5Flith')
const TOPIC = flag('topic', process.env.MQTT_TOPIC || '/UploadTopic')
const SECONDS = parseInt(flag('seconds', '25'), 10)
const ORG_NAME = flag('org', process.env.ORG_NAME || 'Smart Agritech Lab')
const DRY = has('dry-run')

/** Prefer friendly EMS names for known EMS PANEL-style registers. */
const KNOWN_REG_NAMES = {
  40081: 'PowerFactor',
  40084: 'PowerFactor',
  40085: 'Frequency',
  40103: 'VoltageA',
  40105: 'VoltageB',
  40107: 'VoltageC',
  40115: 'ActivePower',
  40123: 'ReactivePower',
  40131: 'ApparentPower',
  40141: 'ExportPower',
  40097: 'VoltageA',
  40099: 'VoltageB',
  40101: 'VoltageC',
  40109: 'CurrentA',
  40111: 'CurrentB',
  40113: 'CurrentC',
  40121: 'ActivePower',
  40129: 'ReactivePower',
  40137: 'ApparentPower',
  40139: 'Energy',
  40003: 'Temperature',
  40327: 'THDUa',
  40328: 'THDUb',
  40329: 'THDUc',
  40330: 'THDIa',
  40331: 'THDIb',
  40332: 'THDIc',
  40437: 'R40437',
}

function unitGuess(name, reg) {
  const n = String(name || '')
  if (/voltage/i.test(n)) return 'V'
  if (/current/i.test(n)) return 'A'
  if (/powerfactor|pf/i.test(n)) return ''
  if (/frequency/i.test(n)) return 'Hz'
  if (/energy/i.test(n)) return 'kWh'
  if (/activepower|power/i.test(n) && !/reactive/i.test(n)) return 'W'
  if (String(reg).startsWith('40')) return ''
  return ''
}

function varNameForReg(reg) {
  const key = String(reg).replace(/^0x/i, '')
  return KNOWN_REG_NAMES[key] || KNOWN_REG_NAMES[Number(key)] || `R${key}`
}

function extractSlaves(payload) {
  const slaves = []
  for (const [key, value] of Object.entries(payload || {})) {
    if (META.has(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const regs = {}
      for (const [r, v] of Object.entries(value)) {
        const num = typeof v === 'number' ? v : Number(v)
        if (!Number.isNaN(num)) regs[String(r)] = num
      }
      if (Object.keys(regs).length) slaves.push({ name: key, registers: regs })
    }
  }
  return slaves
}

function sampleMqtt() {
  return new Promise((resolve, reject) => {
    /** @type {Map<string, { device: string, serial: string, mac?: string, slaves: Map<string, Set<string>> }>} */
    const found = new Map()
    const url = `mqtt://${HOST}:${PORT}`
    const client = mqtt.connect(url, {
      username: USER || undefined,
      password: PASS || undefined,
      connectTimeout: 15_000,
      reconnectPeriod: 0,
      clientId: `ems-provision-${Date.now()}`,
    })

    const timer = setTimeout(() => {
      try { client.end(true) } catch (_) {}
      resolve([...found.values()])
    }, SECONDS * 1000)

    client.on('error', (err) => {
      clearTimeout(timer)
      try { client.end(true) } catch (_) {}
      reject(err)
    })

    client.on('connect', () => {
      console.log(`Connected ${url} — sampling ${TOPIC} for ${SECONDS}s…`)
      client.subscribe(TOPIC, { qos: 0 })
    })

    client.on('message', (_topic, buf) => {
      let payload
      try { payload = JSON.parse(buf.toString('utf8')) } catch { return }
      const serial = payload.serial_number != null ? String(payload.serial_number).trim() : ''
      const device = payload.device != null ? String(payload.device).trim() : ''
      if (!serial || !device) return

      const key = `${serial}::${device}`
      if (!found.has(key)) {
        found.set(key, {
          device,
          serial,
          mac: payload.mac_address ? String(payload.mac_address) : undefined,
          slaves: new Map(),
        })
      }
      const entry = found.get(key)
      for (const block of extractSlaves(payload)) {
        if (!entry.slaves.has(block.name)) entry.slaves.set(block.name, new Set())
        const set = entry.slaves.get(block.name)
        for (const reg of Object.keys(block.registers)) set.add(reg)
      }
      process.stdout.write(`\r  seen ${found.size} device(s)…`)
    })
  })
}

async function upsertTemplate(orgId, deviceName, slaveMap) {
  const templateName = `MQTT · ${deviceName}`
  let template = await prisma.deviceTemplate.findFirst({
    where: { organizationId: orgId, name: templateName },
  })
  if (!template) {
    template = await prisma.deviceTemplate.create({
      data: {
        name: templateName,
        organizationId: orgId,
        acquisitionMethod: 'MQTT',
      },
    })
  }

  let totalVars = 0
  const slaveEntries = [...slaveMap.entries()]
  for (let i = 0; i < slaveEntries.length; i++) {
    const [slaveName, regSet] = slaveEntries[i]
    let slave = await prisma.deviceTemplateSlave.findFirst({
      where: { templateId: template.id, name: slaveName },
    })
    if (!slave) {
      slave = await prisma.deviceTemplateSlave.create({
        data: {
          templateId: template.id,
          organizationId: orgId,
          name: slaveName,
          isDefault: i === 0,
        },
      })
    }

    for (const reg of [...regSet].sort()) {
      const name = varNameForReg(reg)
      const existing = await prisma.deviceTemplateVariable.findFirst({
        where: { templateSlaveId: slave.id, name },
      })
      if (!existing) {
        await prisma.deviceTemplateVariable.create({
          data: {
            templateSlaveId: slave.id,
            templateId: template.id,
            organizationId: orgId,
            name,
            displayName: name,
            unit: unitGuess(name, reg),
            registerAddress: String(reg),
            dataType: 'FLOAT',
            isActive: true,
          },
        })
      } else if (!existing.registerAddress) {
        await prisma.deviceTemplateVariable.update({
          where: { id: existing.id },
          data: { registerAddress: String(reg) },
        })
      }
      totalVars += 1
    }
  }

  await prisma.deviceTemplate.update({
    where: { id: template.id },
    data: {
      totalSlaves: slaveEntries.length,
      totalVariables: totalVars,
    },
  })

  return template
}

async function upsertGateway(orgId, serial, deviceName) {
  let gw = await prisma.gateway.findFirst({ where: { serialNumber: serial } })
  if (gw) {
    if (gw.organizationId !== orgId) {
      throw new Error(`Gateway serial ${serial} belongs to another organization`)
    }
    return gw
  }
  return prisma.gateway.create({
    data: {
      name: `${deviceName} GW`,
      serialNumber: serial,
      model: 'MQTT',
      status: 'ONLINE',
      organizationId: orgId,
    },
  })
}

async function ensureDevice(orgId, templateId, gatewayId, deviceName) {
  const existing = await prisma.device.findFirst({
    where: { organizationId: orgId, name: deviceName, gatewayId },
  })
  if (existing) {
    // Refresh config vars from template if template grew
    const { syncTemplateToDevices } = require('../utils/syncTemplateToDevices')
    if (typeof syncTemplateToDevices === 'function') {
      await syncTemplateToDevices(templateId).catch(() => {})
    }
    return existing
  }

  return prisma.$transaction(async (tx) => {
    const { device } = await provisionDevice(tx, {
      name: deviceName,
      templateId,
      gatewayId,
      organizationId: orgId,
      switchState: 'ON',
      status: 'OFFLINE',
      seedCurrentValues: false,
    })
    return device
  })
}

async function ensureGroups(orgId, deviceRows, creatorId) {
  const allIds = deviceRows.map((d) => d.id)

  async function upsertGroup(name, description, deviceIds) {
    let group = await prisma.deviceGroup.findFirst({
      where: { organizationId: orgId, name },
    })
    if (!group) {
      group = await prisma.deviceGroup.create({
        data: {
          name,
          description,
          organizationId: orgId,
          createdBy: creatorId || null,
          isActive: true,
        },
      })
    }
    for (const deviceId of deviceIds) {
      await prisma.deviceGroupDevice.upsert({
        where: {
          deviceGroupId_deviceId: { deviceGroupId: group.id, deviceId },
        },
        create: { deviceGroupId: group.id, deviceId },
        update: {},
      })
    }
    return group
  }

  const fleet = await upsertGroup(
    'MQTT Fleet',
    'All devices discovered from the MQTT bridge topic',
    allIds,
  )

  const byName = new Map()
  for (const d of deviceRows) {
    const list = byName.get(d.name) || []
    list.push(d.id)
    byName.set(d.name, list)
  }
  const named = []
  for (const [name, ids] of byName) {
    named.push(await upsertGroup(`MQTT · ${name}`, `Devices named ${name}`, ids))
  }

  return { fleet, named }
}

async function main() {
  console.log({ HOST, PORT, TOPIC, SECONDS, ORG_NAME, DRY })

  const org = await prisma.organization.findFirst({
    where: { name: { contains: ORG_NAME, mode: 'insensitive' } },
  }) || await prisma.organization.findFirst()
  if (!org) throw new Error('No organization found')

  const admin = await prisma.user.findFirst({
    where: { organizationId: org.id, role: { in: ['ORG_ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
  })

  const samples = await sampleMqtt()
  console.log(`\nDiscovered ${samples.length} unique device(s):`)
  for (const s of samples) {
    const slaveSummary = [...s.slaves.entries()]
      .map(([n, regs]) => `${n}(${regs.size} regs)`)
      .join(', ')
    console.log(`  - ${s.device}  serial=${s.serial}  slaves=[${slaveSummary}]`)
  }

  if (!samples.length) {
    console.log('No MQTT devices seen — nothing to provision.')
    return
  }

  if (DRY) {
    console.log('Dry-run: skipping DB writes.')
    return
  }

  const createdDevices = []
  for (const s of samples) {
    const template = await upsertTemplate(org.id, s.device, s.slaves)
    const gateway = await upsertGateway(org.id, s.serial, s.device)
    const device = await ensureDevice(org.id, template.id, gateway.id, s.device)
    createdDevices.push(device)
    console.log(`Provisioned device ${device.name} (${device.id})`)
  }

  const groups = await ensureGroups(org.id, createdDevices, admin?.id)
  console.log(`Groups: ${groups.fleet.name} + ${groups.named.length} named groups`)
  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
