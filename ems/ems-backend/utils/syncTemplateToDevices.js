/**
 * Push template slaves/variables onto all devices already provisioned from that template.
 * Device create clones the template once; later template edits need this sync
 * so MQTT mapping and dashboards see new register variables.
 */
const prisma = require('../config/database')
const logger = require('./logger')

const syncTemplateToDevices = async (templateId) => {
  if (!templateId) return { devices: 0, slavesAdded: 0, variablesAdded: 0 }

  const templateSlaves = await prisma.deviceTemplateSlave.findMany({
    where: { templateId },
    include: {
      variables: { where: { isActive: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const devices = await prisma.device.findMany({
    where: { templateId },
    select: { id: true, organizationId: true },
  })

  let slavesAdded = 0
  let variablesAdded = 0

  for (const device of devices) {
    const existingSlaves = await prisma.deviceConfigSlave.findMany({
      where: { deviceId: device.id },
      include: { configVariables: { select: { id: true, templateVariableId: true } } },
    })
    const slaveByTemplateId = new Map(
      existingSlaves.filter((s) => s.templateSlaveId).map((s) => [s.templateSlaveId, s])
    )
    // Fallback match by name for older rows without templateSlaveId
    const slaveByName = new Map(
      existingSlaves.map((s) => [s.name.trim().toLowerCase(), s])
    )

    for (const tSlave of templateSlaves) {
      let configSlave = slaveByTemplateId.get(tSlave.id) || slaveByName.get(tSlave.name.trim().toLowerCase())

      if (!configSlave) {
        configSlave = await prisma.deviceConfigSlave.create({
          data: {
            deviceId: device.id,
            templateSlaveId: tSlave.id,
            organizationId: device.organizationId,
            name: tSlave.name,
            description: tSlave.description,
            isDefault: tSlave.isDefault,
            isActive: true,
          },
          include: { configVariables: { select: { id: true, templateVariableId: true } } },
        })
        slavesAdded += 1
      } else {
        // Keep provisioned slave metadata in sync with template (name/default/etc.)
        const needsMeta =
          !configSlave.templateSlaveId ||
          configSlave.name !== tSlave.name ||
          configSlave.description !== tSlave.description ||
          configSlave.isDefault !== tSlave.isDefault
        if (needsMeta) {
          configSlave = await prisma.deviceConfigSlave.update({
            where: { id: configSlave.id },
            data: {
              templateSlaveId: tSlave.id,
              name: tSlave.name,
              description: tSlave.description,
              isDefault: tSlave.isDefault,
            },
            include: { configVariables: { select: { id: true, templateVariableId: true } } },
          })
        }
      }

      const existingVarIds = new Set(
        (configSlave.configVariables || [])
          .map((v) => v.templateVariableId)
          .filter(Boolean)
      )

      const toCreate = []
      for (const tVar of tSlave.variables) {
        if (existingVarIds.has(tVar.id)) {
          await prisma.deviceConfigVariable.updateMany({
            where: { deviceId: device.id, templateVariableId: tVar.id },
            data: {
              name: tVar.name,
              displayName: tVar.displayName,
              unit: tVar.unit,
              isActive: tVar.isActive !== false,
            },
          })
          continue
        }
        toCreate.push({
          deviceId: device.id,
          deviceConfigSlaveId: configSlave.id,
          templateVariableId: tVar.id,
          organizationId: device.organizationId,
          name: tVar.name,
          displayName: tVar.displayName,
          unit: tVar.unit,
          isActive: true,
        })
      }

      if (toCreate.length) {
        await prisma.deviceConfigVariable.createMany({ data: toCreate })
        variablesAdded += toCreate.length
      }
    }
  }

  logger.info('template synced to devices', {
    templateId,
    devices: devices.length,
    slavesAdded,
    variablesAdded,
  })

  return { devices: devices.length, slavesAdded, variablesAdded }
}

module.exports = { syncTemplateToDevices }
