// ─── Anomaly detector service (P-15, P-16, P-41) ───────────────────────────

const prisma              = require('../config/database')
const userCache           = require('../utils/userCache')
const notificationService = require('./notificationService')

function evaluateCondition(val, operator, threshold) {
  switch (operator.toUpperCase()) {
    case 'GT':  return val >  threshold
    case 'LT':  return val <  threshold
    case 'GTE': return val >= threshold
    case 'LTE': return val <= threshold
    case 'EQ':  return val === threshold
    default:    return false
  }
}

async function runAnomalyCheck({ deviceId, organizationId, readings, io: hasIo }) {
  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) return

    const triggers = await prisma.templateTrigger.findMany({
      where: { deviceTemplateId: device.templateId, isActive: true },
    })
    if (!triggers.length) return

    const varIds = new Set()
    for (const t of triggers) {
      varIds.add(t.templateVariableId)
      if (t.linkageVariableId) varIds.add(t.linkageVariableId)
    }
    const templateVars = await prisma.deviceTemplateVariable.findMany({
      where: { id: { in: [...varIds] } },
    })
    const varById = Object.fromEntries(templateVars.map((v) => [v.id, v]))

    let io = null
    if (hasIo) {
      try { io = require('../socket').getIO() } catch (_) {}
    }

    for (const trigger of triggers) {
      const triggerVar = varById[trigger.templateVariableId]
      if (!triggerVar) continue

      const reading = readings.find((r) => r.variableName === triggerVar.name)
      if (!reading) continue

      const val      = parseFloat(reading.value)
      const breached = evaluateCondition(val, trigger.operator, trigger.threshold)
      if (!breached) continue

      if (await userCache.isAnomalyOnCooldown(deviceId, trigger.id)) continue

      const condition = `${triggerVar.name} ${trigger.operator} ${trigger.threshold}`

      await prisma.deviceVariableAlarmHistory.create({
        data: {
          deviceId,
          organizationId,
          templateTriggerId:   trigger.id,
          variableName:        triggerVar.name,
          triggerName:         trigger.name,
          triggerType:         trigger.anomalyType,
          currentValue:        val,
          triggeringCondition: condition,
          alarmState:          'ACTIVE',
          processState:        'UNPROCESSED',
        },
      })

      if (trigger.linkageVariableId) {
        const linkVar = varById[trigger.linkageVariableId]
        if (linkVar) {
          await prisma.deviceVariableLinkageHistory.create({
            data: {
              deviceId,
              organizationId,
              templateTriggerId:    trigger.id,
              triggerName:          trigger.name,
              watchedVariableName:  triggerVar.name,
              watchedVariableValue: val,
              linkedVariableName:   linkVar.name,
              actionTaken:          trigger.linkageAction ?? null,
            },
          })
        }
      }

      await notificationService.createNotification({ deviceId, organizationId, trigger, triggerVar, val })

      if (io) {
        io.to(`org_${organizationId}`).emit('alarm:new', {
          deviceId,
          triggerName: trigger.name,
          value:       val,
        })
      }
    }
  } catch (err) {
    require('../utils/logger').error('anomalyDetector error', { message: err.message })
  }
}

/** @deprecated use runAnomalyCheck via queue */
const checkAnomalies = runAnomalyCheck

module.exports = { checkAnomalies, runAnomalyCheck }
