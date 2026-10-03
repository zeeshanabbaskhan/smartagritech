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
 * Day-of-month for MONTHLY tasks (1–31).
 * Optional: reuse daysOfWeek[0] when set (e.g. Org presets for 1st/15th).
 * Default: 1st of each month (matches CF dummy monthly schedules).
 */
const monthlyDayOfMonth = (task) => {
  const day = task.daysOfWeek?.[0]
  if (Number.isInteger(day) && day >= 1 && day <= 31) return day
  return 1
}

/**
 * Convert a ScheduledTask record into a cron expression.
 * WEEKLY: specific weekdays; MONTHLY: day-of-month (default 1st);
 * DAILY / ONCE: every day at the given time (ONCE self-deactivates after run).
 */
const buildExpression = (task) => {
  const [hour, minute] = task.scheduledTime.split(':')
  if (task.repeatType === 'WEEKLY' && task.daysOfWeek?.length) {
    return `${minute} ${hour} * * ${task.daysOfWeek.join(',')}`
  }
  if (task.repeatType === 'MONTHLY') {
    return `${minute} ${hour} ${monthlyDayOfMonth(task)} * *`
  }
  return `${minute} ${hour} * * *`
}

/** Run a scheduled task: update device switch, emit Socket.IO event, log result. */
const executeTask = async (task) => {
  let result = 'SUCCESS'
  let errorMessage

  try {
    await prisma.device.update({
      where: { id: task.deviceId },
      data: {
        switchState: task.action,
        ...(task.action === 'OFF' ? { status: 'OFFLINE' } : {}),
      },
    })

    try {
      const { getIO } = require('../socket')
      getIO().to(`org_${task.organizationId}`).emit('device:switch', {
        deviceId: task.deviceId,
        action: task.action,
        status: task.action === 'OFF' ? 'OFFLINE' : undefined,
      })
      if (task.action === 'OFF') {
        const { emitDeviceStatus } = require('./devicePresenceService')
        emitDeviceStatus(task.organizationId, task.deviceId, 'OFFLINE', {
          reason: 'schedule_switch_off',
          switchState: 'OFF',
        })
      }
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

/**
 * Daily purge of raw sensor readings older than TELEMETRY_RETENTION_DAYS (default 14 days).
 * Runs every day at 03:00 AM UTC to permanently prevent 291 GB disk bloat.
 */
const initRetentionCron = () => {
  const RETENTION_DAYS = parseInt(process.env.TELEMETRY_RETENTION_DAYS || '14', 10)
  if (RETENTION_DAYS <= 0) return

  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
      console.log(`[retention] Purging sensor data older than ${cutoff.toISOString()} (${RETENTION_DAYS} days)`)

      const deletedSr = await prisma.sensorReading.deleteMany({
        where: { timestamp: { lt: cutoff } },
      })

      let deletedSrv = 0
      try {
        if (prisma.sensorReadingValue) {
          const res = await prisma.sensorReadingValue.deleteMany({
            where: { timestamp: { lt: cutoff } },
          })
          deletedSrv = res.count
        }
      } catch (_) {}

      console.log(`[retention] Purge complete: ${deletedSr.count} sensor_readings, ${deletedSrv} sensor_reading_values removed.`)
    } catch (err) {
      console.error('[retention] Purge error:', err.message)
    }
  }, { scheduled: true, timezone: 'UTC' })

  console.log(`schedulerService: telemetry retention scheduled (keeps last ${RETENTION_DAYS} days)`)
}

/** Load all ACTIVE tasks from the database and register them at startup. */
const initScheduler = async () => {
  try {
    const tasks = await prisma.scheduledTask.findMany({ where: { status: 'ACTIVE' } })
    for (const task of tasks) addTask(task)
    console.log(`schedulerService: registered ${tasks.length} active cron tasks`)
    initRetentionCron()
  } catch (err) {
    console.error('schedulerService.initScheduler error:', err.message)
  }
}

module.exports = { initScheduler, addTask, removeTask, initRetentionCron }
