// ─── Alarm linkage controller ─────────────────────────────────────────────────
// Four related resource groups exposed as separate routers (see routes/alarmLinkage.js):
//   • TemplateTriggers — define the condition (variable op threshold)
//   • AlarmSettings    — configure push type + device/contact lists for a trigger
//   • AlarmContacts    — phone/email recipients
//   • AlarmHistory     — both notification logs and variable alarm records
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate, buildDateRange } = require('../utils/helpers')

// ─── TEMPLATE TRIGGERS ───────────────────────────────────────────────────────

// @desc  List alarm template triggers; filterable by template and search
// @access SUPER_ADMIN | ORG_ADMIN
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
          deviceTemplate:  { select: { id: true, name: true } },
          watchedVariable: { select: { id: true, name: true, unit: true } },
          linkageVariable: { select: { id: true, name: true, unit: true } },
          creator:         { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.templateTrigger.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create an alarm trigger
// @access SUPER_ADMIN | ORG_ADMIN
const createAlarmTemplate = async (req, res, next) => {
  try {
    const {
      name, organizationId, deviceTemplateId, templateVariableId,
      operator, threshold, anomalyType, priority,
      linkageVariableId, linkageAction, linkageValue,
    } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId

    const data = await prisma.templateTrigger.create({
      data: {
        name, organizationId: orgId, deviceTemplateId, templateVariableId,
        operator, threshold: parseFloat(threshold), anomalyType, priority,
        linkageVariableId,
        linkageAction,
        linkageValue:  linkageValue != null ? String(linkageValue) : null,
        createdBy:     req.user.id,
      },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update an alarm trigger
// @access SUPER_ADMIN | ORG_ADMIN
const updateAlarmTemplate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.templateTrigger.findFirst({ where })
    if (!existing) return next(new AppError('Template trigger not found', 404))

    const { name, operator, threshold, anomalyType, priority, linkageVariableId, linkageAction, linkageValue, isActive } = req.body
    const data = await prisma.templateTrigger.update({
      where: { id: req.params.id },
      data: {
        name, operator,
        threshold:     threshold    != null ? parseFloat(threshold)    : undefined,
        anomalyType, priority, linkageVariableId, linkageAction,
        linkageValue:  linkageValue != null ? String(linkageValue) : undefined,
        isActive,
      },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete an alarm trigger; blocked if linked to an alarm setting
// @access SUPER_ADMIN | ORG_ADMIN
const deleteAlarmTemplate = async (req, res, next) => {
  try {
    const inUse = await prisma.alarmSetting.count({ where: { templateTriggerId: req.params.id } })
    if (inUse) return next(new AppError('Trigger is in use by an alarm setting.', 400))

    await prisma.templateTrigger.delete({ where: { id: req.params.id } })
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
// @access SUPER_ADMIN | ORG_ADMIN
const createAlarmSetting = async (req, res, next) => {
  try {
    const { name, organizationId, templateTriggerId, pushType, pushBody, pushMethod, pushingMechanism, deviceIds, contactIds } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId

    const data = await prisma.$transaction(async (tx) => {
      const setting = await tx.alarmSetting.create({
        data: { name, organizationId: orgId, templateTriggerId, pushType, pushBody, pushMethod, pushingMechanism, status: 'ACTIVE', createdBy: req.user.id },
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
// @access SUPER_ADMIN | ORG_ADMIN
const updateAlarmSetting = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.alarmSetting.findFirst({ where })
    if (!existing) return next(new AppError('Alarm setting not found', 404))

    const { name, pushType, pushBody, pushMethod, pushingMechanism, status, deviceIds, contactIds } = req.body

    const data = await prisma.$transaction(async (tx) => {
      const updated = await tx.alarmSetting.update({
        where: { id: req.params.id },
        data:  { name, pushType, pushBody, pushMethod, pushingMechanism, status },
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
// @access SUPER_ADMIN | ORG_ADMIN
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
// @access SUPER_ADMIN | ORG_ADMIN
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
// @access SUPER_ADMIN | ORG_ADMIN
const createAlarmContact = async (req, res, next) => {
  try {
    const { name, organizationId, mobile, email, whatsapp, remark } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId
    const data  = await prisma.alarmContact.create({
      data: { name, organizationId: orgId, mobile, email, whatsapp, remark, createdBy: req.user.id },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update an alarm contact
// @access SUPER_ADMIN | ORG_ADMIN
const updateAlarmContact = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.alarmContact.findFirst({ where })
    if (!existing) return next(new AppError('Alarm contact not found', 404))

    const { name, mobile, email, whatsapp, remark } = req.body
    const data = await prisma.alarmContact.update({ where: { id: req.params.id }, data: { name, mobile, email, whatsapp, remark } })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete an alarm contact; blocked if linked to a setting
// @access SUPER_ADMIN | ORG_ADMIN
const deleteAlarmContact = async (req, res, next) => {
  try {
    const inUse = await prisma.alarmConfigurationContact.count({ where: { alarmContactId: req.params.id } })
    if (inUse) return next(new AppError('Contact is linked to an alarm setting.', 400))

    await prisma.alarmContact.delete({ where: { id: req.params.id } })
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
      prisma.deviceVariableAlarmHistory.findMany({ where, skip, take: limit, orderBy: { alarmTime: 'desc' } }),
      prisma.deviceVariableAlarmHistory.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Mark a variable alarm as PROCESSED
// @access SUPER_ADMIN | ORG_ADMIN
const processVariableAlarm = async (req, res, next) => {
  try {
    const data = await prisma.deviceVariableAlarmHistory.update({
      where: { id: req.params.id },
      data:  { processState: 'PROCESSED' },
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
    const { deviceId, alarmState, processState, from, to } = req.query
    const where = { ...orgScope(req.user) }
    if (deviceId)     where.deviceId     = deviceId
    if (alarmState)   where.alarmState   = alarmState
    if (processState) where.processState = processState
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.alarmTime = dateRange

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=variable-alarms.csv')
    res.write('variableName,triggerName,triggerType,currentValue,triggeringCondition,alarmState,processState,alarmTime\n')

    let skip = 0
    const BATCH = 500
    while (true) {
      const rows = await prisma.deviceVariableAlarmHistory.findMany({ where, orderBy: { alarmTime: 'desc' }, skip, take: BATCH })
      if (!rows.length) break
      for (const r of rows) {
        res.write(
          `${r.variableName},${r.triggerName || ''},${r.triggerType || ''},` +
          `${r.currentValue ?? ''},${r.triggeringCondition || ''},` +
          `${r.alarmState},${r.processState},${new Date(r.alarmTime).toISOString()}\n`
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
      prisma.deviceVariableLinkageHistory.findMany({ where, skip, take: limit, orderBy: { firedAt: 'desc' } }),
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
    const { deviceId, from, to } = req.query
    const where = { ...orgScope(req.user) }
    if (deviceId) where.deviceId = deviceId
    const dateRange = buildDateRange(from, to)
    if (dateRange) where.firedAt = dateRange

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=linkage-history.csv')
    res.write('triggerName,watchedVariableName,watchedVariableValue,linkedVariableName,actionTaken,firedAt\n')

    let skip = 0
    const BATCH = 500
    while (true) {
      const rows = await prisma.deviceVariableLinkageHistory.findMany({ where, orderBy: { firedAt: 'desc' }, skip, take: BATCH })
      if (!rows.length) break
      for (const r of rows) {
        res.write(
          `${r.triggerName || ''},${r.watchedVariableName || ''},${r.watchedVariableValue ?? ''},` +
          `${r.linkedVariableName || ''},${r.actionTaken || ''},${new Date(r.firedAt).toISOString()}\n`
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
