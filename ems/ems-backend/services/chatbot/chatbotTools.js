/**
 * Org-scoped EMS query tools backed by Prisma.
 * Authorization comes from ctx.organizationId (JWT) — never from LLM args alone.
 */

const prisma = require('../../config/database')

async function resolveOrg(ctx, orgName) {
  if (ctx.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, name: true, description: true, status: true },
    })
    if (!org) return { error: 'Organization not found for this account' }
    return { org }
  }

  if (orgName) {
    const org = await prisma.organization.findFirst({
      where: { name: { contains: orgName, mode: 'insensitive' } },
      select: { id: true, name: true, description: true, status: true },
    })
    if (!org) return { error: `No organization found matching "${orgName}"` }
    return { org }
  }

  return { error: 'Organization context is required' }
}

async function findDeviceInOrg(orgId, deviceName) {
  return prisma.device.findFirst({
    where: {
      organizationId: orgId,
      name: { contains: deviceName, mode: 'insensitive' },
    },
    include: {
      gateway: { select: { id: true, name: true, status: true } },
      organization: { select: { name: true } },
    },
  })
}

async function getOrgSummary(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved

  const [devices, gateways] = await Promise.all([
    prisma.device.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        name: true,
        status: true,
        gateway: { select: { name: true } },
      },
    }),
    prisma.gateway.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, status: true },
    }),
  ])

  const online = devices.filter((d) => d.status === 'ONLINE').length
  const offline = devices.filter((d) => d.status === 'OFFLINE').length

  return {
    name: org.name,
    description: org.description,
    status: org.status,
    totalDevices: devices.length,
    onlineDevices: online,
    offlineDevices: offline,
    totalGateways: gateways.length,
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      gatewayName: d.gateway?.name ?? null,
    })),
    gateways: gateways.map((g) => ({ id: g.id, name: g.name, status: g.status })),
  }
}

async function listDevicesForOrg(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved

  const where = { organizationId: org.id }
  if (args.statusFilter) where.status = String(args.statusFilter).toUpperCase()

  const devices = await prisma.device.findMany({
    where,
    select: {
      name: true,
      status: true,
      switchState: true,
      lastDataReceivedAt: true,
      gateway: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })

  return {
    organization: org.name,
    count: devices.length,
    devices: devices.map((d) => ({
      name: d.name,
      status: d.status,
      gatewayName: d.gateway?.name ?? null,
      switchState: d.switchState,
      lastDataReceivedAt: d.lastDataReceivedAt,
    })),
  }
}

async function getDeviceStatus(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved

  const device = await findDeviceInOrg(org.id, args.deviceName)
  if (!device) return { error: `No device found matching "${args.deviceName}"` }

  return {
    name: device.name,
    status: device.status,
    switchState: device.switchState,
    organization: device.organization?.name ?? org.name,
    gateway: device.gateway
      ? { name: device.gateway.name, status: device.gateway.status }
      : null,
    lastDataReceivedAt: device.lastDataReceivedAt,
  }
}

async function getVariableValue(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved

  const device = await findDeviceInOrg(org.id, args.deviceName)
  if (!device) return { error: `No device found matching "${args.deviceName}"` }

  const where = { deviceId: device.id, organizationId: org.id }
  if (args.variableName) {
    where.name = { contains: args.variableName, mode: 'insensitive' }
  }

  const vars = await prisma.deviceConfigVariable.findMany({
    where,
    select: {
      name: true,
      displayName: true,
      currentValue: true,
      unit: true,
      lastUpdatedAt: true,
    },
    take: 50,
  })

  if (vars.length === 0) {
    return {
      error: args.variableName
        ? `No variable "${args.variableName}" found on device "${device.name}"`
        : `No variables found on device "${device.name}"`,
    }
  }

  return {
    device: device.name,
    status: device.status,
    variables: vars,
  }
}

async function getActiveAlarms(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved

  const where = { organizationId: org.id }
  if (args.alarmState) where.alarmState = String(args.alarmState).toUpperCase()

  const limit = Math.min(100, Math.max(1, parseInt(args.limit, 10) || 25))

  const alarms = await prisma.deviceVariableAlarmHistory.findMany({
    where,
    orderBy: { alarmTime: 'desc' },
    take: limit,
    include: {
      device: { select: { name: true } },
    },
  })

  return {
    count: alarms.length,
    alarms: alarms.map((a) => ({
      deviceName: a.device?.name ?? null,
      organizationName: org.name,
      variableName: a.variableName,
      triggerName: a.triggerName,
      currentValue: a.currentValue,
      triggeringCondition: a.triggeringCondition,
      alarmState: a.alarmState,
      processState: a.processState,
      alarmTime: a.alarmTime,
    })),
  }
}

async function getEnergyConsumption(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved

  const where = { organizationId: org.id }

  if (args.deviceName) {
    const device = await findDeviceInOrg(org.id, args.deviceName)
    if (!device) return { error: `No device found matching "${args.deviceName}"` }
    where.deviceId = device.id
  }

  if (args.lastDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(args.lastDays, 10))
    where.startDate = { gte: cutoff }
  }

  const records = await prisma.intervalHistory.findMany({
    where,
    orderBy: { startDate: 'desc' },
    take: 5000,
    include: { device: { select: { name: true } } },
  })

  const byDevice = {}
  for (const r of records) {
    const deviceName = r.device?.name || 'Unknown'
    if (!byDevice[deviceName]) {
      byDevice[deviceName] = {
        deviceName,
        organization: org.name,
        totalKwh: 0,
        totalTariff: 0,
        days: 0,
        records: [],
      }
    }
    byDevice[deviceName].totalKwh += r.totalUnit || 0
    byDevice[deviceName].totalTariff += r.tariff || 0
    byDevice[deviceName].days += 1
    if (byDevice[deviceName].records.length < 10) {
      byDevice[deviceName].records.push({
        date: r.startDate.toISOString().slice(0, 10),
        kwh: (r.totalUnit || 0).toFixed(2),
        tariff: (r.tariff || 0).toFixed(2),
      })
    }
  }

  const summary = Object.values(byDevice).map((d) => ({
    ...d,
    totalKwh: d.totalKwh.toFixed(2),
    totalTariff: d.totalTariff.toFixed(2),
  }))

  return {
    count: summary.length,
    period: args.lastDays ? `last ${args.lastDays} days` : 'all available',
    devices: summary,
  }
}

async function getGatewayStatus(args, ctx) {
  const resolved = await resolveOrg(ctx, args.orgName)
  if (resolved.error) return resolved
  const { org } = resolved

  const where = { organizationId: org.id }
  if (args.statusFilter) where.status = String(args.statusFilter).toUpperCase()

  const gateways = await prisma.gateway.findMany({
    where,
    include: {
      _count: { select: { devices: true } },
    },
  })

  return {
    count: gateways.length,
    gateways: gateways.map((g) => ({
      name: g.name,
      status: g.status,
      model: g.model,
      organization: org.name,
      lastSeenAt: g.lastSeenAt,
      deviceCount: g._count.devices,
    })),
  }
}

async function getUserDevices(args, ctx) {
  const email = String(args.userEmail || '').toLowerCase()
  if (!email) return { error: 'userEmail is required' }

  const userWhere = { email: { equals: email, mode: 'insensitive' } }
  if (ctx.organizationId) userWhere.organizationId = ctx.organizationId

  const user = await prisma.user.findFirst({ where: userWhere })
  if (!user) return { error: `No user found with email "${args.userEmail}"` }

  const assignments = await prisma.deviceUser.findMany({
    where: {
      userId: user.id,
      ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
    },
    include: {
      device: {
        select: {
          name: true,
          status: true,
          organization: { select: { name: true } },
        },
      },
    },
  })

  const devices = assignments
    .map((du) =>
      du.device
        ? {
            name: du.device.name,
            status: du.device.status,
            organization: du.device.organization?.name ?? null,
          }
        : null
    )
    .filter(Boolean)

  return {
    user: user.fullName,
    email: user.email,
    deviceCount: devices.length,
    devices,
  }
}

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

async function callTool(name, args, ctx = {}) {
  const fn = TOOLS[name]
  if (!fn) return { error: `Unknown tool: ${name}` }
  try {
    return await fn(args || {}, ctx)
  } catch (err) {
    console.error(`[chatbotTools] ${name}`, err)
    return { error: err.message }
  }
}

module.exports = { callTool, TOOLS, resolveOrg }
