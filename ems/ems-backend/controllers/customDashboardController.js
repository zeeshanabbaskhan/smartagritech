const prisma = require('../config/database')
const redis = require('../config/redis')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const { listAccessibleDeviceIds } = require('../utils/deviceAccess')

const resolveOrgId = (req, bodyOrgId) => {
  if (req.user.role === 'SUPER_ADMIN') return bodyOrgId || req.query.organizationId
  return req.user.organizationId
}

const LOAD_VAR_NAMES = ['ActivePower', 'TotalActivePower', 'ActivePowerTotal', 'Power', 'PowerConsumption']

/** Convert raw register power to kW (ActivePower from MQTT is typically watts). */
const toLoadKw = (name, raw) => {
  const n = parseFloat(raw)
  if (Number.isNaN(n)) return 0
  const nm = String(name || '')
  if (/powerconsumption/i.test(nm) && !/active/i.test(nm)) return Math.max(0, n)
  if (/activepower|^power$/i.test(nm)) return Math.max(0, n / 1000)
  if (Math.abs(n) >= 200) return Math.max(0, n / 1000)
  return Math.max(0, n)
}

/** Prefer ActivePower, then PowerConsumption from Redis or DB current values. */
const readDeviceLoadKw = async (deviceId) => {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { switchState: true },
  })
  if (String(device?.switchState || '').toUpperCase() === 'OFF') return 0

  const c = redis.getClient()
  if (c) {
    try {
      const hot = await c.hGetAll(`device:${deviceId}:latest`)
      for (const name of LOAD_VAR_NAMES) {
        const raw = hot?.[name]
        if (raw != null && raw !== '') return toLoadKw(name, raw)
      }
    } catch (_) {}
  }
  const vars = await prisma.deviceConfigVariable.findMany({
    where: { deviceId, name: { in: LOAD_VAR_NAMES }, isActive: true },
    select: { name: true, currentValue: true },
  })
  const byName = Object.fromEntries(vars.map((v) => [v.name, v.currentValue]))
  for (const name of LOAD_VAR_NAMES) {
    const val = byName[name]
    if (val == null || val === '') continue
    return toLoadKw(name, val)
  }
  return 0
}

const sumLoadsForDeviceIds = async (deviceIds) => {
  if (!deviceIds?.length) return 0
  let total = 0
  for (const id of deviceIds) {
    total += await readDeviceLoadKw(id)
  }
  return Math.round(total * 100) / 100
}

/** Read ExportPower (solar/export) for a device — Redis then DB. */
const readDeviceExportKw = async (deviceId) => {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { switchState: true },
  })
  if (String(device?.switchState || '').toUpperCase() === 'OFF') return 0

  const EXPORT_NAMES = ['ExportPower', 'SolarPower', 'ExportActivePower']
  const c = redis.getClient()
  if (c) {
    try {
      const hot = await c.hGetAll(`device:${deviceId}:latest`)
      for (const name of EXPORT_NAMES) {
        const raw = hot?.[name]
        if (raw != null && raw !== '') return toLoadKw(name, raw)
      }
    } catch (_) {}
  }
  const vars = await prisma.deviceConfigVariable.findMany({
    where: { deviceId, name: { in: EXPORT_NAMES }, isActive: true },
    select: { name: true, currentValue: true },
  })
  const byName = Object.fromEntries(vars.map((v) => [v.name, v.currentValue]))
  for (const name of EXPORT_NAMES) {
    const val = byName[name]
    if (val == null || val === '') continue
    return toLoadKw(name, val)
  }
  return 0
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
      },
    })

    const mappedGroups = []
    const allDeviceIds = new Set()
    for (const g of groups) {
      const deviceRows = allowedSet
        ? g.devices.filter((d) => allowedSet.has(d.deviceId))
        : g.devices
      // USER: omit groups with no accessible devices
      if (allowedSet && !deviceRows.length) continue
      const deviceIds = deviceRows.map((d) => d.deviceId)
      deviceIds.forEach((id) => allDeviceIds.add(id))
      const loadKw = await sumLoadsForDeviceIds(deviceIds)
      mappedGroups.push({
        id: g.id,
        name: g.name,
        description: g.description,
        deviceCount: deviceRows.length,
        deviceIds,
        devices: deviceRows.map((d) => d.device),
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
        sources.push({ ...b, deviceIds: [], valueKw: 0 })
      }
    }

    // Fill live kW from linked devices when present
    for (const s of sources) {
      const ids = Array.isArray(s.deviceIds)
        ? s.deviceIds.filter((id) => id && (!allowedSet || allowedSet.has(id)))
        : []
      s.deviceIds = Array.isArray(s.deviceIds) ? s.deviceIds.filter(Boolean) : []
      if (ids.length) {
        s.valueKw = await sumLoadsForDeviceIds(ids)
        s.liveDerived = true
      } else if (!(s.type === 'grid' || s.id === 'grid')) {
        s.valueKw = Number(s.valueKw) || 0
      }
    }

    // Grid without linked meters = fleet load − other sources
    const grid = sources.find((s) => s.type === 'grid' || s.id === 'grid')
    if (grid && !(grid.deviceIds || []).length) {
      const others = sources
        .filter((s) => !(s.type === 'grid' || s.id === 'grid'))
        .reduce((acc, s) => acc + (parseFloat(s.valueKw) || 0), 0)
      grid.valueKw = Math.max(0, Math.round((totalLoadKw - others) * 100) / 100)
      grid.derived = true
      grid.liveDerived = true
    }

    const solarKw = Number(sources.find((s) => s.type === 'solar' || s.id === 'solar')?.valueKw) || 0
    const gridKw = Number(grid?.valueKw) || 0

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
