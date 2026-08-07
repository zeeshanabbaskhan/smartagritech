// ─── Alarm linkage controller ─────────────────────────────────────────────────
// Four related resource groups exposed as separate routers (see routes/alarmLinkage.js):
//   • TemplateTriggers — define the condition (variable op threshold)
//   • AlarmSettings    — configure push type + device/contact lists for a trigger
//   • AlarmContacts    — phone/email recipients
//   • AlarmHistory     — both notification logs and variable alarm records
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate, buildDateRange } = require('../utils/helpers')

/** Accept "235", "235V", " 12.5 A " → number; reject empty / NaN. */
function parseThreshold(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const n = parseFloat(String(raw).replace(/[^0-9.+\-eE]/g, ''))
  return Number.isFinite(n) ? n : null
}

// ─── TEMPLATE TRIGGERS ───────────────────────────────────────────────────────

// @desc  List alarm template triggers; filterable by template and search
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getAlarmTemplates = async (req, res, next) => {
  try {
    const { page, limit, skip }                  = paginate(req.query)
    const { organizationId, deviceTemplateId, search } = req.query

    const where = { ...orgScope(req.user, organizationId) }
    if (deviceTemplateId) where.deviceTemplateId = deviceTemplateId
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const [data, total] = await Promise.all([
      prisma.templateTrigger.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization:    { select: { id: true, name: true } },
          deviceTemplate:  { select: { id: true, name: true } },
          watchedVariable: { select: { id: true, name: true, displayName: true, unit: true, templateSlaveId: true, registerAddress: true } },
          linkageVariable: { select: { id: true, name: true, unit: true } },
          creator:         { select: { id: true, fullName: true, email: true } },
          alarmSettings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              configContacts: { include: { alarmContact: true } },
            },
          },
        },
      }),
      prisma.templateTrigger.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create an alarm trigger
// @access SUPER_ADMIN | ORG_ADMIN | USER
const createAlarmTemplate = async (req, res, next) => {
  try {
    const {
      name, organizationId, deviceTemplateId, templateVariableId,
      operator, threshold, thresholdB, anomalyType, priority,
      linkageVariableId, linkageAction, linkageValue, isActive,
    } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId
    if (!orgId) return next(new AppError('Organization is required', 400))
    if (!name?.trim()) return next(new AppError('Trigger name is required', 400))
    if (!deviceTemplateId) return next(new AppError('Device template is required', 400))
    if (!templateVariableId) return next(new AppError('Template variable is required', 400))
    if (!operator) return next(new AppError('Operator is required', 400))

    const thr = parseThreshold(threshold)
    if (thr == null) return next(new AppError('threshold must be a valid number', 400))
    const thrB = thresholdB === undefined || thresholdB === null || thresholdB === ''
      ? null
      : parseThreshold(thresholdB)
    if (thresholdB !== undefined && thresholdB !== null && thresholdB !== '' && thrB == null) {
      return next(new AppError('thresholdB must be a valid number', 400))
    }
    if ((operator === 'BETWEEN' || operator === 'OUTSIDE') && thrB == null) {
      return next(new AppError('thresholdB is required for this operator', 400))
    }

    const data = await prisma.templateTrigger.create({
      data: {
        name: name.trim(),
        organizationId: orgId,
        deviceTemplateId,
        templateVariableId,
        operator,
        threshold: thr,
        thresholdB: thrB,
        anomalyType: anomalyType || 'threshold',
        priority: priority || 'MEDIUM',
        linkageVariableId: linkageVariableId || null,
        linkageAction: linkageAction || null,
        linkageValue: linkageValue != null ? String(linkageValue) : null,
        isActive: isActive !== undefined ? !!isActive : true,
        createdBy: req.user.id,
      },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update an alarm trigger
// @access SUPER_ADMIN | ORG_ADMIN | USER
const updateAlarmTemplate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.templateTrigger.findFirst({ where })
    if (!existing) return next(new AppError('Template trigger not found', 404))

    const {
      name, operator, threshold, thresholdB, anomalyType, priority,
      linkageVariableId, linkageAction, linkageValue, isActive,
      templateVariableId, deviceTemplateId, pushMethod, methods,
    } = req.body

    const updateData = {}

    if (name !== undefined) updateData.name = String(name).trim()
    if (operator !== undefined) updateData.operator = operator
    if (isActive !== undefined) updateData.isActive = !!isActive
    if (anomalyType !== undefined) updateData.anomalyType = anomalyType
    if (priority !== undefined) updateData.priority = priority
    if (linkageVariableId !== undefined) updateData.linkageVariableId = linkageVariableId || null
    if (linkageAction !== undefined) updateData.linkageAction = linkageAction || null
    if (linkageValue !== undefined) updateData.linkageValue = linkageValue != null ? String(linkageValue) : null
    if (templateVariableId !== undefined) updateData.templateVariableId = templateVariableId
    if (deviceTemplateId !== undefined) updateData.deviceTemplateId = deviceTemplateId

    if (threshold !== undefined && threshold !== null && threshold !== '') {
      const thr = parseThreshold(threshold)
      if (thr == null) return next(new AppError('threshold must be a valid number', 400))
      updateData.threshold = thr
    }
    if (thresholdB !== undefined) {
      if (thresholdB === null || thresholdB === '') updateData.thresholdB = null
      else {
        const thrB = parseThreshold(thresholdB)
        if (thrB == null) return next(new AppError('thresholdB must be a valid number', 400))
        updateData.thresholdB = thrB
      }
    }

    const nextOp = updateData.operator ?? existing.operator
    const nextB = updateData.thresholdB !== undefined ? updateData.thresholdB : existing.thresholdB
    if ((nextOp === 'BETWEEN' || nextOp === 'OUTSIDE') && nextB == null) {
      return next(new AppError('thresholdB is required for this operator', 400))
    }

    const data = await prisma.templateTrigger.update({
      where: { id: existing.id },
      data: updateData,
    })

    // Push channels live on AlarmSetting — sync when client sends methods / pushMethod.
    const methodList = Array.isArray(methods) ? methods.filter(Boolean)
      : (pushMethod != null && pushMethod !== '' ? [pushMethod] : null)
    if (methodList) {
      const joined = methodList.join(',') || null
      const linked = await prisma.alarmSetting.count({
        where: { templateTriggerId: existing.id, ...orgScope(req.user) },
      })
      if (linked) {
        await prisma.alarmSetting.updateMany({
          where: { templateTriggerId: existing.id, ...orgScope(req.user) },
          data: { pushMethod: joined },
        })
      } else if (joined) {
        await prisma.alarmSetting.create({
          data: {
            name: `${existing.name} notify`,
            organizationId: existing.organizationId,
            templateTriggerId: existing.id,
            pushMethod: joined,
            createdBy: req.user.id,
          },
        })
      }
    }

    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete an alarm trigger (removes linked alarm settings first)
// @access SUPER_ADMIN | ORG_ADMIN | USER
const deleteAlarmTemplate = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.templateTrigger.findFirst({ where })
    if (!existing) return next(new AppError('Template trigger not found', 404))

    await prisma.$transaction(async (tx) => {
      await tx.deviceVariableAlarmHistory.updateMany({
        where: { templateTriggerId: existing.id },
        data: { templateTriggerId: null },
      })
      await tx.deviceVariableLinkageHistory.updateMany({
        where: { templateTriggerId: existing.id },
        data: { templateTriggerId: null },
      })
      await tx.alarmSetting.deleteMany({ where: { templateTriggerId: existing.id } })
      await tx.templateTrigger.delete({ where: { id: existing.id } })
    })
    res.json({ success: true, message: 'Template trigger deleted' })
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('Template trigger not found', 404))
    next(err)
  }
}

// ─── ALARM SETTINGS ──────────────────────────────────────────────────────────

// @desc  List alarm settings with their linked devices and contacts
// @access SUPER_ADMIN | ORG_ADMIN
const getAlarmSettings = async (req, res, next) => {
  try {
    const { page, limit, skip }         = paginate(req.query)
    const { organizationId, templateTriggerId } = req.query

    const where = { ...orgScope(req.user, organizationId) }
    if (templateTriggerId) where.templateTriggerId = templateTriggerId

    const [data, total] = await Promise.all([
      prisma.alarmSetting.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          trigger:        { select: { id: true, name: true, anomalyType: true } },
          configDevices:  { include: { device: { select: { id: true, name: true } } } },
          configContacts: { include: { alarmContact: true } },
        },
      }),
      prisma.alarmSetting.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create an alarm setting with optional device + contact associations
// @access SUPER_ADMIN | ORG_ADMIN | USER
const createAlarmSetting = async (req, res, next) => {
  try {
    const { name, organizationId, templateTriggerId, pushType, pushBody, pushMethod, pushingMechanism, status, deviceIds, contactIds } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId
    if (!orgId) return next(new AppError('Organization is required', 400))

    const data = await prisma.$transaction(async (tx) => {
      const setting = await tx.alarmSetting.create({
        data: {
          name: name || 'Alarm notify',
          organizationId: orgId,
          templateTriggerId,
          pushType,
          pushBody,
          pushMethod,
          pushingMechanism,
          status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          createdBy: req.user.id,
        },
      })
      if (deviceIds?.length) {
        await tx.alarmConfigurationDevice.createMany({
          data: deviceIds.map((deviceId) => ({ alarmSettingId: setting.id, deviceId })),
        })
      }
      if (contactIds?.length) {
        await tx.alarmConfigurationContact.createMany({
          data: contactIds.map((alarmContactId) => ({ alarmSettingId: setting.id, alarmContactId })),
        })
      }
      return setting
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update alarm setting; replaces device/contact lists when provided
// @access SUPER_ADMIN | ORG_ADMIN | USER
const updateAlarmSetting = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.alarmSetting.findFirst({ where })
    if (!existing) return next(new AppError('Alarm setting not found', 404))

    const { name, pushType, pushBody, pushMethod, pushingMechanism, status, deviceIds, contactIds } = req.body

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (pushType !== undefined) updateData.pushType = pushType
    if (pushBody !== undefined) updateData.pushBody = pushBody
    if (pushMethod !== undefined) updateData.pushMethod = pushMethod
    if (pushingMechanism !== undefined) updateData.pushingMechanism = pushingMechanism
    if (status !== undefined) updateData.status = status

    const data = await prisma.$transaction(async (tx) => {
      const updated = await tx.alarmSetting.update({
        where: { id: req.params.id },
        data: updateData,
      })
      if (deviceIds !== undefined) {
        await tx.alarmConfigurationDevice.deleteMany({ where: { alarmSettingId: req.params.id } })
        if (deviceIds.length) {
          await tx.alarmConfigurationDevice.createMany({
            data: deviceIds.map((deviceId) => ({ alarmSettingId: req.params.id, deviceId })),
          })
        }
      }
      if (contactIds !== undefined) {
        await tx.alarmConfigurationContact.deleteMany({ where: { alarmSettingId: req.params.id } })
        if (contactIds.length) {
          await tx.alarmConfigurationContact.createMany({
            data: contactIds.map((alarmContactId) => ({ alarmSettingId: req.params.id, alarmContactId })),
          })
        }
      }
      return updated
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete an alarm setting (cascades contacts/devices via DB)
// @access SUPER_ADMIN | ORG_ADMIN | USER
const deleteAlarmSetting = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.alarmSetting.findFirst({ where })
    if (!existing) return next(new AppError('Alarm setting not found', 404))
    await prisma.alarmSetting.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Alarm setting deleted' })
  } catch (err) { next(err) }
}

// ─── ALARM CONTACTS ──────────────────────────────────────────────────────────

// @desc  List alarm contacts; searchable by name or mobile
// @access SUPER_ADMIN | ORG_ADMIN | USER
const getAlarmContacts = async (req, res, next) => {
  try {
    const { page, limit, skip }   = paginate(req.query)
    const { organizationId, search } = req.query

    const where = { ...orgScope(req.user, organizationId) }
    if (search) where.OR = [
      { name:   { contains: search, mode: 'insensitive' } },
      { mobile: { contains: search, mode: 'insensitive' } },
    ]

    const [data, total] = await Promise.all([
      prisma.alarmContact.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.alarmContact.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create an alarm contact
// @access SUPER_ADMIN | ORG_ADMIN | USER
const createAlarmContact = async (req, res, next) => {
  try {
    const { name, organizationId, mobile, email, whatsapp, remark } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId
    if (!orgId) return next(new AppError('Organization is required', 400))
    if (!name?.trim()) return next(new AppError('Contact name is required', 400))
    const data  = await prisma.alarmContact.create({
      data: {
        name: name.trim(),
        organizationId: orgId,
        mobile: mobile || null,
        email: email || null,
        whatsapp: whatsapp || null,
        remark: remark || null,
        createdBy: req.user.id,
      },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update an alarm contact
// @access SUPER_ADMIN | ORG_ADMIN | USER
const updateAlarmContact = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.alarmContact.findFirst({ where })
    if (!existing) return next(new AppError('Alarm contact not found', 404))

    const { name, mobile, email, whatsapp, remark } = req.body
    const data = await prisma.alarmContact.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(mobile !== undefined ? { mobile } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(whatsapp !== undefined ? { whatsapp } : {}),
        ...(remark !== undefined ? { remark } : {}),
      },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete an alarm contact; blocked if linked to a setting
// @access SUPER_ADMIN | ORG_ADMIN | USER
const deleteAlarmContact = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.alarmContact.findFirst({ where })
    if (!existing) return next(new AppError('Alarm contact not found', 404))

    const inUse = await prisma.alarmConfigurationContact.count({ where: { alarmContactId: existing.id } })
    if (inUse) return next(new AppError('Contact is linked to an alarm setting.', 400))

    await prisma.alarmContact.delete({ where: { id: existing.id } })
    res.json({ success: true, message: 'Alarm contact deleted' })
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('Alarm contact not found', 404))
    next(err)
  }
}

// ─── ALARM HISTORY — Notification log ────────────────────────────────────────

// @desc  List alarm notification send history
// @access SUPER_ADMIN | ORG_ADMIN
const getAlarmHistoryNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip }       = paginate(req.query)
    const { organizationId, deviceId, from, to } = req.query

    const where = { ...orgScope(req.user, organizationId) }
    if (deviceId) where.deviceId = deviceId
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.sentAt = dateRange

    const [data, total] = await Promise.all([
      prisma.alarmHistoryNotification.findMany({ where, skip, take: limit, orderBy: { sentAt: 'desc' } }),
      prisma.alarmHistoryNotification.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// ─── ALARM HISTORY — Variable alarms ─────────────────────────────────────────

// @desc  List variable alarm history records with state/process filters
// @access SUPER_ADMIN | ORG_ADMIN
const getVariableAlarmHistory = async (req, res, next) => {
  try {
    const { page, limit, skip }                                      = paginate(req.query)
    const { organizationId, deviceId, alarmState, processState, from, to } = req.query

    const where = { ...orgScope(req.user, organizationId) }
    if (deviceId)     where.deviceId     = deviceId
    if (alarmState)   where.alarmState   = alarmState
    if (processState) where.processState = processState
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.alarmTime = dateRange

    const [data, total] = await Promise.all([
      prisma.deviceVariableAlarmHistory.findMany({
        where, skip, take: limit, orderBy: { alarmTime: 'desc' },
        include: {
          device: { select: { id: true, name: true } },
        },
      }),
      prisma.deviceVariableAlarmHistory.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Mark a variable alarm as PROCESSED
// @access SUPER_ADMIN | ORG_ADMIN
const processVariableAlarm = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.deviceVariableAlarmHistory.findFirst({ where })
    if (!existing) return next(new AppError('Alarm record not found', 404))

    const data = await prisma.deviceVariableAlarmHistory.update({
      where: { id: existing.id },
      data:  { processState: 'PROCESSED', alarmState: 'RESOLVED' },
    })
    res.json({ success: true, data })
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('Alarm record not found', 404))
    next(err)
  }
}

// @desc  Batch-delete variable alarms by id list OR device+date range
// @access SUPER_ADMIN | ORG_ADMIN
const batchDeleteVariableAlarms = async (req, res, next) => {
  try {
    const { ids, deviceId, from, to } = req.body
    const where = { ...orgScope(req.user) }

    if (ids?.length) {
      where.id = { in: ids }
    } else {
      if (deviceId) where.deviceId = deviceId
      const dateRange = buildDateRange(from, to)
      if (dateRange) where.alarmTime = dateRange
    }

    const result = await prisma.deviceVariableAlarmHistory.deleteMany({ where })
    res.json({ success: true, deleted: result.count })
  } catch (err) { next(err) }
}

// @desc  Stream variable alarm history as CSV (paginated 500-row cursor)
// @access SUPER_ADMIN | ORG_ADMIN
const downloadVariableAlarmCSV = async (req, res, next) => {
  try {
    const { organizationId, deviceId, alarmState, processState, from, to } = req.query
    const where = { ...orgScope(req.user, organizationId) }
    if (deviceId)     where.deviceId     = deviceId
    if (alarmState)   where.alarmState   = alarmState
    if (processState) where.processState = processState
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.alarmTime = dateRange

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=variable-alarms.csv')
    res.write('deviceName,variableName,triggerName,triggerType,slaveName,currentValue,triggeringCondition,alarmState,processState,alarmTime\n')

    let skip = 0
    const BATCH = 500
    while (true) {
      const rows = await prisma.deviceVariableAlarmHistory.findMany({
        where,
        orderBy: { alarmTime: 'desc' },
        skip,
        take: BATCH,
        include: { device: { select: { name: true } } },
      })
      if (!rows.length) break
      for (const r of rows) {
        const esc = (v) => {
          const s = v == null ? '' : String(v)
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s
        }
        res.write(
          `${esc(r.device?.name)},${esc(r.variableName)},${esc(r.triggerName)},${esc(r.triggerType)},` +
          `${esc(r.slaveName)},${esc(r.currentValue)},${esc(r.triggeringCondition)},` +
          `${esc(r.alarmState)},${esc(r.processState)},${new Date(r.alarmTime).toISOString()}\n`
        )
      }
      if (rows.length < BATCH) break
      skip += BATCH
    }
    res.end()
  } catch (err) { next(err) }
}

// ─── LINKAGE HISTORY ─────────────────────────────────────────────────────────

// @desc  List linkage action history for triggered alarms
// @access SUPER_ADMIN | ORG_ADMIN
const getLinkageHistory = async (req, res, next) => {
  try {
    const { page, limit, skip }               = paginate(req.query)
    const { organizationId, deviceId, from, to } = req.query

    const where = { ...orgScope(req.user, organizationId) }
    if (deviceId) where.deviceId = deviceId
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.firedAt = dateRange

    const [data, total] = await Promise.all([
      prisma.deviceVariableLinkageHistory.findMany({
        where, skip, take: limit, orderBy: { firedAt: 'desc' },
        include: {
          device:  { select: { id: true, name: true } },
          trigger: {
            select: {
              name: true,
              anomalyType: true,
              operator: true,
              threshold: true,
              linkageAction: true,
              watchedVariable: { select: { name: true } },
              linkageVariable: { select: { name: true } },
            },
          },
        },
      }),
      prisma.deviceVariableLinkageHistory.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Batch-delete linkage history by id list OR device+date range
// @access SUPER_ADMIN | ORG_ADMIN
const batchDeleteLinkageHistory = async (req, res, next) => {
  try {
    const { ids, deviceId, from, to } = req.body
    const where = { ...orgScope(req.user) }

    if (ids?.length) {
      where.id = { in: ids }
    } else {
      if (deviceId) where.deviceId = deviceId
      const dateRange = buildDateRange(from, to)
      if (dateRange) where.firedAt = dateRange
    }

    const result = await prisma.deviceVariableLinkageHistory.deleteMany({ where })
    res.json({ success: true, deleted: result.count })
  } catch (err) { next(err) }
}

// @desc  Stream linkage history as CSV
// @access SUPER_ADMIN | ORG_ADMIN
const downloadLinkageHistoryCSV = async (req, res, next) => {
  try {
    const { organizationId, deviceId, from, to } = req.query
    const where = { ...orgScope(req.user, organizationId) }
    if (deviceId) where.deviceId = deviceId
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.firedAt = dateRange

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=linkage-records.csv')
    res.write('deviceName,triggerName,triggerType,watchedVariableName,watchedVariableValue,linkedVariableName,actionTaken,condition,firedAt\n')

    let skip = 0
    const BATCH = 500
    while (true) {
      const rows = await prisma.deviceVariableLinkageHistory.findMany({
        where,
        orderBy: { firedAt: 'desc' },
        skip,
        take: BATCH,
        include: {
          device:  { select: { name: true } },
          trigger: {
            select: {
              anomalyType: true,
              operator: true,
              threshold: true,
              watchedVariable: { select: { name: true } },
            },
          },
        },
      })
      if (!rows.length) break
      for (const r of rows) {
        const esc = (v) => {
          const s = v == null ? '' : String(v)
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s
        }
        const condition = r.trigger
          ? `${r.trigger.watchedVariable?.name || r.watchedVariableName || ''} ${r.trigger.operator || ''} ${r.trigger.threshold ?? ''}`.trim()
          : ''
        res.write(
          `${esc(r.device?.name)},${esc(r.triggerName)},${esc(r.trigger?.anomalyType)},` +
          `${esc(r.watchedVariableName)},${esc(r.watchedVariableValue)},${esc(r.linkedVariableName)},` +
          `${esc(r.actionTaken)},${esc(condition)},${new Date(r.firedAt).toISOString()}\n`
        )
      }
      if (rows.length < BATCH) break
      skip += BATCH
    }
    res.end()
  } catch (err) { next(err) }
}

module.exports = {
  getAlarmTemplates, createAlarmTemplate, updateAlarmTemplate, deleteAlarmTemplate,
  getAlarmSettings,  createAlarmSetting,  updateAlarmSetting,  deleteAlarmSetting,
  getAlarmContacts,  createAlarmContact,  updateAlarmContact,  deleteAlarmContact,
  getAlarmHistoryNotifications,
  getVariableAlarmHistory, processVariableAlarm, batchDeleteVariableAlarms, downloadVariableAlarmCSV,
  getLinkageHistory, batchDeleteLinkageHistory, downloadLinkageHistoryCSV,
}
