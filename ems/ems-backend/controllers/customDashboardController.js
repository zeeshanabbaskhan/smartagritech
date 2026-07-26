const prisma = require('../config/database')
const redis = require('../config/redis')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const { listAccessibleDeviceIds } = require('../utils/deviceAccess')

const resolveOrgId = (req, bodyOrgId) => {
  if (req.user.role === 'SUPER_ADMIN') return bodyOrgId || req.query.organizationId
  return req.user.organizationId
}

/** Prefer ActivePower, then PowerConsumption from Redis or DB current values. */
const readDeviceLoadKw = async (deviceId) => {
  const c = redis.getClient()
  if (c) {
    try {
      const hot = await c.hGetAll(`device:${deviceId}:latest`)
      const raw = hot?.ActivePower ?? hot?.PowerConsumption
      if (raw != null && raw !== '') {
        const n = parseFloat(raw)
        if (!Number.isNaN(n)) return Math.max(0, n)
      }
    } catch (_) {}
  }
  const vars = await prisma.deviceConfigVariable.findMany({
    where: { deviceId, name: { in: ['ActivePower', 'PowerConsumption'] }, isActive: true },
    select: { name: true, currentValue: true },
  })
  const byName = Object.fromEntries(vars.map((v) => [v.name, v.currentValue]))
  const val = byName.ActivePower ?? byName.PowerConsumption
  if (val == null || val === '') return 0
  const n = parseFloat(val)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
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
  const c = redis.getClient()
  if (c) {
    try {
      const hot = await c.hGetAll(`device:${deviceId}:latest`)
      const raw = hot?.ExportPower ?? hot?.SolarPower
      if (raw != null && raw !== '') {
        const n = parseFloat(raw)
        if (!Number.isNaN(n)) return Math.max(0, n)
      }
    } catch (_) {}
  }
  const vars = await prisma.deviceConfigVariable.findMany({
    where: { deviceId, name: { in: ['ExportPower', 'SolarPower'] }, isActive: true },
    select: { name: true, currentValue: true },
  })
  const byName = Object.fromEntries(vars.map((v) => [v.name, v.currentValue]))
  const val = byName.ExportPower ?? byName.SolarPower
  if (val == null || val === '') return 0
  const n = parseFloat(val)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
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
    const solarKw = await sumExportForDeviceIds(allIds)
    const generatorManual = (Array.isArray(config.sources) ? config.sources : [])
      .filter((s) => s.type === 'generator' || s.id === 'generator')
      .reduce((acc, s) => acc + (parseFloat(s.valueKw) || 0), 0)
    const gridKw = Math.max(0, Math.round((totalLoadKw - solarKw - generatorManual) * 100) / 100)

    let sources = Array.isArray(config.sources) ? config.sources.map((s) => ({ ...s })) : []
    const ensureSource = (id, name, type, valueKw) => {
      const idx = sources.findIndex((s) => s.id === id || s.type === type)
      if (idx >= 0) {
        // Keep manual generator edits; auto-fill grid/solar when live telemetry exists
        if (type === 'generator' && (parseFloat(sources[idx].valueKw) || 0) > 0 && !sources[idx].liveDerived) {
          return
        }
        sources[idx] = { ...sources[idx], valueKw, liveDerived: true }
      } else {
        sources.push({ id, name, type, valueKw, liveDerived: true })
      }
    }

    if (totalLoadKw > 0 || solarKw > 0) {
      ensureSource('solar', 'Solar', 'solar', solarKw)
      ensureSource('grid', 'Grid', 'grid', gridKw)
      if (!sources.some((s) => s.type === 'generator' || s.id === 'generator')) {
        sources.push({ id: 'generator', name: 'Generator', type: 'generator', valueKw: generatorManual })
      }
    } else {
      // Fall back: if sources empty and groups have load, put all on grid
      const groupSum = mappedGroups.reduce((acc, g) => acc + (g.loadKw || 0), 0)
      const sourceSum = sources.reduce((acc, s) => acc + (parseFloat(s.valueKw) || 0), 0)
      if (sourceSum === 0 && groupSum > 0) {
        ensureSource('grid', 'Grid', 'grid', groupSum)
      }
    }

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
