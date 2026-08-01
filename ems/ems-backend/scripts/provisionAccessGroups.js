/**
 * Create sample Access Groups for an org (SUPER_ADMIN-owned).
 * Assigns devices + USER-role members so org/user ACL can be tested.
 *
 * Usage:
 *   node scripts/provisionAccessGroups.js
 *   node scripts/provisionAccessGroups.js --org "Smart Agritech Lab"
 *   node scripts/provisionAccessGroups.js --dry-run
 *   node scripts/provisionAccessGroups.js --reset   # delete groups named AG · * first
 */
require('dotenv').config()
const prisma = require('../config/database')

const args = process.argv.slice(2)
const flag = (name, def = null) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return def
  return args[i + 1] ?? def
}
const has = (name) => args.includes(`--${name}`)

const ORG_NAME = flag('org', process.env.ORG_NAME || 'Smart Agritech Lab')
const DRY = has('dry-run')
const RESET = has('reset')
const PREFIX = 'AG · '

async function main() {
  let org = await prisma.organization.findFirst({
    where: { name: { contains: ORG_NAME, mode: 'insensitive' } },
  })
  if (!org) org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!org) throw new Error('No organization found')

  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', status: { not: 'DELETED' } },
    orderBy: { createdAt: 'asc' },
  })
  if (!superAdmin) throw new Error('No SUPER_ADMIN user found (needed as Access Group creator)')

  const devices = await prisma.device.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  const users = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      status: { not: 'DELETED' },
      role: { in: ['USER', 'ORG_ADMIN'] },
    },
    select: { id: true, fullName: true, email: true, role: true },
    orderBy: { fullName: 'asc' },
  })
  const siteUsers = users.filter((u) => u.role === 'USER')
  const members = siteUsers.length ? siteUsers : users

  console.log(`Org: ${org.name} (${org.id})`)
  console.log(`Creator: ${superAdmin.email} (${superAdmin.role})`)
  console.log(`Devices: ${devices.length} | Members (USER preferred): ${members.length}`)

  if (!devices.length) throw new Error('No devices in org — add devices first')

  if (RESET) {
    const existing = await prisma.accessGroup.findMany({
      where: { organizationId: org.id, name: { startsWith: PREFIX } },
      select: { id: true, name: true },
    })
    console.log(`Reset: deleting ${existing.length} access group(s) with prefix "${PREFIX}"`)
    if (!DRY && existing.length) {
      await prisma.accessGroup.deleteMany({ where: { id: { in: existing.map((g) => g.id) } } })
    }
  }

  // Split fleet into a few sensible access groups
  const half = Math.ceil(devices.length / 2)
  const plans = [
    {
      name: `${PREFIX}All Devices`,
      deviceIds: devices.map((d) => d.id),
      userIds: members.map((u) => u.id),
      note: 'Full fleet access',
    },
    {
      name: `${PREFIX}Furnace Line`,
      deviceIds: devices
        .filter((d) => /furnace|supra|fico(?!ev)/i.test(d.name))
        .map((d) => d.id),
      userIds: members.slice(0, Math.max(1, Math.ceil(members.length / 2))).map((u) => u.id),
      note: 'Furnace / industrial load devices',
    },
    {
      name: `${PREFIX}EV & Panels`,
      deviceIds: devices
        .filter((d) => /ev|panel|ems|cfsmart|japane|gulshan/i.test(d.name))
        .map((d) => d.id),
      userIds: members.slice(Math.floor(members.length / 2)).map((u) => u.id),
      note: 'EV chargers, EMS panels, site monitors',
    },
    {
      name: `${PREFIX}Site A`,
      deviceIds: devices.slice(0, half).map((d) => d.id),
      userIds: members.slice(0, 1).map((u) => u.id),
      note: 'First half of devices',
    },
    {
      name: `${PREFIX}Site B`,
      deviceIds: devices.slice(half).map((d) => d.id),
      userIds: members.slice(-1).map((u) => u.id),
      note: 'Second half of devices',
    },
  ].map((p) => ({
    ...p,
    // Ensure every group has ≥1 device; fall back to first device if filter empty
    deviceIds: p.deviceIds.length ? [...new Set(p.deviceIds)] : [devices[0].id],
    userIds: [...new Set(p.userIds.filter(Boolean))],
  }))

  for (const plan of plans) {
    const already = await prisma.accessGroup.findFirst({
      where: { organizationId: org.id, name: plan.name },
      select: { id: true },
    })
    if (already) {
      console.log(`skip  ${plan.name} (exists)`)
      continue
    }
    console.log(
      `${DRY ? 'dry' : 'create'} ${plan.name} — ${plan.deviceIds.length} device(s), ${plan.userIds.length} user(s) — ${plan.note}`,
    )
    if (DRY) continue

    await prisma.accessGroup.create({
      data: {
        name: plan.name,
        organizationId: org.id,
        createdBy: superAdmin.id,
        devices: { create: plan.deviceIds.map((deviceId) => ({ deviceId })) },
        users: { create: plan.userIds.map((userId) => ({ userId })) },
      },
    })
  }

  const final = await prisma.accessGroup.findMany({
    where: { organizationId: org.id },
    include: {
      _count: { select: { devices: true, users: true } },
      creator: { select: { role: true, email: true } },
    },
    orderBy: { name: 'asc' },
  })
  console.log('\nAccess groups now:')
  for (const g of final) {
    console.log(
      `  • ${g.name} — ${g._count.devices} devices, ${g._count.users} users (by ${g.creator?.role || '—'})`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
