const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const {
  startBridge,
  stopBridge,
  getRuntimeStatus,
} = require('../services/mqttBridgeService')

const sanitize = (row) => {
  if (!row) return row
  const { password, ...rest } = row
  return {
    ...rest,
    hasPassword: Boolean(password),
    runtime: getRuntimeStatus(row.id),
  }
}

const listBridges = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user) }
    const [rows, total] = await Promise.all([
      prisma.mqttBridge.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { organization: { select: { id: true, name: true } } },
      }),
      prisma.mqttBridge.count({ where }),
    ])
    res.json({
      success: true,
      data: rows.map(sanitize),
      meta: { page, limit, total },
    })
  } catch (err) {
    next(err)
  }
}

const getBridge = async (req, res, next) => {
  try {
    const row = await prisma.mqttBridge.findFirst({
      where: { id: req.params.id, ...orgScope(req.user) },
      include: { organization: { select: { id: true, name: true } } },
    })
    if (!row) return next(new AppError('Bridge not found', 404))
    res.json({ success: true, data: sanitize(row) })
  } catch (err) {
    next(err)
  }
}

const createBridge = async (req, res, next) => {
  try {
    const {
      name,
      organizationId,
      brokerHost,
      brokerPort,
      username,
      password,
      subscribeTopic,
      commandTopic,
      enabled,
    } = req.body

    if (!brokerHost) return next(new AppError('brokerHost is required', 400))

    const orgId =
      req.user.role === 'SUPER_ADMIN'
        ? organizationId || req.user.organizationId
        : req.user.organizationId

    if (!orgId) return next(new AppError('organizationId is required', 400))

    const row = await prisma.mqttBridge.create({
      data: {
        name: name || 'MQTT Bridge',
        organizationId: orgId,
        brokerHost,
        brokerPort: brokerPort != null ? Number(brokerPort) : 1883,
        username: username || null,
        password: password || null,
        subscribeTopic: subscribeTopic || '/UploadTopic',
        commandTopic: commandTopic || null,
        enabled: Boolean(enabled),
        status: 'STOPPED',
        createdBy: req.user.id,
      },
    })

    if (row.enabled) {
      try {
        await startBridge(row.id)
      } catch (err) {
        await prisma.mqttBridge.update({
          where: { id: row.id },
          data: { status: 'ERROR', lastError: err.message },
        })
      }
    }

    const fresh = await prisma.mqttBridge.findUnique({ where: { id: row.id } })
    res.status(201).json({ success: true, data: sanitize(fresh) })
  } catch (err) {
    next(err)
  }
}

const updateBridge = async (req, res, next) => {
  try {
    const existing = await prisma.mqttBridge.findFirst({
      where: { id: req.params.id, ...orgScope(req.user) },
    })
    if (!existing) return next(new AppError('Bridge not found', 404))

    const {
      name,
      brokerHost,
      brokerPort,
      username,
      password,
      subscribeTopic,
      commandTopic,
    } = req.body

    const data = {
      name: name ?? existing.name,
      brokerHost: brokerHost ?? existing.brokerHost,
      brokerPort: brokerPort != null ? Number(brokerPort) : existing.brokerPort,
      username: username !== undefined ? username || null : existing.username,
      subscribeTopic: subscribeTopic ?? existing.subscribeTopic,
      commandTopic: commandTopic !== undefined ? commandTopic || null : existing.commandTopic,
    }
    if (password !== undefined && password !== '') {
      data.password = password
    }

    const row = await prisma.mqttBridge.update({
      where: { id: existing.id },
      data,
    })

    // Restart if it was running so new settings apply
    if (existing.enabled) {
      try {
        await startBridge(row.id)
      } catch (err) {
        await prisma.mqttBridge.update({
          where: { id: row.id },
          data: { status: 'ERROR', lastError: err.message },
        })
      }
    }

    const fresh = await prisma.mqttBridge.findUnique({ where: { id: row.id } })
    res.json({ success: true, data: sanitize(fresh) })
  } catch (err) {
    next(err)
  }
}

const deleteBridge = async (req, res, next) => {
  try {
    const existing = await prisma.mqttBridge.findFirst({
      where: { id: req.params.id, ...orgScope(req.user) },
    })
    if (!existing) return next(new AppError('Bridge not found', 404))
    await stopBridge(existing.id)
    await prisma.mqttBridge.delete({ where: { id: existing.id } })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

const start = async (req, res, next) => {
  try {
    const existing = await prisma.mqttBridge.findFirst({
      where: { id: req.params.id, ...orgScope(req.user) },
    })
    if (!existing) return next(new AppError('Bridge not found', 404))
    await startBridge(existing.id)
    const fresh = await prisma.mqttBridge.findUnique({ where: { id: existing.id } })
    res.json({ success: true, data: sanitize(fresh) })
  } catch (err) {
    next(err)
  }
}

const stop = async (req, res, next) => {
  try {
    const existing = await prisma.mqttBridge.findFirst({
      where: { id: req.params.id, ...orgScope(req.user) },
    })
    if (!existing) return next(new AppError('Bridge not found', 404))
    await stopBridge(existing.id)
    const fresh = await prisma.mqttBridge.findUnique({ where: { id: existing.id } })
    res.json({ success: true, data: sanitize(fresh) })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listBridges,
  getBridge,
  createBridge,
  updateBridge,
  deleteBridge,
  start,
  stop,
}
