// ─── Scheduled task controller ────────────────────────────────────────────────
// Manages cron-based device switch schedules.  Every write operation is mirrored
// to the in-memory scheduler (addTask / removeTask) so that changes take effect
// immediately without a server restart.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')
const { addTask, removeTask } = require('../services/schedulerService')
const { assertDeviceAccess, listAccessibleDeviceIds } = require('../utils/deviceAccess')

/** Load a scheduled task in the caller's org and enforce device ACL for USER. */
const findAccessibleTask = async (id, user) => {
  const existing = await prisma.scheduledTask.findFirst({
    where: { id, ...orgScope(user) },
  })
  if (!existing) return null
  await assertDeviceAccess(existing.deviceId, user)
  return existing
}

// @desc  List scheduled tasks; filterable by device and status
// @access SUPER_ADMIN | ORG_ADMIN | USER (ACL-scoped devices)
const getScheduledTasks = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user) }
    if (req.query.deviceId) where.deviceId = req.query.deviceId
    if (req.query.status)   where.status   = req.query.status

    const accessibleIds = await listAccessibleDeviceIds(req.user)
    if (accessibleIds) {
      if (req.query.deviceId && !accessibleIds.includes(req.query.deviceId)) {
        return res.json({ success: true, data: [], total: 0, page, pages: 1 })
      }
      where.deviceId = req.query.deviceId
        ? req.query.deviceId
        : { in: accessibleIds.length ? accessibleIds : ['__none__'] }
    }

    const [data, total] = await Promise.all([
      prisma.scheduledTask.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          device: { select: { id: true, name: true } },
          creator: { select: { id: true, fullName: true } },
        },
      }),
      prisma.scheduledTask.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a scheduled task and register it in the cron scheduler
// @access SUPER_ADMIN | ORG_ADMIN | USER (ACL-scoped device)
const createScheduledTask = async (req, res, next) => {
  try {
    const {
      organizationId, deviceId, deviceConfigSlaveId, deviceConfigVariableId,
      variableName, action, scheduledTime, repeatType, daysOfWeek, status,
    } = req.body

    const device = await assertDeviceAccess(deviceId, req.user)
    const orgId = req.user.role === 'SUPER_ADMIN'
      ? (organizationId || device.organizationId)
      : req.user.organizationId

    const data = await prisma.scheduledTask.create({
      data: {
        organizationId: orgId, createdBy: req.user.id,
        deviceId, deviceConfigSlaveId, deviceConfigVariableId,
        variableName, action, scheduledTime, repeatType,
        daysOfWeek: daysOfWeek || [],
        ...(status ? { status } : {}),
      },
    })

    if (data.status === 'ACTIVE') addTask(data)
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a scheduled task; re-registers the cron job
// @access SUPER_ADMIN | ORG_ADMIN | USER (ACL-scoped device)
const updateScheduledTask = async (req, res, next) => {
  try {
    const existing = await findAccessibleTask(req.params.id, req.user)
    if (!existing) return next(new AppError('Scheduled task not found', 404))

    const { variableName, action, scheduledTime, repeatType, daysOfWeek, status } = req.body
    const data = await prisma.scheduledTask.update({
      where: { id: req.params.id },
      data:  { variableName, action, scheduledTime, repeatType, daysOfWeek, status },
    })

    removeTask(req.params.id)
    if (data.status === 'ACTIVE') addTask(data)

    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a scheduled task and its execution logs; removes cron job
// @access SUPER_ADMIN | ORG_ADMIN | USER (ACL-scoped device)
const deleteScheduledTask = async (req, res, next) => {
  try {
    const existing = await findAccessibleTask(req.params.id, req.user)
    if (!existing) return next(new AppError('Scheduled task not found', 404))

    await prisma.$transaction([
      prisma.scheduleExecutionLog.deleteMany({ where: { scheduleTaskId: req.params.id } }),
      prisma.scheduledTask.delete({ where: { id: req.params.id } }),
    ])

    removeTask(req.params.id)
    res.json({ success: true, message: 'Scheduled task deleted' })
  } catch (err) { next(err) }
}

// @desc  Paginated execution log for a specific task
// @access SUPER_ADMIN | ORG_ADMIN | USER (ACL-scoped device)
const getTaskLogs = async (req, res, next) => {
  try {
    const existing = await findAccessibleTask(req.params.id, req.user)
    if (!existing) return next(new AppError('Scheduled task not found', 404))

    const { page, limit, skip } = paginate(req.query)
    const where = { scheduleTaskId: req.params.id }

    const [data, total] = await Promise.all([
      prisma.scheduleExecutionLog.findMany({ where, skip, take: limit, orderBy: { executedAt: 'desc' } }),
      prisma.scheduleExecutionLog.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Toggle a task between ACTIVE and INACTIVE; updates cron scheduler
// @access SUPER_ADMIN | ORG_ADMIN | USER (ACL-scoped device)
const toggleTask = async (req, res, next) => {
  try {
    const existing = await findAccessibleTask(req.params.id, req.user)
    if (!existing) return next(new AppError('Scheduled task not found', 404))

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const data      = await prisma.scheduledTask.update({ where: { id: req.params.id }, data: { status: newStatus } })

    if (newStatus === 'ACTIVE') addTask(data)
    else                        removeTask(req.params.id)

    res.json({ success: true, data })
  } catch (err) { next(err) }
}

module.exports = { getScheduledTasks, createScheduledTask, updateScheduledTask, deleteScheduledTask, toggleTask, getTaskLogs }
