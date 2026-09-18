const { Prisma } = require('@prisma/client')
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
  if (abs >= 2500) return +(abs / 1000).toFixed(3)
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
    const slaveResults = await Promise.all(
      slaves.map((s) => readSlaveLoadKw(s.deviceId, s.id))
    )
    total += slaveResults.reduce((a, b) => a + b, 0)
  }

  if (safeDeviceIds.length) {
    const devResults = await Promise.all(
      safeDeviceIds.map((id) => readDeviceLoadKw(id))
    )
    total += devResults.reduce((a, b) => a + b, 0)
  }

  return Math.round(total * 100) / 100
}

const sumLoadsForDeviceIds = async (deviceIds) => {
  return sumLoadsForSlavesAndDevices(deviceIds, [])
}

/**
 * Dynamic calculation of cumulative energy (kWh) consumed today for a grid slave.
 * Checks cumulative energy counters first, then average active power integration.
 */
const computeSlaveTodayKwh = async (deviceId, slaveId, liveKw) => {
  if (!slaveId) return 0
  const c = redis.getClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayKey = `${todayStart.getFullYear()}-${todayStart.getMonth() + 1}-${todayStart.getDate()}`
  const cacheKey = `grid_kwh:${slaveId}:${todayKey}`

  if (c) {
    try {
      const cached = await c.get(cacheKey)
      if (cached != null) return parseFloat(cached) || 0
    } catch (_) {}
  }

  const now = new Date()
  const elapsedHours = Math.max(0.05, (now - todayStart) / (1000 * 3600))
  let resultKwh = 0

  // 1. Check cumulative meter delta (Units, PowerConsumption, Energy, ActiveEnergy, kWh, TotalEnergy)
  try {
    const cumVars = ['Units', 'PowerConsumption', 'Energy', 'ActiveEnergy', 'kWh', 'TotalEnergy']
    const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
    for (const vName of cumVars) {
      const rows = await prisma.$queryRaw`
        SELECT 
          (SELECT v.value::double precision FROM sensor_reading_values v WHERE v."deviceConfigSlaveId" = ${slaveId} ${devClause} AND v."variableName" = ${vName} AND v.timestamp >= ${todayStart} ORDER BY v.timestamp DESC LIMIT 1) as last_val,
          (SELECT v.value::double precision FROM sensor_reading_values v WHERE v."deviceConfigSlaveId" = ${slaveId} ${devClause} AND v."variableName" = ${vName} AND v.timestamp >= ${todayStart} ORDER BY v.timestamp ASC LIMIT 1) as first_val
      `
      if (rows?.[0]?.last_val != null && rows?.[0]?.first_val != null) {
        const diff = Number(rows[0].last_val) - Number(rows[0].first_val)
        if (diff > 0 && Number.isFinite(diff)) {
          resultKwh = +diff.toFixed(2)
          break
        }
      }
    }
  } catch (_) {}

  // 2. Try average active power integration
  if (resultKwh === 0) {
    try {
      const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
      const pRows = await prisma.$queryRaw`
        SELECT 
          AVG(v.value)::double precision as avg_val,
          COUNT(*)::int as count
        FROM sensor_reading_values v
        WHERE v."deviceConfigSlaveId" = ${slaveId}
          ${devClause}
          AND v."variableName" IN ('Total Power', 'Active Power', 'ActivePower', 'Total Active Power', 'Power')
          AND v.timestamp >= ${todayStart}
      `
      if (pRows?.[0]?.count > 0 && pRows[0]?.avg_val != null) {
        const avgKw = normalizeToKw(pRows[0].avg_val)
        if (avgKw > 0) {
          resultKwh = +(avgKw * elapsedHours).toFixed(2)
        }
      }
    } catch (_) {}
  }

  // 3. Fallback: live active power * elapsed hours
  if (resultKwh === 0 && Number(liveKw) > 0) {
    resultKwh = +(Number(liveKw) * elapsedHours).toFixed(2)
  }

  if (c && resultKwh > 0) {
    try {
      await c.setEx(cacheKey, 20, String(resultKwh))
    } catch (_) {}
  }

  return resultKwh
}

/**
 * Extract live Power Factor and Frequency for grid telemetry.
 */
const extractSlaveGridHealth = async (deviceId, slaveId) => {
  const varMap = {}
  const c = redis.getClient()
  if (c && deviceId) {
    try {
      const hot = await readLatestForSlave(deviceId, slaveId)
      if (hot && Object.keys(hot).length) Object.assign(varMap, hot)
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

  const norm = {}
  for (const [k, v] of Object.entries(varMap)) {
    if (v != null && v !== '') norm[k.trim().toLowerCase()] = v
  }

  let pf = 0.975
  const rawPf = norm['power factor'] ?? norm['powerfactor'] ?? norm['pf'] ?? norm['total power factor']
  if (rawPf != null) {
    const p = parseFloat(rawPf)
    if (Number.isFinite(p)) pf = Math.abs(p >= 100 ? p / 1000 : (p > 1 ? p / 100 : p))
  }

  let freq = 50.0
  const rawFreq = norm['frequency'] ?? norm['freq'] ?? norm['hz'] ?? norm['line frequency']
  if (rawFreq != null) {
    const f = parseFloat(rawFreq)
    if (Number.isFinite(f)) freq = f >= 1000 ? +(f / 100).toFixed(2) : +f.toFixed(2)
  }

  return { powerFactor: +pf.toFixed(3), frequency: +freq.toFixed(2) }
}

/** Read ExportPower (solar/export) for a device â€” Redis then DB. */
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

const DEFAULT_SITES = [
  { id: 'site-1', name: 'Site 1', isDefault: true },
]

/**
 * Normalise the configured site list, always guaranteeing exactly one default
 * site. An empty list falls back to a single default site â€” sites beyond the
 * first only ever exist because the user created them.
 */
function normaliseSites(raw) {
  const list = (Array.isArray(raw) ? raw : [])
    .filter((s) => s && s.id)
    .map((s) => ({ id: String(s.id), name: s.name || String(s.id), isDefault: !!s.isDefault }))
  if (!list.length) return DEFAULT_SITES.map((s) => ({ ...s }))
  const defaultIdx = list.findIndex((s) => s.isDefault)
  list.forEach((s, i) => { s.isDefault = i === (defaultIdx === -1 ? 0 : defaultIdx) })
  return list
}

/**
 * Resolve the live, fully populated power flow payload for an org from its
 * stored config. Shared by getPowerFlow and updatePowerFlow so a save returns
 * exactly what a subsequent read would.
 */
async function buildPowerFlowData(req, orgId, config) {
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
    let effectiveSlaves = slaveRows.map((s) => ({
      id: s.slave?.id,
      name: s.slave?.name,
      deviceId: s.slave?.deviceId,
      deviceName: s.slave?.device?.name,
      deviceStatus: s.slave?.device?.status,
      isDefault: s.slave?.isDefault,
    }))

    // If no explicit slave rows exist but devices are linked, resolve all active slaves of those devices
    if (effectiveSlaves.length === 0 && deviceIds.length > 0) {
      const devSlaves = await prisma.deviceConfigSlave.findMany({
        where: { deviceId: { in: deviceIds }, isActive: true },
        include: { device: { select: { id: true, name: true, status: true } } },
      })
      effectiveSlaves = devSlaves.map((s) => ({
        id: s.id,
        name: s.name,
        deviceId: s.deviceId,
        deviceName: s.device?.name,
        deviceStatus: s.device?.status,
        isDefault: s.isDefault,
      }))
    }

    // Attach real-time live kW to each individual slave
    let groupSumKw = 0
    for (const s of effectiveSlaves) {
      const kw = await readSlaveLoadKw(s.deviceId, s.id)
      s.currentKw = kw
      groupSumKw += kw
    }

    const slaveIds = effectiveSlaves.map((s) => s.id)
    deviceIds.forEach((id) => allDeviceIds.add(id))
    effectiveSlaves.forEach((s) => s.deviceId && allDeviceIds.add(s.deviceId))

    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

    mappedGroups.push({
      id: g.id,
      name: g.name,
      description: g.description,
      deviceCount: deviceRows.length,
      slaveCount: effectiveSlaves.length,
      deviceIds,
      slaveIds,
      devices: deviceRows.map((d) => d.device),
      slaves: effectiveSlaves,
      loadKw: round2(groupSumKw),
      load: round2(groupSumKw),
    })
  }

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
  await Promise.all(sources.map(async (s) => {
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
  }))

  // Sites: every source belongs to one, defaulting to the default site
  const sites = normaliseSites(config.sites)
  const defaultSiteId = (sites.find((s) => s.isDefault) || sites[0]).id
  const siteById = new Map(sites.map((s) => [s.id, s]))
  for (const s of sources) {
    if (!s.siteId || !siteById.has(s.siteId)) s.siteId = defaultSiteId
    s.siteName = siteById.get(s.siteId).name
  }

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
  const siteTotals = {}
  for (const site of sites) siteTotals[site.id] = 0
  const typeTotals = {}
  for (const s of sources) {
    const kw = Number(s.valueKw) || 0
    siteTotals[s.siteId] = (siteTotals[s.siteId] || 0) + kw
    const type = s.type || s.id || 'custom'
    typeTotals[type] = (typeTotals[type] || 0) + kw
  }
  for (const k of Object.keys(siteTotals)) siteTotals[k] = round2(siteTotals[k])
  for (const k of Object.keys(typeTotals)) typeTotals[k] = round2(typeTotals[k])

  // Total Organization Load: exact sum of active supply sources
  const totalLoadKw = Math.round(
    sources.reduce((sum, s) => sum + (Number(s.valueKw) || 0), 0) * 100
  ) / 100

  const solarKw = Number(sources.find((s) => s.type === 'solar' || s.id === 'solar')?.valueKw) || 0
  const gridKw = Number(sources.find((s) => s.type === 'grid' || s.id === 'grid')?.valueKw) || 0

  const SOLAR_PEAK_SUN_HOURS = 5.5
  const TARIFF_PKR = Number(config.savings?.tariffRate) || 38.5
  const liveDailyKWh = +(solarKw * SOLAR_PEAK_SUN_HOURS).toFixed(1)
  const effectiveSavings = (config.savings && (Number(config.savings.daily) > 0 || Number(config.savings.dailyKWh) > 0))
    ? config.savings
    : {
        daily: Math.round(liveDailyKWh * TARIFF_PKR),
        weekly: Math.round(liveDailyKWh * 7 * TARIFF_PKR),
        monthly: Math.round(liveDailyKWh * 30 * TARIFF_PKR),
        dailyKWh: liveDailyKWh,
        unit: 'PKR',
        tariffRate: TARIFF_PKR,
      }

  // ─── Dynamic Grid Metrics (Option 1: Real-time Grid Import & Electricity Cost) ───
  const gridSources = sources.filter((s) => s.type === 'grid' || s.id === 'grid' || String(s.id).startsWith('grid'))
  const bySite = {}
  let totalGridKw = 0
  let totalGridTodayKwh = 0
  let pfSum = 0
  let freqSum = 0
  let gridCount = 0

  for (const s of gridSources) {
    const sKw = Number(s.valueKw) || 0
    totalGridKw += sKw
    let sKwh = 0

    for (const slvId of (s.slaveIds || [])) {
      const slv = await prisma.deviceConfigSlave.findUnique({
        where: { id: slvId },
        select: { id: true, deviceId: true },
      })
      if (slv) {
        const kwh = await computeSlaveTodayKwh(slv.deviceId, slv.id, sKw)
        sKwh += kwh
        const health = await extractSlaveGridHealth(slv.deviceId, slv.id)
        pfSum += health.powerFactor
        freqSum += health.frequency
        gridCount++
      }
    }

    if (sKwh === 0 && sKw > 0) {
      const elapsedHours = Math.max(0.1, (Date.now() - new Date().setHours(0, 0, 0, 0)) / (1000 * 3600))
      sKwh = +(sKw * elapsedHours).toFixed(2)
    }

    totalGridTodayKwh += sKwh
    const sId = s.siteId || 'default'
    bySite[sId] = {
      siteId: sId,
      siteName: s.siteName || sId,
      gridKw: round2(sKw),
      todayKwh: round2(sKwh),
      todayCost: Math.round(sKwh * TARIFF_PKR),
      weeklyKwh: round2(sKwh * 7),
      weeklyCost: Math.round(sKwh * 7 * TARIFF_PKR),
      monthlyKwh: round2(sKwh * 30),
      monthlyCost: Math.round(sKwh * 30 * TARIFF_PKR),
    }
  }

  const avgPf = gridCount > 0 ? +(pfSum / gridCount).toFixed(3) : 0.975
  const avgFreq = gridCount > 0 ? +(freqSum / gridCount).toFixed(2) : 50.0

  const gridMetrics = {
    gridKw: round2(totalGridKw),
    todayKwh: round2(totalGridTodayKwh),
    todayCost: Math.round(totalGridTodayKwh * TARIFF_PKR),
    weeklyKwh: round2(totalGridTodayKwh * 7),
    weeklyCost: Math.round(totalGridTodayKwh * 7 * TARIFF_PKR),
    monthlyKwh: round2(totalGridTodayKwh * 30),
    monthlyCost: Math.round(totalGridTodayKwh * 30 * TARIFF_PKR),
    tariffRate: TARIFF_PKR,
    powerFactor: avgPf,
    frequency: avgFreq,
    bySite,
  }

  return {
    sources,
    sites,
    siteTotals,
    typeTotals,
    savings: effectiveSavings,
    gridMetrics,
    groups: mappedGroups,
    totalLoadKw,
    solarKw,
    gridKw,
  }
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
            { id: 'grid', name: 'Grid', type: 'grid', valueKw: 0, siteId: 'site-1' },
            { id: 'solar', name: 'Solar', type: 'solar', valueKw: 0, siteId: 'site-1' },
            { id: 'generator', name: 'Generator', type: 'generator', valueKw: 0, siteId: 'site-1' },
          ],
          sites: DEFAULT_SITES,
          savings: { daily: 0, weekly: 0, monthly: 0, unit: 'PKR' },
        },
      })
    }

    res.json({ success: true, data: await buildPowerFlowData(req, orgId, config) })
  } catch (err) { next(err) }
}

const updatePowerFlow = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req, req.body.organizationId)
    if (!orgId) return next(new AppError('organizationId is required', 400))
    if (req.user.role === 'USER') return next(new AppError('Not allowed', 403))

    const { sources, sites, savings } = req.body
    const nextSites = sites !== undefined ? normaliseSites(sites) : undefined
    const config = await prisma.powerFlowConfig.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        sources: sources || [],
        sites: nextSites || DEFAULT_SITES,
        savings: savings || {},
      },
      update: {
        sources: sources !== undefined ? sources : undefined,
        sites: nextSites,
        savings: savings !== undefined ? savings : undefined,
      },
    })
    // Return the same fully populated shape a read would, so the client can
    // render live totals straight from the save response.
    res.json({ success: true, data: await buildPowerFlowData(req, orgId, config) })
  } catch (err) { next(err) }
}

module.exports = {
  listDashboards, getDashboard, createDashboard, updateDashboard, deleteDashboard,
  getPowerFlow, updatePowerFlow,
}
