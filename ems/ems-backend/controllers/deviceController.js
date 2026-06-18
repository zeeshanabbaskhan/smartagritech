// ─── Device controller ────────────────────────────────────────────────────────
const prisma      = require('../config/database')
const redis       = require('../config/redis')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const { hashKey, generateDeviceIngestKey } = require('../utils/ingestAuth')
const { isDeleteQueueEnabled, enqueueDeviceDelete } = require('../workers/jobQueues')

const attachLatestMetrics = async (devices) => {
  const c = redis.getClient()
  if (!c) return devices
  const enriched = []
  for (const d of devices) {
    try {
      const hot = await c.hGetAll(`device:${d.id}:latest`)
      enriched.push({ ...d, latestMetrics: hot })
    } catch (_) {
      enriched.push(d)
    }
  }
  return enriched
}

const getDevices = async (req, res, next) => {
  try {
    const { page, limit, skip }    = paginate(req.query)
    const { search, status, gatewayId, withMetrics } = req.query

    const where = { ...orgScope(req.user) }
    if (status)    where.status    = status
    if (gatewayId) where.gatewayId = gatewayId
    if (search)    where.name      = { contains: search, mode: 'insensitive' }
    if (req.user.role === 'USER') {
      where.deviceUsers = { some: { userId: req.user.id } }
    }

    let data = await prisma.device.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        gateway:      { select: { id: true, name: true } },
        template:     { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    })

    if (withMetrics === 'true') data = await attachLatestMetrics(data)

    const total = await prisma.device.count({ where })
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

const getDevice = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    if (req.user.role === 'USER') where.deviceUsers = { some: { userId: req.user.id } }

    const data = await prisma.device.findFirst({
      where,
      include: {
        gateway:      { select: { id: true, name: true } },
        template:     { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    })
    if (!data) return next(new AppError('Device not found', 404))
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const createDevice = async (req, res, next) => {
  try {
    const { name, templateId, gatewayId, organizationId, mqttConfigId } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId
    const ingestKey = generateDeviceIngestKey()

    const result = await prisma.$transaction(async (tx) => {
      const device = await tx.device.create({
        data: {
          name, templateId, gatewayId, organizationId: orgId, mqttConfigId,
          ingestApiKeyHash: hashKey(ingestKey),
        },
      })

      const slaves = await tx.deviceTemplateSlave.findMany({ where: { templateId } })
      for (const slave of slaves) {
        const cs = await tx.deviceConfigSlave.create({
          data: {
            deviceId:       device.id,
            templateSlaveId: slave.id,
            organizationId: orgId,
            name:           slave.name,
            description:    slave.description,
            isDefault:      slave.isDefault,
          },
        })

        const vars = await tx.deviceTemplateVariable.findMany({ where: { templateSlaveId: slave.id } })
        if (vars.length) {
          await tx.deviceConfigVariable.createMany({
            data: vars.map((v) => ({
              deviceId:            device.id,
              deviceConfigSlaveId: cs.id,
              templateVariableId:  v.id,
              organizationId:      orgId,
              name:                v.name,
              displayName:         v.displayName,
              unit:                v.unit,
            })),
          })
        }
      }

      await tx.deviceTimestamp.create({ data: { deviceId: device.id, organizationId: orgId } })
      return device
    })

    res.status(201).json({
      success: true,
      data:    result,
      ingestApiKey: ingestKey,
      message: 'Store ingestApiKey securely — it is shown only once.',
    })
  } catch (err) { next(err) }
}

const regenerateIngestKey = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.device.findFirst({ where })
    if (!existing) return next(new AppError('Device not found', 404))

    const ingestKey = generateDeviceIngestKey()
    await prisma.device.update({
      where: { id: req.params.id },
      data:  { ingestApiKeyHash: hashKey(ingestKey) },
    })
    res.json({ success: true, ingestApiKey: ingestKey })
  } catch (err) { next(err) }
}

const updateDevice = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.device.findFirst({ where })
    if (!existing) return next(new AppError('Device not found', 404))

    const { name, gatewayId, switchState, status, mqttConfigId } = req.body
    const data = await prisma.device.update({
      where: { id: req.params.id },
      data:  { name, gatewayId, switchState, status, mqttConfigId },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

const deleteDevice = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.device.findFirst({ where })
    if (!existing) return next(new AppError('Device not found', 404))

    const id = req.params.id

    if (isDeleteQueueEnabled()) {
      await enqueueDeviceDelete(id)
      return res.status(202).json({ success: true, queued: true, deviceId: id, message: 'Device deletion queued' })
    }

    await purgeDeviceSync(id)
    res.json({ success: true, message: 'Device deleted' })
  } catch (err) { next(err) }
}

const purgeDeviceSync = async (id) => {
  await prisma.$transaction(async (tx) => {
    const configVarIds = (await tx.deviceConfigVariable.findMany({ where: { deviceId: id }, select: { id: true } })).map((v) => v.id)
    if (configVarIds.length) {
      await tx.deviceConfigVariableLog.deleteMany({ where: { deviceConfigVariableId: { in: configVarIds } } })
    }
    await tx.deviceConfigVariable.deleteMany({ where: { deviceId: id } })
    await tx.deviceConfigSlave.deleteMany({ where: { deviceId: id } })
    await tx.deviceVariableAlarmHistory.deleteMany({ where: { deviceId: id } })
    await tx.deviceVariableLinkageHistory.deleteMany({ where: { deviceId: id } })
    await tx.deviceCommand.deleteMany({ where: { deviceId: id } })

    const taskIds = (await tx.scheduledTask.findMany({ where: { deviceId: id }, select: { id: true } })).map((t) => t.id)
    if (taskIds.length) {
      await tx.scheduleExecutionLog.deleteMany({ where: { scheduleTaskId: { in: taskIds } } })
      await tx.scheduledTask.deleteMany({ where: { deviceId: id } })
    }

    await tx.deviceTimestamp.deleteMany({ where: { deviceId: id } })
    await tx.sensorReadingValue.deleteMany({ where: { deviceId: id } })
    await tx.sensorReading.deleteMany({ where: { deviceId: id } })
    await tx.aIForecastReading.deleteMany({ where: { deviceId: id } })
    await tx.deviceUser.deleteMany({ where: { deviceId: id } })
    await tx.alarmConfigurationDevice.deleteMany({ where: { deviceId: id } })
    await tx.device.delete({ where: { id } })
  })
}

const switchToggle = async (req, res, next) => {
  try {
    const { action } = req.body
    if (!['ON', 'OFF'].includes(action)) return next(new AppError('action must be ON or OFF', 400))

    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.device.findFirst({ where })
    if (!existing) return next(new AppError('Device not found', 404))

    const command = await prisma.deviceCommand.create({
      data: {
        deviceId:       req.params.id,
        organizationId: existing.organizationId,
        action,
        status:         'PENDING',
        requestedBy:    req.user.id,
      },
    })

    setTimeout(async () => {
      try {
        const pending = await prisma.deviceCommand.findUnique({ where: { id: command.id } })
        if (pending?.status === 'PENDING') {
          await prisma.deviceCommand.update({
            where: { id: command.id },
            data:  { status: 'TIMEOUT', failedReason: 'Gateway did not acknowledge within 30s' },
          })
        }
      } catch (_) {}
    }, 30_000)

    try {
      const { getIO } = require('../socket')
      getIO().to(`device_${req.params.id}`).emit('device:command', {
        commandId: command.id,
        deviceId:  req.params.id,
        action,
        status:    'PENDING',
      })
    } catch (_) {}

    res.json({ success: true, data: command })
  } catch (err) { next(err) }
}

const getCommandStatus = async (req, res, next) => {
  try {
    const cmd = await prisma.deviceCommand.findFirst({
      where: { id: req.params.commandId, deviceId: req.params.id, ...orgScope(req.user) },
    })
    if (!cmd) return next(new AppError('Command not found', 404))
    res.json({ success: true, data: cmd })
  } catch (err) { next(err) }
}

module.exports = {
  getDevices, getDevice, createDevice, updateDevice, deleteDevice,
  switchToggle, regenerateIngestKey, getCommandStatus,
}
