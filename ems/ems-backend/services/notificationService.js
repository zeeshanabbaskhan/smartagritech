// ─── Notification service (P-17, P-40, P-55) ───────────────────────────────

const prisma      = require('../config/database')
const transporter = require('../config/nodemailer')

const enqueueEmailJob = async (payload) => {
  try {
    return await require('../workers/jobQueues').enqueueEmail(payload)
  } catch (_) {
    return false
  }
}

const createNotification = async ({ deviceId, organizationId, trigger, triggerVar, val }) => {
  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) return

    const users = await prisma.user.findMany({
      where:  { organizationId, status: 'ACTIVE' },
      select: { id: true },
    })

    if (users.length) {
      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId:        u.id,
          organizationId,
          triggerName:   trigger.name,
          deviceName:    device.name,
          description:   `${triggerVar.name} ${trigger.operator} ${trigger.threshold} (current: ${val})`,
          read:          false,
        })),
        skipDuplicates: true,
      })
    }

    await queueAlarmEmail({ deviceId, organizationId, trigger, triggerVar, val, deviceName: device.name })
  } catch (err) {
    require('../utils/logger').error('createNotification error', { message: err.message })
  }
}

const buildAlarmEmail = ({ deviceName, trigger, triggerVar, val }) => {
  const subject = `EMS Alert: ${trigger.name}`
  const text = [
    'EMS Alarm Notification', '',
    `Device   : ${deviceName}`,
    `Variable : ${triggerVar.name}`,
    `Value    : ${val}`,
    `Condition: ${triggerVar.name} ${trigger.operator} ${trigger.threshold}`,
    `Type     : ${trigger.anomalyType}`,
    `Time     : ${new Date().toISOString()}`,
  ].join('\n')
  return { subject, text }
}

const logHistory = async ({ alarmSettingId, organizationId, deviceId, text, pushType, sentTo, status }) => {
  await prisma.alarmHistoryNotification.create({
    data: { alarmSettingId, organizationId, deviceId, message: text, pushType, sentTo, status },
  }).catch((e) => require('../utils/logger').error('alarm history log error', { message: e.message }))
}

const queueAlarmEmail = async ({ deviceId, organizationId, trigger, triggerVar, val, deviceName }) => {
  try {
    const settings = await prisma.alarmSetting.findMany({
      where: { organizationId, pushType: 'email', status: 'ACTIVE' },
    })
    if (!settings.length) return

    const settingIds = settings.map((s) => s.id)
    const allContacts = await prisma.alarmConfigurationContact.findMany({
      where:   { alarmSettingId: { in: settingIds } },
      include: { alarmContact: true },
    })
    const contactsBySetting = {}
    for (const row of allContacts) {
      if (!contactsBySetting[row.alarmSettingId]) contactsBySetting[row.alarmSettingId] = []
      contactsBySetting[row.alarmSettingId].push(row.alarmContact)
    }

    const { subject, text } = buildAlarmEmail({ deviceName, trigger, triggerVar, val })

    for (const setting of settings) {
      const emailContacts = (contactsBySetting[setting.id] || []).filter((c) => c?.email)
      if (!emailContacts.length) continue
      const to = emailContacts.map((c) => c.email).join(', ')
      const meta = { alarmSettingId: setting.id, organizationId, deviceId, pushType: 'email' }

      const queued = await enqueueEmailJob({ to, subject, text, meta })
      if (!queued) {
        let status = 'SENT'
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.NODEMAILER_USER,
            to, subject, text,
          })
        } catch (mailErr) {
          status = 'FAILED'
          require('../utils/logger').error('email send error', { message: mailErr.message })
        }
        await logHistory({ ...meta, sentTo: to, text, status })
      }
    }
  } catch (err) {
    require('../utils/logger').error('queueAlarmEmail error', { message: err.message })
  }
}

const sendAlarmEmail = queueAlarmEmail

module.exports = {
  createNotification,
  sendAlarmEmail,
  logHistory,
}
