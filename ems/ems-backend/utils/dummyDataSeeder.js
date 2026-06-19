/**
 * Dummy data seeder — Prisma/PostgreSQL version.
 * Run standalone : node utils/dummyDataSeeder.js
 * Or import      : const { seedDummyData } = require('./utils/dummyDataSeeder')
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const prisma = require('../config/database')
const { READING_RANGES } = require('./readingProfiles')

// ─── helpers ──────────────────────────────────────────────────────────────────

const rand = (min, max, dp = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(dp))

// findFirst + create pattern for models that lack a unique constraint on the
// lookup field (Prisma upsert requires a unique/@@unique constraint).
const findOrCreate = async (model, where, createData) => {
  const found = await prisma[model].findFirst({ where })
  return found ?? (await prisma[model].create({ data: createData }))
}

// ─── static data ──────────────────────────────────────────────────────────────

const VARIABLE_DEFS = [
  { name: 'VoltageA',         unit: 'V',     registerAddress: '0x0001', displayName: 'Voltage Phase A'  },
  { name: 'VoltageB',         unit: 'V',     registerAddress: '0x0002', displayName: 'Voltage Phase B'  },
  { name: 'VoltageC',         unit: 'V',     registerAddress: '0x0003', displayName: 'Voltage Phase C'  },
  { name: 'CurrentA',         unit: 'A',     registerAddress: '0x0004', displayName: 'Current Phase A'  },
  { name: 'CurrentB',         unit: 'A',     registerAddress: '0x0005', displayName: 'Current Phase B'  },
  { name: 'CurrentC',         unit: 'A',     registerAddress: '0x0006', displayName: 'Current Phase C'  },
  { name: 'ActivePower',      unit: 'kW',    registerAddress: '0x0007', displayName: 'Active Power'     },
  { name: 'ReactivePower',    unit: 'kVar',  registerAddress: '0x0008', displayName: 'Reactive Power'   },
  { name: 'ApparentPower',    unit: 'kVA',   registerAddress: '0x0009', displayName: 'Apparent Power'   },
  { name: 'PowerConsumption', unit: 'kWh',   registerAddress: '0x000A', displayName: 'Power Consumption'},
  { name: 'ExportPower',      unit: 'kWh',   registerAddress: '0x000B', displayName: 'Export Power'     },
  { name: 'PowerFactor',      unit: 'ratio', registerAddress: '0x000C', displayName: 'Power Factor'     },
  { name: 'Frequency',        unit: 'Hz',    registerAddress: '0x000D', displayName: 'Frequency'        },
  { name: 'VoltageImbalance', unit: '%',     registerAddress: '0x000E', displayName: 'Voltage Imbalance'},
  { name: 'CurrentImbalance', unit: '%',     registerAddress: '0x000F', displayName: 'Current Imbalance'},
  { name: 'THD_V',            unit: '%',     registerAddress: '0x0010', displayName: 'THD Voltage'      },
  { name: 'THD_I',            unit: '%',     registerAddress: '0x0011', displayName: 'THD Current'      },
  { name: 'TotalCost',        unit: 'PKR',   registerAddress: '0x0012', displayName: 'Total Cost'       },
]

// READING_RANGES imported from ./readingProfiles.js

// ─── seeder ───────────────────────────────────────────────────────────────────

const seedDummyData = async () => {

  // ── 1. Theme ─────────────────────────────────────────────────────────────────
  const theme = await findOrCreate(
    'theme',
    { name: 'Default' },
    {
      name:            'Default',
      headerBgColor:   '#1a1a2e',
      headerFontColor: '#ffffff',
      bodyBgColor:     '#f5f5f5',
      bodyFontColor:   '#333333',
      status:          'ACTIVE',
    }
  )
  console.log('Theme:', theme.name)

  // ── 2. Organization ───────────────────────────────────────────────────────────
  const org = await findOrCreate(
    'organization',
    { name: 'Smart Agritech Lab' },
    {
      name:        'Smart Agritech Lab',
      description: 'SEECS IoT Research Lab',
      status:      'ACTIVE',
      themeId:     theme.id,
    }
  )
  console.log('Organization:', org.name)

  // ── 3. SUPER_ADMIN ────────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where:  { email: 'superadmin@ems.com' },
    update: {},
    create: {
      fullName:     'Super Admin',
      email:        'superadmin@ems.com',
      passwordHash: await bcrypt.hash('Admin@123456', 12),
      role:         'SUPER_ADMIN',
      status:       'ACTIVE',
    },
  })
  console.log('Super Admin:', superAdmin.email)

  // ── 4. ORG_ADMIN ──────────────────────────────────────────────────────────────
  const orgAdmin = await prisma.user.upsert({
    where:  { email: 'orgadmin@ems.com' },
    update: {},
    create: {
      fullName:       'Lab Admin',
      email:          'orgadmin@ems.com',
      passwordHash:   await bcrypt.hash('Admin@123456', 12),
      role:           'ORG_ADMIN',
      organizationId: org.id,
      status:         'ACTIVE',
    },
  })
  console.log('Org Admin:', orgAdmin.email)

  // ── 5. Regular USER ───────────────────────────────────────────────────────────
  const regularUser = await prisma.user.upsert({
    where:  { email: 'user@ems.com' },
    update: {},
    create: {
      fullName:       'Lab User',
      email:          'user@ems.com',
      passwordHash:   await bcrypt.hash('User@123456', 12),
      role:           'USER',
      organizationId: org.id,
      status:         'ACTIVE',
    },
  })
  console.log('Regular User:', regularUser.email)

  // ── 6. Gateway ────────────────────────────────────────────────────────────────
  const gateway = await prisma.gateway.upsert({
    where:  { serialNumber: 'GW-AGRI-001' },
    update: {},
    create: {
      name:           'Main Gateway',
      serialNumber:   'GW-AGRI-001',
      model:          'N510',
      status:         'OFFLINE',
      organizationId: org.id,
    },
  })
  console.log('Gateway:', gateway.serialNumber)

  // ── 7. DeviceTemplate ─────────────────────────────────────────────────────────
  const template = await findOrCreate(
    'deviceTemplate',
    { name: 'Agritech Energy Monitor', organizationId: org.id },
    {
      name:              'Agritech Energy Monitor',
      organizationId:    org.id,
      acquisitionMethod: 'edge_computing',
    }
  )
  console.log('DeviceTemplate:', template.name)

  // ── 8. DeviceTemplateSlave ────────────────────────────────────────────────────
  let templateSlave = await prisma.deviceTemplateSlave.findFirst({
    where: { templateId: template.id, name: 'Main' },
  })
  if (!templateSlave) {
    templateSlave = await prisma.deviceTemplateSlave.create({
      data: {
        templateId:     template.id,
        organizationId: org.id,
        name:           'Main',
        description:    'Main slave for Agritech Energy Monitor',
        isDefault:      true,
      },
    })
    await prisma.deviceTemplate.update({
      where: { id: template.id },
      data:  { totalSlaves: { increment: 1 } },
    })
    console.log('Created DeviceTemplateSlave:', templateSlave.name)
  }

  // ── 9. 18 DeviceTemplateVariable records ──────────────────────────────────────
  const templateVarMap = {}
  for (const vDef of VARIABLE_DEFS) {
    const tv = await prisma.deviceTemplateVariable.upsert({
      where: {
        templateSlaveId_name: { templateSlaveId: templateSlave.id, name: vDef.name },
      },
      update: {},
      create: {
        templateSlaveId: templateSlave.id,
        templateId:      template.id,
        organizationId:  org.id,
        name:            vDef.name,
        displayName:     vDef.displayName,
        unit:            vDef.unit,
        registerAddress: vDef.registerAddress,
        dataType:        'FLOAT',
        isActive:        true,
      },
    })
    templateVarMap[tv.name] = tv
  }
  const totalVars = await prisma.deviceTemplateVariable.count({ where: { templateId: template.id } })
  await prisma.deviceTemplate.update({ where: { id: template.id }, data: { totalVariables: totalVars } })
  console.log(`DeviceTemplateVariables: ${totalVars}`)

  // ── 10. 2 TemplateTrigger records ─────────────────────────────────────────────
  const triggerVoltage = await findOrCreate(
    'templateTrigger',
    { deviceTemplateId: template.id, anomalyType: 'overvoltage' },
    {
      deviceTemplateId:   template.id,
      organizationId:     org.id,
      name:               'High Voltage Alert',
      templateVariableId: templateVarMap['VoltageA'].id,
      operator:           'GT',
      threshold:          250,
      anomalyType:        'overvoltage',
      priority:           'HIGH',
      isActive:           true,
      createdBy:          superAdmin.id,
    }
  )
  console.log('TemplateTrigger: overvoltage')

  const triggerPF = await findOrCreate(
    'templateTrigger',
    { deviceTemplateId: template.id, anomalyType: 'low_power_factor' },
    {
      deviceTemplateId:   template.id,
      organizationId:     org.id,
      name:               'Low Power Factor Alert',
      templateVariableId: templateVarMap['PowerFactor'].id,
      operator:           'LT',
      threshold:          0.85,
      anomalyType:        'low_power_factor',
      priority:           'MEDIUM',
      isActive:           true,
      createdBy:          superAdmin.id,
    }
  )
  console.log('TemplateTrigger: low_power_factor')

  // ── 11. Device ────────────────────────────────────────────────────────────────
  const device = await findOrCreate(
    'device',
    { organizationId: org.id, name: 'Energy Meter 01' },
    {
      name:           'Energy Meter 01',
      gatewayId:      gateway.id,
      organizationId: org.id,
      templateId:     template.id,
      switchState:    'OFF',
      status:         'OFFLINE',
    }
  )
  console.log('Device:', device.name)

  // ── 12. Provision: DeviceConfigSlave + 18 DeviceConfigVariable records ─────────
  const configSlave = await findOrCreate(
    'deviceConfigSlave',
    { deviceId: device.id },
    {
      deviceId:        device.id,
      templateSlaveId: templateSlave.id,
      organizationId:  org.id,
      name:            'Main',
      description:     'Main slave for Energy Meter 01',
      isDefault:       true,
      isActive:        true,
    }
  )
  console.log('DeviceConfigSlave:', configSlave.name)

  const configVarMap = {}
  for (const vDef of VARIABLE_DEFS) {
    const cv = await prisma.deviceConfigVariable.upsert({
      where: {
        deviceId_deviceConfigSlaveId_name: {
          deviceId:           device.id,
          deviceConfigSlaveId: configSlave.id,
          name:               vDef.name,
        },
      },
      update: {},
      create: {
        deviceId:           device.id,
        deviceConfigSlaveId: configSlave.id,
        templateVariableId: templateVarMap[vDef.name].id,
        organizationId:     org.id,
        name:               vDef.name,
        displayName:        vDef.displayName,
        unit:               vDef.unit,
        isActive:           true,
      },
    })
    configVarMap[cv.name] = cv
  }
  console.log(`DeviceConfigVariables: ${VARIABLE_DEFS.length}`)

  // ── 13. DeviceUser ────────────────────────────────────────────────────────────
  for (const [label, userId] of [['orgAdmin', orgAdmin.id], ['regularUser', regularUser.id]]) {
    await prisma.deviceUser.upsert({
      where:  { deviceId_userId: { deviceId: device.id, userId } },
      update: {},
      create: { deviceId: device.id, userId, organizationId: org.id, assignedBy: superAdmin.id },
    })
    console.log('DeviceUser upserted for', label)
  }

  // ── 14. DeviceTimestamp ───────────────────────────────────────────────────────
  await prisma.deviceTimestamp.upsert({
    where:  { deviceId: device.id },
    update: {},
    create: { deviceId: device.id, organizationId: org.id, lastActiveAt: new Date() },
  })
  console.log('DeviceTimestamp upserted')

  // ── 15. ListType 'Protocols and Drivers' + 3 ListTypeItem records ──────────────
  const listType = await prisma.listType.upsert({
    where:  { name: 'Protocols and Drivers' },
    update: {},
    create: { name: 'Protocols and Drivers', description: 'IoT communication protocols', isActive: true },
  })
  console.log('ListType:', listType.name)

  for (const item of [
    { name: 'Modbus RTU',     description: 'Serial Modbus RTU protocol'      },
    { name: 'Modbus TCP',     description: 'Ethernet Modbus TCP protocol'     },
    { name: 'Edge Computing', description: 'On-device edge computation'       },
  ]) {
    const exists = await prisma.listTypeItem.findFirst({ where: { listTypeId: listType.id, name: item.name } })
    if (!exists) {
      await prisma.listTypeItem.create({ data: { listTypeId: listType.id, ...item, isActive: true } })
      console.log('ListTypeItem:', item.name)
    }
  }

  // ── 16. 200 SensorReading records with realistic JSON readings ─────────────────
  const readingCount = await prisma.sensorReading.count({ where: { deviceId: device.id } })
  const lastVals = {}

  if (readingCount < 200) {
    const nowMs    = Date.now()
    const sevenD   = 7 * 24 * 3600 * 1000
    const interval = sevenD / 200

    const sensorRows = Array.from({ length: 200 }, (_, i) => {
      const timestamp = new Date(nowMs - sevenD + i * interval)
      const readings  = VARIABLE_DEFS.map((vDef) => {
        const [min, max] = READING_RANGES[vDef.name] || [0, 100]
        const value = rand(min, max)
        lastVals[vDef.name] = value
        return { variableName: vDef.name, value, unit: vDef.unit }
      })
      return { deviceId: device.id, deviceConfigSlaveId: configSlave.id, organizationId: org.id, timestamp, readings }
    })

    await prisma.sensorReading.createMany({ data: sensorRows })
    console.log('Seeded 200 SensorReading records')

    // ── 17. Update DeviceConfigVariable.currentValue from last reading batch ──────
    await Promise.all(
      Object.entries(lastVals).map(([name, value]) => {
        const cv = configVarMap[name]
        if (!cv) return Promise.resolve()
        return prisma.deviceConfigVariable.update({
          where: { id: cv.id },
          data:  { currentValue: String(value), lastUpdatedAt: new Date() },
        })
      })
    )
    console.log('Updated DeviceConfigVariable currentValues')
  }

  // ── 18. 20 DeviceVariableAlarmHistory records ──────────────────────────────────
  const alarmHistCount = await prisma.deviceVariableAlarmHistory.count({ where: { deviceId: device.id } })
  if (alarmHistCount < 20) {
    const anomalyDefs = [
      { varName: 'VoltageA',    type: 'overvoltage',      value: 258,  condition: 'VoltageA GT 250',     triggerId: triggerVoltage.id },
      { varName: 'PowerFactor', type: 'low_power_factor', value: 0.78, condition: 'PowerFactor LT 0.85', triggerId: triggerPF.id      },
      { varName: 'CurrentA',    type: 'overload',         value: 48,   condition: 'CurrentA GT 45',      triggerId: null              },
      { varName: 'THD_V',       type: 'custom',           value: 6.2,  condition: 'THD_V GT 5',          triggerId: null              },
    ]
    const nowMs = Date.now()

    await prisma.deviceVariableAlarmHistory.createMany({
      data: Array.from({ length: 20 }, (_, i) => {
        const def = anomalyDefs[i % anomalyDefs.length]
        return {
          deviceId:            device.id,
          organizationId:      org.id,
          templateTriggerId:   def.triggerId,
          variableName:        def.varName,
          triggerName:         `${def.type} trigger`,
          triggerType:         def.type,
          slaveName:           'Main',
          currentValue:        def.value,
          triggeringCondition: def.condition,
          alarmTime:           new Date(nowMs - (20 - i) * 6 * 3600_000),
          alarmState:          i < 5 ? 'RESOLVED' : 'ACTIVE',
          processState:        i < 3 ? 'PROCESSED' : 'UNPROCESSED',
        }
      }),
    })
    console.log('Seeded 20 DeviceVariableAlarmHistory records')
  }

  // ── 19. AIForecastReading records (4 variables × 50 predicted points) ──────────
  const AI_VARS = [
    { name: 'VoltageImbalance', base: 1.5,  amp: 0.225 },
    { name: 'CurrentImbalance', base: 3.0,  amp: 0.45  },
    { name: 'PowerFactor',      base: 0.87, amp: 0.13  },
    { name: 'PowerConsumption', base: 45,   amp: 6.75  },
  ]

  for (const aiVar of AI_VARS) {
    const exists = await prisma.aIForecastReading.findFirst({
      where: { deviceId: device.id, variableName: aiVar.name, horizon: 'FIVE_HR' },
    })
    if (!exists) {
      const intervalMs = 6 * 60 * 1000 // 6-min steps → 5-hour window
      const predictions = Array.from({ length: 50 }, (_, i) => ({
        timestamp:      new Date(Date.now() + (i + 1) * intervalMs).toISOString(),
        predictedValue: parseFloat(
          (
            aiVar.base +
            aiVar.amp * Math.sin(i * 0.3) +
            rand(-aiVar.amp * 0.2, aiVar.amp * 0.2)
          ).toFixed(4)
        ),
      }))

      await prisma.aIForecastReading.create({
        data: {
          deviceId:          device.id,
          organizationId:    org.id,
          templateVariableId: templateVarMap[aiVar.name]?.id ?? null,
          templateSlaveId:   templateSlave.id,
          variableName:      aiVar.name,
          horizon:           'FIVE_HR',
          predictions,
          generatedAt:       new Date(),
        },
      })
      console.log(`AIForecastReading: ${aiVar.name} / FIVE_HR`)
    }
  }

  // ── 20. AlarmContact + AlarmSetting + AlarmConfigurationDevice/Contact ──────────
  const alarmContact = await findOrCreate(
    'alarmContact',
    { organizationId: org.id, email: 'alerts@ems.com' },
    {
      name:           'EMS Alert Inbox',
      organizationId: org.id,
      email:          'alerts@ems.com',
      mobile:         '+92-300-0000000',
      remark:         'Primary alarm contact',
      createdBy:      superAdmin.id,
    }
  )
  console.log('AlarmContact:', alarmContact.name)

  const alarmSetting = await findOrCreate(
    'alarmSetting',
    { organizationId: org.id, name: 'Voltage Overvoltage Alert' },
    {
      name:              'Voltage Overvoltage Alert',
      organizationId:    org.id,
      templateTriggerId: triggerVoltage.id,
      pushType:          'email',
      pushBody:          'Voltage threshold breached',
      status:            'ACTIVE',
      createdBy:         superAdmin.id,
    }
  )
  console.log('AlarmSetting:', alarmSetting.name)

  await prisma.alarmConfigurationDevice.upsert({
    where:  { alarmSettingId_deviceId: { alarmSettingId: alarmSetting.id, deviceId: device.id } },
    update: {},
    create: { alarmSettingId: alarmSetting.id, deviceId: device.id },
  })
  console.log('AlarmConfigurationDevice upserted')

  await prisma.alarmConfigurationContact.upsert({
    where:  { alarmSettingId_alarmContactId: { alarmSettingId: alarmSetting.id, alarmContactId: alarmContact.id } },
    update: {},
    create: { alarmSettingId: alarmSetting.id, alarmContactId: alarmContact.id },
  })
  console.log('AlarmConfigurationContact upserted')

  // ── 21. WidgetTemplate records ────────────────────────────────────────────────
  const widgetDefs = [
    { name: 'voltage_a',   displayName: 'Voltage A',    variableName: 'VoltageA',         unit: 'V',     widgetType: 'VALUE_CARD', position: 0 },
    { name: 'current_a',   displayName: 'Current A',    variableName: 'CurrentA',         unit: 'A',     widgetType: 'VALUE_CARD', position: 1 },
    { name: 'active_power',displayName: 'Active Power', variableName: 'ActivePower',      unit: 'kW',    widgetType: 'VALUE_CARD', position: 2 },
    { name: 'pf',          displayName: 'Power Factor', variableName: 'PowerFactor',      unit: '',      widgetType: 'GAUGE',      position: 3 },
    { name: 'energy',      displayName: 'Energy',       variableName: 'PowerConsumption', unit: 'kWh',   widgetType: 'LINE',       position: 4 },
    { name: 'freq',        displayName: 'Frequency',    variableName: 'Frequency',        unit: 'Hz',    widgetType: 'VALUE_CARD', position: 5 },
  ]
  for (const wd of widgetDefs) {
    const exists = await prisma.widgetTemplate.findFirst({ where: { organizationId: org.id, name: wd.name } })
    if (!exists) {
      await prisma.widgetTemplate.create({
        data: { ...wd, organizationId: org.id, isActive: true, createdBy: orgAdmin.id },
      })
    }
  }
  console.log(`WidgetTemplates: ${widgetDefs.length} upserted`)

  // ── 22. AlarmHistoryNotification records ──────────────────────────────────────
  const notifCount = await prisma.alarmHistoryNotification.count({ where: { organizationId: org.id } })
  if (notifCount < 5) {
    await prisma.alarmHistoryNotification.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        alarmSettingId: alarmSetting.id,
        organizationId: org.id,
        deviceId:       device.id,
        message:        `Voltage threshold exceeded ${i % 2 === 0 ? '(overvoltage)' : '(critical)'}`,
        pushType:       i % 2 === 0 ? 'email' : 'sms',
        sentTo:         i % 2 === 0 ? 'alerts@ems.com' : '+92-300-0000000',
        sentAt:         new Date(Date.now() - (10 - i) * 2 * 3600_000),
        status:         'SENT',
      })),
    })
    console.log('Seeded 10 AlarmHistoryNotification records')
  }

  // ── 23. ScheduledTask records ─────────────────────────────────────────────────
  const taskCount = await prisma.scheduledTask.count({ where: { organizationId: org.id } })
  if (taskCount < 2) {
    const tasks = [
      {
        organizationId:      org.id,
        deviceId:            device.id,
        deviceConfigSlaveId: configSlave.id,
        variableName:        'ActivePower',
        action:              'ON',
        scheduledTime:       '08:00',
        repeatType:          'DAILY',
        status:              'ACTIVE',
        createdBy:           orgAdmin.id,
      },
      {
        organizationId:      org.id,
        deviceId:            device.id,
        deviceConfigSlaveId: configSlave.id,
        variableName:        'ActivePower',
        action:              'OFF',
        scheduledTime:       '22:00',
        repeatType:          'DAILY',
        status:              'ACTIVE',
        createdBy:           orgAdmin.id,
      },
    ]
    for (const t of tasks) {
      const existing = await prisma.scheduledTask.findFirst({
        where: { organizationId: org.id, scheduledTime: t.scheduledTime },
      })
      if (!existing) {
        const created = await prisma.scheduledTask.create({ data: t })
        // seed a couple of execution logs
        await prisma.scheduleExecutionLog.createMany({
          data: Array.from({ length: 3 }, (_, i) => ({
            scheduleTaskId: created.id,
            deviceId:       device.id,
            organizationId: org.id,
            action:         t.action,
            variableName:   t.variableName,
            executedAt:     new Date(Date.now() - (3 - i) * 24 * 3600_000),
          })),
        })
      }
    }
    console.log('ScheduledTasks + logs seeded')
  }

  // ── 24. SlabRate records ──────────────────────────────────────────────────────
  const slabCount = await prisma.slabRate.count({ where: { organizationId: org.id } })
  if (slabCount < 3) {
    const slabs = [
      { unitFrom: 0,   unitTo: 100, rate: 5.5,  onPeakRate: 8.0,  offPeakRate: 3.5 },
      { unitFrom: 101, unitTo: 300, rate: 9.0,  onPeakRate: 12.0, offPeakRate: 6.5 },
      { unitFrom: 301, unitTo: 999, rate: 14.5, onPeakRate: 18.0, offPeakRate: 10.0 },
    ]
    for (const s of slabs) {
      const exists = await prisma.slabRate.findFirst({
        where: { organizationId: org.id, deviceConfigSlaveId: configSlave.id, unitFrom: s.unitFrom },
      })
      if (!exists) {
        await prisma.slabRate.create({
          data: {
            ...s,
            organizationId:      org.id,
            deviceConfigSlaveId: configSlave.id,
            createdBy:           orgAdmin.id,
          },
        })
      }
    }
    console.log('SlabRates seeded')
  }

  // ── 25. IntervalHistory records ───────────────────────────────────────────────
  const intCount = await prisma.intervalHistory.count({ where: { organizationId: org.id } })
  if (intCount < 5) {
    const now = new Date()
    for (let i = 5; i >= 1; i--) {
      const start = new Date(now.getTime() - i * 24 * 3600_000)
      const end   = new Date(now.getTime() - (i - 1) * 24 * 3600_000)
      const exists = await prisma.intervalHistory.findFirst({
        where: { organizationId: org.id, startDate: start },
      })
      if (!exists) {
        await prisma.intervalHistory.create({
          data: {
            organizationId:      org.id,
            deviceId:            device.id,
            deviceConfigSlaveId: configSlave.id,
            slaveName:           'Main',
            variableName:        'PowerConsumption',
            totalUnit:           rand(20, 80),
            tariff:              rand(120, 400),
            startDate:           start,
            endDate:             end,
          },
        })
      }
    }
    console.log('IntervalHistory seeded')
  }

  // ── 26. Products ──────────────────────────────────────────────────────────────
  const productDefs = [
    { name: 'EMS Starter',    description: 'Up to 5 devices. Email support.',         price: 0     },
    { name: 'EMS Pro',        description: 'Up to 25 devices. Priority support.',      price: 4999  },
    { name: 'EMS Enterprise', description: 'Unlimited devices. Dedicated support.',    price: 14999 },
    { name: 'N510 Gateway',   description: '4G LTE IoT gateway, DIN-rail mount.',      price: 8500  },
  ]
  for (const pd of productDefs) {
    const exists = await prisma.product.findFirst({ where: { name: pd.name } })
    if (!exists) await prisma.product.create({ data: pd })
  }
  console.log(`Products: ${productDefs.length} upserted`)

  // ── 27. Second device for richer testing ─────────────────────────────────────
  const device2 = await findOrCreate(
    'device',
    { organizationId: org.id, name: 'Energy Meter 02' },
    {
      name:           'Energy Meter 02',
      gatewayId:      gateway.id,
      organizationId: org.id,
      templateId:     template.id,
      switchState:    'ON',
      status:         'ONLINE',
    }
  )
  const configSlave2 = await findOrCreate(
    'deviceConfigSlave',
    { deviceId: device2.id },
    {
      deviceId:        device2.id,
      templateSlaveId: templateSlave.id,
      organizationId:  org.id,
      name:            'Main',
      isDefault:       true,
      isActive:        true,
    }
  )
  for (const vDef of VARIABLE_DEFS) {
    await prisma.deviceConfigVariable.upsert({
      where: {
        deviceId_deviceConfigSlaveId_name: {
          deviceId: device2.id, deviceConfigSlaveId: configSlave2.id, name: vDef.name,
        },
      },
      update: {},
      create: {
        deviceId:           device2.id,
        deviceConfigSlaveId: configSlave2.id,
        templateVariableId: templateVarMap[vDef.name].id,
        organizationId:     org.id,
        name:               vDef.name,
        displayName:        vDef.displayName,
        unit:               vDef.unit,
        isActive:           true,
        currentValue:       String(rand(...(READING_RANGES[vDef.name] || [0, 100]))),
        lastUpdatedAt:      new Date(),
      },
    })
  }
  await prisma.deviceTimestamp.upsert({
    where:  { deviceId: device2.id },
    update: { lastActiveAt: new Date() },
    create: { deviceId: device2.id, organizationId: org.id, lastActiveAt: new Date() },
  })
  // seed 50 readings for device 2
  const d2ReadingCount = await prisma.sensorReading.count({ where: { deviceId: device2.id } })
  if (d2ReadingCount < 50) {
    const nowMs = Date.now()
    await prisma.sensorReading.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        deviceId:            device2.id,
        deviceConfigSlaveId: configSlave2.id,
        organizationId:      org.id,
        timestamp:           new Date(nowMs - (50 - i) * 30 * 60_000),
        readings:            VARIABLE_DEFS.map((v) => {
          const [mn, mx] = READING_RANGES[v.name] || [0, 100]
          return { variableName: v.name, value: rand(mn, mx), unit: v.unit }
        }),
      })),
    })
  }
  console.log('Device 2 seeded:', device2.name)

  // ── 28. Second alarm contact for contacts tab ─────────────────────────────────
  await findOrCreate(
    'alarmContact',
    { organizationId: org.id, email: 'engineer@ems.com' },
    {
      name:           'Site Engineer',
      organizationId: org.id,
      email:          'engineer@ems.com',
      mobile:         '+92-321-1234567',
      whatsapp:       '+92-321-1234567',
      remark:         'Email + WhatsApp',
      createdBy:      orgAdmin.id,
    }
  )
  console.log('Second AlarmContact seeded')

  // ── 29. Second regular user ───────────────────────────────────────────────────
  await prisma.user.upsert({
    where:  { email: 'engineer@lab.com' },
    update: {},
    create: {
      fullName:       'Site Engineer',
      email:          'engineer@lab.com',
      passwordHash:   await bcrypt.hash('User@123456', 12),
      role:           'USER',
      organizationId: org.id,
      status:         'INACTIVE',
    },
  })
  console.log('Second user seeded')

  console.log('\n✓ Seed complete.')
}

const SEED_MARKER_EMAIL = 'superadmin@ems.com'

const isDatabaseSeeded = async () => {
  const user = await prisma.user.findUnique({ where: { email: SEED_MARKER_EMAIL } })
  return Boolean(user)
}

/** Run seed once; skip if marker user already exists. */
const seedIfEmpty = async () => {
  if (await isDatabaseSeeded()) {
    console.log('Seed skipped: database already initialized')
    return false
  }
  await seedDummyData()
  return true
}

// ─── standalone execution ─────────────────────────────────────────────────────

if (require.main === module) {
  prisma.$connect()
    .then(() => seedIfEmpty())
    .then(async () => { await prisma.$disconnect(); process.exit(0) })
    .catch(async (err) => {
      console.error('Seeder error:', err)
      await prisma.$disconnect()
      process.exit(1)
    })
}

module.exports = { seedDummyData, seedIfEmpty, isDatabaseSeeded }
