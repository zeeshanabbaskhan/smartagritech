// Provision a device from a template (same steps as POST /api/devices).
const { hashKey, generateDeviceIngestKey } = require('./ingestAuth')
const { READING_RANGES } = require('./readingProfiles')

const rand = (min, max, dp = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(dp))

async function provisionDevice(tx, {
  name,
  templateId,
  gatewayId,
  organizationId,
  switchState = 'OFF',
  status = 'OFFLINE',
  seedCurrentValues = true,
}) {
  const ingestKey = generateDeviceIngestKey()
  const device = await tx.device.create({
    data: {
      name,
      templateId,
      gatewayId,
      organizationId,
      switchState,
      status,
      ingestApiKeyHash: hashKey(ingestKey),
    },
  })

  const slaves = await tx.deviceTemplateSlave.findMany({ where: { templateId } })
  for (const slave of slaves) {
    const cs = await tx.deviceConfigSlave.create({
      data: {
        deviceId: device.id,
        templateSlaveId: slave.id,
        organizationId,
        name: slave.name,
        description: slave.description,
        isDefault: slave.isDefault,
        isActive: true,
      },
    })

    const vars = await tx.deviceTemplateVariable.findMany({
      where: { templateSlaveId: slave.id, isActive: true },
    })
    if (vars.length) {
      const now = new Date()
      await tx.deviceConfigVariable.createMany({
        data: vars.map((v) => ({
          deviceId: device.id,
          deviceConfigSlaveId: cs.id,
          templateVariableId: v.id,
          organizationId,
          name: v.name,
          displayName: v.displayName,
          unit: v.unit,
          isActive: true,
          ...(seedCurrentValues
            ? {
                currentValue: String(rand(...(READING_RANGES[v.name] || [0, 100]))),
                lastUpdatedAt: now,
              }
            : {}),
        })),
      })
    }
  }

  await tx.deviceTimestamp.create({
    data: { deviceId: device.id, organizationId, lastActiveAt: new Date() },
  })

  return { device, ingestKey }
}

module.exports = { provisionDevice }
