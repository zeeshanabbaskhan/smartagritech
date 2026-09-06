const prisma = require('../config/database')
const redis = require('../config/redis')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const { listAccessibleDeviceIds } = require('../utils/deviceAccess')
const { readLatestMerged, readLatestForSlave } = require('../utils/redisLatest')

const resolveOrgId = (req, bodyOrgId) => {
  if (req.user.role === 'SUPER_ADMIN') return bodyOrgId || req.query.organizationId
  return req.user.organizationId
}

const POWER_PRIORITY_KEYS = [
  'total power',
  'activepower',
  'total active power',
  'totalactivepower',
  'active power',
  'activepowertotal',
  'totalkw',
  'power',
  'kw',
  'total_power',
  'active_power',
  'powerconsumption',
  'power consumption',
]

const EXPORT_PRIORITY_KEYS = [
  'exportpower',
  'export active power',
  'exportactivepower',
  'solarpower',
  'solar power',
  'export_power',
  'solar_power',
]

/**
 * Robust normalizer:
 * Ingest formulas in this system store kW-scale values (e.g. 16.9 kW, 57.2 kW, 103.9 kW).
 * If raw value is extremely high (>= 200,000), it indicates raw micro-units or milliwatts -> divide by 1000.
 * Otherwise, preserve directly as kW.
 * Use Math.abs to handle reverse CT clamp wiring.
 */
const normalizeToKw = (val) => {
  const n = parseFloat(val)
  if (!Number.isFinite(n)) return 0
  const abs = Math.abs(n)
  if (abs >= 200000) return +(abs / 1000).toFixed(3)
  return +abs.toFixed(3)
}

/**
 * Universal multi-tier extraction of instantaneous active power (kW) from any variable map.
 */
const extractKwFromVariables = (varMap = {}, isExport = false) => {
  if (!varMap || typeof varMap !== 'object') return 0

  // 1. Build a lowercased, trimmed lookup map
  const normalized = {}
  for (const [k, v] of Object.entries(varMap)) {
    if (v != null && v !== '') {
      normalized[k.trim().toLowerCase()] = v
    }
  }

  const priorityKeys = isExport ? EXPORT_PRIORITY_KEYS : POWER_PRIORITY_KEYS

  // Tier 1: Check primary total active power registers
  for (const key of priorityKeys) {
    if (normalized[key] != null) {
      const kw = normalizeToKw(normalized[key])
      if (kw > 0) return kw
    }
  }

  // Tier 2: Check 3-phase split power registers (PowerA + PowerB + PowerC or Power1 + Power2 + Power3)
  const pA = normalized['powera'] ?? normalized['power a'] ?? normalized['power_a'] ?? normalized['p1'] ?? normalized['power1']
  const pB = normalized['powerb'] ?? normalized['power b'] ?? normalized['power_b'] ?? normalized['p2'] ?? normalized['power2']
  const pC = normalized['powerc'] ?? normalized['power c'] ?? normalized['power_c'] ?? normalized['p3'] ?? normalized['power3']

  if (pA != null || pB != null || pC != null) {
    const sumPhase = (normalizeToKw(pA) || 0) + (normalizeToKw(pB) || 0) + (normalizeToKw(pC) || 0)
    if (sumPhase > 0) return +sumPhase.toFixed(3)
  }

  // Tier 3: Check Apparent Power x Power Factor (S * PF)
  const appPower = normalized['total apparent power'] ?? normalized['totalapparentpower'] ?? normalized['apparent power'] ?? normalized['apparentpower'] ?? normalized['s']
  const pf = normalized['power factor'] ?? normalized['powerfactor'] ?? normalized['pf'] ?? normalized['total power factor']
  if (appPower != null) {
    const sVal = normalizeToKw(appPower)
    const pfVal = pf != null ? Math.min(1, Math.max(0, Math.abs(parseFloat(pf)) || 1)) : 0.95
    if (sVal > 0) return +(sVal * pfVal).toFixed(3)
  }

  // Tier 4: Check V x I calculation from live currents and voltages
  const iA = parseFloat(normalized['current a'] ?? normalized['currenta'] ?? normalized['ia'] ?? normalized['current 1'] ?? 0) || 0
  const iB = parseFloat(normalized['current b'] ?? normalized['currentb'] ?? normalized['ib'] ?? normalized['current 2'] ?? 0) || 0
  const iC = parseFloat(normalized['current c'] ?? normalized['currentc'] ?? normalized['ic'] ?? normalized['current 3'] ?? 0) || 0

  const totalCurrent = Math.abs(iA) + Math.abs(iB) + Math.abs(iC)
  if (totalCurrent > 0.1) {
    const vA = parseFloat(normalized['voltage'] ?? normalized['voltagea'] ?? normalized['va'] ?? normalized['voltage 1'] ?? 230) || 230
    const vB = parseFloat(normalized['voltageb'] ?? normalized['vb'] ?? normalized['voltage 2'] ?? 230) || 230
    const vC = parseFloat(normalized['voltagec'] ?? normalized['vc'] ?? normalized['voltage 3'] ?? 230) || 230

    const pfVal = pf != null ? Math.min(1, Math.max(0, Math.abs(parseFloat(pf)) || 1)) : 0.9
    const calcKw = ((Math.abs(iA) * Math.abs(vA) + Math.abs(iB) * Math.abs(vB) + Math.abs(iC) * Math.abs(vC)) * pfVal) / 1000
    if (calcKw > 0) return +calcKw.toFixed(3)
  }

  return 0
}

/** Prefer ActivePower, then PowerConsumption from Redis or DB current values. */
const readDeviceLoadKw = async (deviceId) => {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { switchState: true },
  })
  if (String(device?.switchState || '').toUpperCase() === 'OFF') return 0

  const varMap = {}

  const c = redis.getClient()
  if (c) {
    try {
      const hot = await readLatestMerged(deviceId)
      if (hot && Object.keys(hot).length) {
        Object.assign(varMap, hot)
      }
    } catch (_) {}
  }

  try {
    const vars = await prisma.deviceConfigVariable.findMany({
      where: { deviceId, isActive: true },
      select: { name: true, currentValue: true },
    })
    for (const v of vars) {
      if (v.currentValue != null && v.currentValue !== '' && varMap[v.name] === undefined) {
        varMap[v.name] = v.currentValue
      }
    }
  } catch (_) {}

  return extractKwFromVariables(varMap)
}

/** Read ActivePower for a specific slave from Redis hot hash or DB variables. */
const readSlaveLoadKw = async (deviceId, slaveId) => {
  if (!slaveId) return 0
  if (deviceId) {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { switchState: true },
    })
    if (String(device?.switchState || '').toUpperCase() === 'OFF') return 0
  }

  const varMap = {}

  const c = redis.getClient()
  if (c && deviceId) {
    try {
      const hot = await readLatestForSlave(deviceId, slaveId)
      if (hot && Object.keys(hot).length) {
        Object.assign(varMap, hot)
      }
    } catch (_) {}
  }

  try {
    const vars = await prisma.deviceConfigVariable.findMany({
      where: { deviceConfigSlaveId: slaveId, isActive: true },
      select: { name: true, currentValue: true },
    })
    for (const v of vars) {
      if (v.currentValue != null && v.currentValue !== '' && varMap[v.name] === undefined) {
        varMap[v.name] = v.currentValue
      }
    }
  } catch (_) {}

  return extractKwFromVariables(varMap)
}

const sumLoadsForSlavesAndDevices = async (deviceIds = [], slaveIds = []) => {
  const safeDeviceIds = [...new Set((deviceIds || []).filter(Boolean))]
  const safeSlaveIds = [...new Set((slaveIds || []).filter(Boolean))]

  let total = 0
  if (safeSlaveIds.length) {
    const slaves = await prisma.deviceConfigSlave.findMany({
      where: { id: { in: safeSlaveIds } },
      select: { id: true, deviceId: true },
    })
    for (const s of slaves) {
      total += await readSlaveLoadKw(s.deviceId, s.id)
    }
  }

  if (safeDeviceIds.length) {
    for (const id of safeDeviceIds) {
      total += await readDeviceLoadKw(id)
    }
  }

  return Math.round(total * 100) / 100
}

const sumLoadsForDeviceIds = async (deviceIds) => {
  return sumLoadsForSlavesAndDevices(deviceIds, [])
}

/** Read ExportPower (solar/export) for a device — Redis then DB. */
const readDeviceExportKw = async (deviceId) => {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { switchState: true },
  })
  if (String(device?.switchState || '').toUpperCase() === 'OFF') return 0

  const varMap = {}

  const c = redis.getClient()
  if (c) {
    try {
      const hot = await readLatestMerged(deviceId)
      if (hot && Object.keys(hot).length) {
        Object.assign(varMap, hot)
      }
    } catch (_) {}
  }

  try {
    const vars = await prisma.deviceConfigVariable.findMany({
      where: { deviceId, isActive: true },
      select: { name: true, currentValue: true },
    })
    for (const v of vars) {
      if (v.currentValue != null && v.currentValue !== '' && varMap[v.name] === undefined) {
        varMap[v.name] = v.currentValue
      }
    }
  } catch (_) {}

  return extractKwFromVariables(varMap, true)
}

const sumExportForDeviceIds = async (deviceIds) => {
  if (!deviceIds?.length) return 0
  let total = 0
  for (const id of deviceIds) total += await readDeviceExportKw(id)
  return Math.round(total * 100) / 100
}

const listDashboards = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate({ ...req.query, limit: req.query.limit || 100 })
    const orgId = resolveOrgId(req)
    if (!orgId && req.user.role !== 'SUPER_ADMIN') {
      return next(new AppError('No organization', 400))
    }

    const where = { ...orgScope(req.user, req.query.organizationId) }
    // USER sees own + shared; managers see all in org
    if (req.user.role === 'USER') {
      where.OR = [
        { ownerUserId: req.user.id },
        { visibility: 'SHARED' },
      ]
    }

    const [data, total] = await Promise.all([
      prisma.customDashboard.findMany({
        where, skip, take: limit, orderBy: { updatedAt: 'desc' },
        include: { owner: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.customDashboard.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) || 1 })
  } catch (err) { next(err) }
}

const getDashboard = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const data = await prisma.customDashboard.findFirst({
      where,
      include: { owner: { select: { id: true, fullName: true, email: true } } },
    })
    if (!data) return next(new AppError('Dashboard not found', 404))
    if (
      req.user.role === 'USER' &&
      data.ownerUserId !== req.user.id &&
      data.visibility !== 'SHARED'
    ) {
      return next(new AppError('Dashboard not found', 404))
    }
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const createDashboard = async (req, res, next) => {
  try {
    const {
      name, description, visibility, context, layout, widgets,
      targetDeviceId, organizationId,
    } = req.body
    const orgId = resolveOrgId(req, organizationId)
    if (!orgId) return next(new AppError('organizationId is required', 400))
    if (!name?.trim()) return next(new AppError('name is required', 400))

    let vis = 'PRIVATE'
    if (visibility === 'SHARED' || visibility === 'PRIVATE') vis = visibility
    else if (req.user.role === 'SUPER_ADMIN') vis = 'SHARED'

    const data = await prisma.customDashboard.create({
      data: {
        name: name.trim(),
        description: description || null,
        visibility: vis,
        context: context || {},
        layout: layout || [],
        widgets: widgets || [],
        targetDeviceId: targetDeviceId || null,
        organizationId: orgId,
        ownerUserId: req.user.id,
      },
      include: { owner: { select: { id: true, fullName: true, email: true } } },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

const updateDashboard = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    if (req.user.role === 'USER') {
      where.OR = [{ ownerUserId: req.user.id }, { visibility: 'SHARED' }]
    }
    const existing = await prisma.customDashboard.findFirst({ where })
    if (!existing) return next(new AppError('Dashboard not found', 404))

    const isOwner = existing.ownerUserId === req.user.id
    const isManager = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ORG_ADMIN'

    const {
      name, description, visibility, context, layout, widgets, targetDeviceId,
    } = req.body

    // Non-owners may only toggle their own favorite flag (stored in context.favorites).
    if (!isOwner && !isManager) {
      const otherFields = [name, description, visibility, layout, widgets, targetDeviceId]
        .some((v) => v !== undefined)
      if (otherFields || context === undefined) {
        return next(new AppError('Not allowed to edit this dashboard', 403))
      }
      const prev = typeof existing.context === 'object' && existing.context ? existing.context : {}
      const favorites = {
        ...(prev.favorites && typeof prev.favorites === 'object' ? prev.favorites : {}),
      }
      const want = !!(context?.favorites?.[req.user.id] ?? context?.favorite)
      if (want) favorites[req.user.id] = true
      else delete favorites[req.user.id]
      const { favorite: _legacy, ...rest } = prev
      const data = await prisma.customDashboard.update({
        where: { id: existing.id },
        data: { context: { ...rest, favorites } },
        include: { owner: { select: { id: true, fullName: true, email: true } } },
      })
      return res.json({ success: true, data })
    }

    let vis
    if (visibility !== undefined) {
      if (visibility !== 'SHARED' && visibility !== 'PRIVATE') {
        return next(new AppError('visibility must be SHARED or PRIVATE', 400))
      }
      vis = visibility
    }

    const data = await prisma.customDashboard.update({
      where: { id: existing.id },
      data: {
        name: name?.trim() || undefined,
        description: description !== undefined ? description : undefined,
        visibility: vis,
        context: context !== undefined ? context : undefined,
        layout: layout !== undefined ? layout : undefined,
        widgets: widgets !== undefined ? widgets : undefined,
        targetDeviceId: targetDeviceId !== undefined ? targetDeviceId : undefined,
      },
      include: { owner: { select: { id: true, fullName: true, email: true } } },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const deleteDashboard = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.customDashboard.findFirst({ where })
    if (!existing) return next(new AppError('Dashboard not found', 404))

    const isOwner = existing.ownerUserId === req.user.id
    const isManager = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ORG_ADMIN'
    if (!isOwner && !isManager) return next(new AppError('Not allowed to delete this dashboard', 403))

    await prisma.customDashboard.delete({ where: { id: existing.id } })
    res.json({ success: true, message: 'Dashboard deleted' })
  } catch (err) { next(err) }
}

const getPowerFlow = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req)
    if (!orgId) return next(new AppError('organizationId is required', 400))

    let config = await prisma.powerFlowConfig.findUnique({ where: { organizationId: orgId } })
    if (!config) {
      config = await prisma.powerFlowConfig.create({
        data: {
          organizationId: orgId,
          sources: [
            { id: 'grid', name: 'Grid', type: 'grid', valueKw: 0 },
            { id: 'solar', name: 'Solar', type: 'solar', valueKw: 0 },
            { id: 'generator', name: 'Generator', type: 'generator', valueKw: 0 },
          ],
          savings: { daily: 0, weekly: 0, monthly: 0, unit: 'PKR' },
        },
      })
    }

    const accessibleIds = await listAccessibleDeviceIds(req.user)
    const allowedSet = accessibleIds ? new Set(accessibleIds) : null

    const groups = await prisma.deviceGroup.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        devices: { include: { device: { select: { id: true, name: true, status: true } } } },
        slaves: {
          include: {
            slave: {
              select: {
                id: true,
                name: true,
                deviceId: true,
                isDefault: true,
                device: { select: { id: true, name: true, status: true } },
              },
            },
          },
        },
      },
    })

    const mappedGroups = []
    const allDeviceIds = new Set()
    for (const g of groups) {
      const deviceRows = allowedSet
        ? (g.devices || []).filter((d) => allowedSet.has(d.deviceId))
        : (g.devices || [])
      const slaveRows = allowedSet
        ? (g.slaves || []).filter((s) => !s.slave?.deviceId || allowedSet.has(s.slave.deviceId))
        : (g.slaves || [])

      // USER: omit groups with no accessible devices/slaves
      if (allowedSet && !deviceRows.length && !slaveRows.length) continue

      const deviceIds = deviceRows.map((d) => d.deviceId)
      const slaveIds = slaveRows.map((s) => s.slaveId)
      deviceIds.forEach((id) => allDeviceIds.add(id))
      slaveRows.forEach((s) => s.slave?.deviceId && allDeviceIds.add(s.slave.deviceId))

      const loadKw = await sumLoadsForSlavesAndDevices(deviceIds, slaveIds)
      mappedGroups.push({
        id: g.id,
        name: g.name,
        description: g.description,
        deviceCount: deviceRows.length,
        slaveCount: slaveRows.length,
        deviceIds,
        slaveIds,
        devices: deviceRows.map((d) => d.device),
        slaves: slaveRows.map((s) => ({
          id: s.slave?.id,
          name: s.slave?.name,
          deviceId: s.slave?.deviceId,
          deviceName: s.slave?.device?.name,
          deviceStatus: s.slave?.device?.status,
          isDefault: s.slave?.isDefault,
        })),
        loadKw,
        load: loadKw,
      })
    }

    // Also include org devices not in groups for source totals (ACL-filtered for USER)
    const orgDevices = await prisma.device.findMany({
      where: {
        organizationId: orgId,
        ...(allowedSet ? { id: { in: [...allowedSet] } } : {}),
      },
      select: { id: true },
    })
    orgDevices.forEach((d) => allDeviceIds.add(d.id))
    const allIds = [...allDeviceIds]
    const totalLoadKw = await sumLoadsForDeviceIds(allIds)

    let sources = Array.isArray(config.sources) ? config.sources.map((s) => ({ ...s })) : []
    // Ensure builtins exist
    for (const b of [
      { id: 'grid', name: 'Grid', type: 'grid' },
      { id: 'solar', name: 'Solar', type: 'solar' },
      { id: 'generator', name: 'Generator', type: 'generator' },
    ]) {
      if (!sources.some((s) => s.type === b.type || s.id === b.id)) {
        sources.push({ ...b, deviceIds: [], slaveIds: [], valueKw: 0 })
      }
    }

    // Fill live kW from linked devices and slaves when present; otherwise 0 (including Grid)
    for (const s of sources) {
      const devIds = Array.isArray(s.deviceIds)
        ? s.deviceIds.filter((id) => id && (!allowedSet || allowedSet.has(id)))
        : []
      const slvIds = Array.isArray(s.slaveIds) ? s.slaveIds.filter(Boolean) : []
      s.deviceIds = Array.isArray(s.deviceIds) ? s.deviceIds.filter(Boolean) : []
      s.slaveIds = Array.isArray(s.slaveIds) ? s.slaveIds.filter(Boolean) : []

      if (devIds.length || slvIds.length) {
        s.valueKw = await sumLoadsForSlavesAndDevices(devIds, slvIds)
        s.liveDerived = true
      } else {
        s.valueKw = 0
        s.derived = false
      }
    }

    const solarKw = Number(sources.find((s) => s.type === 'solar' || s.id === 'solar')?.valueKw) || 0
    const gridKw = Number(sources.find((s) => s.type === 'grid' || s.id === 'grid')?.valueKw) || 0

    res.json({
      success: true,
      data: {
        sources,
        savings: config.savings,
        groups: mappedGroups,
        totalLoadKw,
        solarKw,
        gridKw,
      },
    })
  } catch (err) { next(err) }
}

const updatePowerFlow = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req, req.body.organizationId)
    if (!orgId) return next(new AppError('organizationId is required', 400))
    if (req.user.role === 'USER') return next(new AppError('Not allowed', 403))

    const { sources, savings } = req.body
    const data = await prisma.powerFlowConfig.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        sources: sources || [],
        savings: savings || {},
      },
      update: {
        sources: sources !== undefined ? sources : undefined,
        savings: savings !== undefined ? savings : undefined,
      },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

module.exports = {
  listDashboards, getDashboard, createDashboard, updateDashboard, deleteDashboard,
  getPowerFlow, updatePowerFlow,
}
