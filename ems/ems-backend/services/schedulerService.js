// ─── Scheduler service ────────────────────────────────────────────────────────
// Manages node-cron jobs for device switch schedules.
//
// Job lifecycle:
//   • addTask(task)    — registers or replaces a cron job in the in-memory Map
//   • removeTask(id)   — stops and removes a job
//   • initScheduler()  — called at startup; loads all ACTIVE tasks from DB
//
// On execution a job updates Device.switchState, emits device:switch via
// Socket.IO, writes a ScheduleExecutionLog row, and self-deactivates if
// repeatType === 'ONCE'.
const cron   = require('node-cron')
const prisma = require('../config/database')

/** In-memory map from task id → cron.ScheduledTask */
const jobs = new Map()

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a ScheduledTask record into a cron expression.
 * WEEKLY tasks include specific days; all others run every day at the given time.
 */
const buildExpression = (task) => {
  const [hour, minute] = task.scheduledTime.split(':')
  if (task.repeatType === 'WEEKLY' && task.daysOfWeek?.length) {
    return `${minute} ${hour} * * ${task.daysOfWeek.join(',')}`
  }
  return `${minute} ${hour} * * *`
}

/** Run a scheduled task: update device switch, emit Socket.IO event, log result. */
const executeTask = async (task) => {
  let result = 'SUCCESS'
  let errorMessage

  try {
    await prisma.device.update({ where: { id: task.deviceId }, data: { switchState: task.action } })

    try {
      const { getIO } = require('../socket')
      getIO().to(`org_${task.organizationId}`).emit('device:switch', { deviceId: task.deviceId, action: task.action })
    } catch (_) { /* socket may not be ready on first boot */ }

    // ONCE tasks deactivate themselves after the first execution
    if (task.repeatType === 'ONCE') {
      await prisma.scheduledTask.update({ where: { id: task.id }, data: { status: 'INACTIVE' } })
      removeTask(task.id)
    }
  } catch (err) {
    result       = 'FAILED'
    errorMessage = err.message
    console.error(`schedulerService: task ${task.id} error:`, err.message)
  }

  // Write execution log regardless of success/failure
  try {
    await prisma.scheduleExecutionLog.create({
      data: {
        scheduleTaskId: task.id,
        deviceId:       task.deviceId,
        organizationId: task.organizationId,
        action:         task.action,
        variableName:   task.variableName,
        result,
        errorMessage,
      },
    })
  } catch (logErr) {
    console.error('schedulerService: failed to write execution log:', logErr.message)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Register (or replace) a cron job for the given task. */
const addTask = (task) => {
  const expression = buildExpression(task)

  if (!cron.validate(expression)) {
    console.error(`schedulerService: invalid expression "${expression}" for task ${task.id}`)
    return
  }

  removeTask(task.id)
  const job = cron.schedule(expression, () => executeTask(task), { scheduled: true, timezone: 'UTC' })
  jobs.set(task.id, job)
}

/** Stop and remove a cron job. Safe to call when the task doesn't exist. */
const removeTask = (taskId) => {
  const job = jobs.get(taskId)
  if (job) { job.stop(); jobs.delete(taskId) }
}

/** Load all ACTIVE tasks from the database and register them at startup. */
const initScheduler = async () => {
  try {
    const tasks = await prisma.scheduledTask.findMany({ where: { status: 'ACTIVE' } })
    for (const task of tasks) addTask(task)
    console.log(`schedulerService: registered ${tasks.length} active cron tasks`)
  } catch (err) {
    console.error('schedulerService.initScheduler error:', err.message)
  }
}

module.exports = { initScheduler, addTask, removeTask }
