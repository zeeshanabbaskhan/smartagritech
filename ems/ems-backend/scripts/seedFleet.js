/**
 * Seed a production-scale device fleet across multiple gateways.
 *
 * Prerequisites: npm run seed (org, template, users must exist)
 *
 * Usage:
 *   npm run seed:fleet
 *   node scripts/seedFleet.js --devices 100 --gateways 10
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const prisma = require('../config/database')
const { provisionDevice } = require('../utils/provisionDevice')

const parseArgs = () => {
  const args = process.argv.slice(2)
  const opts = {
    devices: Number(process.env.FLEET_DEVICE_COUNT) || 100,
    gateways: Number(process.env.FLEET_GATEWAY_COUNT) || 10,
    orgName: process.env.FLEET_ORG_NAME || 'Smart Agritech Lab',
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--devices') opts.devices = Number(args[++i]) || opts.devices
    else if (args[i] === '--gateways') opts.gateways = Number(args[++i]) || opts.gateways
    else if (args[i] === '--org') opts.orgName = args[++i] || opts.orgName
  }
  return opts
}

const gatewayModels = ['N510', 'N520', 'EG5000', 'RUT241', 'Moxa-IA240']

async function ensureGateways(orgId, count) {
  const gateways = []
  for (let i = 1; i <= count; i++) {
    const serial = `GW-FLEET-${String(i).padStart(3, '0')}`
    const gw = await prisma.gateway.upsert({
      where: { serialNumber: serial },
      update: { name: `Site Gateway ${String(i).padStart(2, '0')}` },
      create: {
        name: `Site Gateway ${String(i).padStart(2, '0')}`,
        serialNumber: serial,
        model: gatewayModels[(i - 1) % gatewayModels.length],
        status: i % 3 === 0 ? 'OFFLINE' : 'ONLINE',
        organizationId: orgId,
        lastSeenAt: new Date(),
      },
    })
    gateways.push(gw)
  }
  return gateways
}

async function main() {
  const opts = parseArgs()
  const org = await prisma.organization.findFirst({ where: { name: opts.orgName } })
  if (!org) {
    console.error(`Organization not found: ${opts.orgName}. Run npm run seed first.`)
    process.exit(1)
  }

  const template = await prisma.deviceTemplate.findFirst({
    where: { organizationId: org.id, name: 'Agritech Energy Monitor' },
  })
  if (!template) {
    console.error('Device template "Agritech Energy Monitor" not found. Run npm run seed first.')
    process.exit(1)
  }

  const regularUser = await prisma.user.findFirst({ where: { email: 'user@ems.com' } })
  const orgAdmin = await prisma.user.findFirst({ where: { email: 'orgadmin@ems.com' } })

  const gateways = await ensureGateways(org.id, opts.gateways)
  console.log(`Gateways: ${gateways.length}`)

  const existing = await prisma.device.count({ where: { organizationId: org.id } })
  const toCreate = Math.max(0, opts.devices - existing)
  if (!toCreate) {
    console.log(`Fleet already has ${existing} device(s) (target ${opts.devices}). Nothing to add.`)
    await prisma.$disconnect()
    return
  }

  console.log(`Creating ${toCreate} device(s) across ${gateways.length} gateway(s)...`)
  const startIndex = existing + 1
  const batchSize = 10
  let created = 0

  for (let batch = 0; batch < toCreate; batch += batchSize) {
    const chunk = Math.min(batchSize, toCreate - batch)
    await prisma.$transaction(async (tx) => {
      for (let j = 0; j < chunk; j++) {
        const n = startIndex + batch + j
        const gw = gateways[(n - 1) % gateways.length]
        const name = `Energy Meter ${String(n).padStart(3, '0')}`
        const { device } = await provisionDevice(tx, {
          name,
          templateId: template.id,
          gatewayId: gw.id,
          organizationId: org.id,
          switchState: n % 5 === 0 ? 'ON' : 'OFF',
          status: n % 7 === 0 ? 'OFFLINE' : 'ONLINE',
        })

        if (regularUser && n % 3 === 0) {
          await tx.deviceUser.upsert({
            where: { deviceId_userId: { deviceId: device.id, userId: regularUser.id } },
            update: {},
            create: {
              deviceId: device.id,
              userId: regularUser.id,
              organizationId: org.id,
              assignedBy: orgAdmin?.id,
            },
          })
        }
        created++
      }
    })
    process.stdout.write(`\r  provisioned ${created}/${toCreate}`)
  }

  console.log(`\n✓ Fleet ready: ${existing + created} devices on ${gateways.length} gateways`)
  console.log('  Run: npm run simulate:devices  (with Redis for batch ingest)')
}

main()
  .catch(async (err) => {
    console.error('Fleet seed error:', err.message || err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
