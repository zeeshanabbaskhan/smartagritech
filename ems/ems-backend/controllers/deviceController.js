// ─── Device controller ────────────────────────────────────────────────────────
const prisma      = require('../config/database')
const redis       = require('../config/redis')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const { deviceWhereForUser, assertDeviceAccess, userHasExplicitDeviceGrants } = require('../utils/deviceAccess')
const { hashKey, generateDeviceIngestKey } = require('../utils/ingestAuth')
const { isDeleteQueueEnabled, enqueueDeviceDelete } = require('../workers/jobQueues')
const refCache = require('../utils/referenceCache')
const { readLatestMerged, readLatestForSlave } = require('../utils/redisLatest')
const { legacyDisplayValue } = require('../utils/legacyDisplayValue')

// Creating / deleting a device changes the owning template's cached devices
// count in the templates list — clear both viewer-org buckets so it stays right.
const invalidateTemplateCaches = async (organizationId) => {
  await refCache.invalidateOrg('all')
  if (organizationId) await refCache.invalidateOrg(organizationId)
}

/** Attach live Redis values merged with configured device variables (units + schema). */
const attachLatestMetrics = async (devices) => {
  if (!devices?.length) return devices
  const c = redis.getClient()
  const activeDevices = devices.filter((d) => String(d.switchState || '').toUpperCase() !== 'OFF')
  const activeDeviceIds = activeDevices.map((d) => d.id)

  let allVars = []
  if (activeDeviceIds.length) {
    try {
      allVars = await prisma.deviceConfigVariable.findMany({
        where: { deviceId: { in: activeDeviceIds }, isActive: true },
        select: { id: true, deviceId: true, name: true, currentValue: true, unit: true, displayName: true, deviceConfigSlaveId: true },
        orderBy: { name: 'asc' },
      })
    } catch (_) {
      allVars = []
    }
  }

  const varsByDevice = new Map()
  for (const v of allVars) {
    if (!varsByDevice.has(v.deviceId)) varsByDevice.set(v.deviceId, [])
    varsByDevice.get(v.deviceId).push(v)
  }

  const enriched = await Promise.all(devices.map(async (d) => {
    // Switch OFF — hide all live/current readings from API consumers.
    if (String(d.switchState || '').toUpperCase() === 'OFF') {
      const configSlaves = (d.configSlaves || []).map((s) => ({ ...s, latestMetrics: {} }))
      return { ...d, latestMetrics: {}, configSlaves }
    }

    let hot = {}
    if (c) {
      try {
        hot = await readLatestMerged(d.id)
      } catch (_) {
        hot = {}
      }
    }

    const vars = varsByDevice.get(d.id) || []
    const latestMetrics = {}
    for (const v of vars) {
      if (!v?.name) continue
      const redisVal = hot[v.name]
      const raw = redisVal != null && redisVal !== '' ? redisVal : v.currentValue
      const num = raw != null && raw !== '' ? Number(raw) : NaN
      const meta = { name: v.name, displayName: v.displayName, unit: v.unit }
      const displayValue = Number.isFinite(num) ? legacyDisplayValue(num, meta) : null
      latestMetrics[v.name] = {
        value: raw ?? null,
        displayValue,
        unit: v.unit ?? null,
        displayName: v.displayName || v.name,
      }
    }

    // Attach per-slave metrics if device has slaves
    const slaves = d.configSlaves || []
    const configSlaves = await Promise.all(slaves.map(async (s) => {
      let slaveHot = {}
      if (c && s.id) {
        try {
          slaveHot = await readLatestForSlave(d.id, s.id)
        } catch (_) {
          slaveHot = {}
        }
      }
      const slaveVars = vars.filter((v) => v.deviceConfigSlaveId === s.id)
      const slaveMetrics = {}
      const targetVars = slaveVars.length ? slaveVars : vars
      for (const sv of targetVars) {
        if (!sv?.name) continue
        const sRedisVal = slaveHot[sv.name] ?? hot[sv.name]
        const sRaw = sRedisVal != null && sRedisVal !== '' ? sRedisVal : sv.currentValue
        const sNum = sRaw != null && sRaw !== '' ? Number(sRaw) : NaN
        const sMeta = { name: sv.name, displayName: sv.displayName, unit: sv.unit }
        const sDisplayValue = Number.isFinite(sNum) ? legacyDisplayValue(sNum, sMeta) : null
        slaveMetrics[sv.name] = {
          value: sRaw ?? null,
          displayValue: sDisplayValue,
          unit: sv.unit ?? null,
          displayName: sv.displayName || sv.name,
        }
      }
      return { ...s, latestMetrics: slaveMetrics }
    }))

    return { ...d, latestMetrics, configSlaves }
  }))

  return enriched
}

const mapDeviceSlaves = (devices) => {
  const OFFLINE_AFTER_MS = 10 * 60 * 1000
  return devices.map((d) => {
    const isSwitchOff = String(d.switchState || '').toUpperCase() === 'OFF'
    const dLastTs = d.lastDataReceivedAt ? new Date(d.lastDataReceivedAt).getTime() : 0
    const dAge = d.lastDataReceivedAt ? Date.now() - dLastTs : Infinity
    const isDeviceStreaming = !isSwitchOff && (d.status === 'ONLINE' || (Number.isFinite(dAge) && dAge < OFFLINE_AFTER_MS))

    const configSlaves = (d.configSlaves || []).map((s) => {
      const lastVar = s.configVariables?.[0]?.lastUpdatedAt || null
      const vLastTs = lastVar ? new Date(lastVar).getTime() : 0

      let lastDataReceivedAt = lastVar
      if (dLastTs > vLastTs || !lastDataReceivedAt) {
        lastDataReceivedAt = d.lastDataReceivedAt || lastVar || null
      }

      const effectiveAge = lastDataReceivedAt ? Date.now() - new Date(lastDataReceivedAt).getTime() : Infinity
      const isOnline = !isSwitchOff && (
        (Number.isFinite(effectiveAge) && effectiveAge < OFFLINE_AFTER_MS) ||
        isDeviceStreaming
      )

      return {
        id: s.id,
        name: s.name,
        isDefault: s.isDefault,
        deviceId: s.deviceId,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        lastDataReceivedAt: isOnline && (!lastDataReceivedAt || effectiveAge >= OFFLINE_AFTER_MS)
          ? d.lastDataReceivedAt
          : lastDataReceivedAt,
        latestMetrics: s.latestMetrics || {},
      }
    })
    return { ...d, configSlaves }
  })
}

const filterSlavesForUser = async (devices, user) => {
  if (!user || user.role !== 'USER') return devices
  const constrained = await userHasExplicitDeviceGrants(user.id)
  if (!constrained) return devices

  return Promise.all(
    devices.map(async (d) => {
      const wholeAccess = await prisma.device.findFirst({
        where: {
          id: d.id,
          OR: [
            { deviceUsers: { some: { userId: user.id } } },
            { accessGroupDevices: { some: { accessGroup: { users: { some: { userId: user.id } } } } } },
            { deviceGroupDevices: { some: { deviceGroup: { users: { some: { userId: user.id } } } } } },
          ],
        },
        select: { id: true },
      })
      if (wholeAccess) return d

      const filteredSlaves = (d.configSlaves || []).filter((s) =>
        s.deviceGroups?.some((dg) =>
          dg.deviceGroup?.users?.some((u) => u.userId === user.id)
        )
      )
      return { ...d, configSlaves: filteredSlaves }
    })
  )
}

const getDevices = async (req, res, next) => {
  try {
    const { page, limit, skip }    = paginate(req.query)
    const { search, status, gatewayId, withMetrics } = req.query

    const where = await deviceWhereForUser(req.user, { ...orgScope(req.user) })
    if (status)    where.status    = status
    if (gatewayId) where.gatewayId = gatewayId
    if (search)    where.name      = { contains: search, mode: 'insensitive' }

    let data = await prisma.device.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        gateway:      { select: { id: true, name: true } },
        template:     { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        configSlaves: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            isDefault: true,
            deviceId: true,
            deviceGroups: {
              select: {
                deviceGroup: {
                  select: {
                    users: { select: { userId: true } },
                  },
                },
              },
            },
            configVariables: {
              where: { isActive: true },
              select: { lastUpdatedAt: true },
              orderBy: { lastUpdatedAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    })

    data = await filterSlavesForUser(data, req.user)
    data = mapDeviceSlaves(data)
    if (withMetrics === 'true') data = await attachLatestMetrics(data)

    const total = await prisma.device.count({ where })
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

const getDevice = async (req, res, next) => {
  try {
    const where = await deviceWhereForUser(req.user, { id: req.params.id, ...orgScope(req.user) })

    let data = await prisma.device.findFirst({
      where,
      include: {
        gateway:      { select: { id: true, name: true } },
        template:     { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        configSlaves: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            isDefault: true,
            deviceId: true,
            deviceGroups: {
              select: {
                deviceGroup: {
                  select: {
                    users: { select: { userId: true } },
                  },
                },
              },
            },
            configVariables: {
              where: { isActive: true },
              select: { lastUpdatedAt: true },
              orderBy: { lastUpdatedAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    })
    if (!data) return next(new AppError('Device not found', 404))
    const filtered = (await filterSlavesForUser([data], req.user))[0]
    data = mapDeviceSlaves([filtered])[0]
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

    await invalidateTemplateCaches(orgId)

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
      await invalidateTemplateCaches(existing.organizationId)
      return res.status(202).json({ success: true, queued: true, deviceId: id, message: 'Device deletion queued' })
    }

    await purgeDeviceSync(id)
    await invalidateTemplateCaches(existing.organizationId)
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

    // Enforces org scope for managers and DeviceUser/AccessGroup ACL for USER.
    const existing = await assertDeviceAccess(req.params.id, req.user)

    const [command, device] = await prisma.$transaction([
      prisma.deviceCommand.create({
        data: {
          deviceId:       req.params.id,
          organizationId: existing.organizationId,
          action,
          status:         'PENDING',
          requestedBy:    req.user.id,
        },
      }),
      // Persist switch intent so dashboards don't revert on reload before gateway ack.
      // Switch OFF also marks the device OFFLINE; Switch ON waits for live data to go ONLINE.
      prisma.device.update({
        where: { id: req.params.id },
        data: {
          switchState: action,
          ...(action === 'OFF' ? { status: 'OFFLINE' } : {}),
        },
        select: {
          id: true,
          name: true,
          switchState: true,
          status: true,
          organizationId: true,
          gateway: { select: { serialNumber: true, name: true } },
        },
      }),
    ])

    if (action === 'OFF') {
      try {
        const { emitDeviceStatus } = require('../services/devicePresenceService')
        emitDeviceStatus(existing.organizationId, req.params.id, 'OFFLINE', {
          reason: 'switch_off',
          switchState: 'OFF',
        })
      } catch (_) {}
    }

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

    let mqttPublish = null
    try {
      const { publishDeviceCommand } = require('../services/mqttBridgeService')
      mqttPublish = await publishDeviceCommand({
        organizationId: existing.organizationId,
        device,
        action,
        commandId: command.id,
      })
    } catch (_) {
      mqttPublish = { published: false, reason: 'publish_failed' }
    }

    try {
      const { getIO } = require('../socket')
      getIO().to(`device_${req.params.id}`).emit('device:command', {
        commandId: command.id,
        deviceId:  req.params.id,
        action,
        status:    'PENDING',
        switchState: action,
      })
      getIO().to(`org_${existing.organizationId}`).emit('device:switch', {
        deviceId: req.params.id,
        action,
        switchState: action,
        status: action === 'OFF' ? 'OFFLINE' : device.status,
      })
    } catch (_) {}

    res.json({ success: true, data: { ...command, device, mqttPublish } })
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
