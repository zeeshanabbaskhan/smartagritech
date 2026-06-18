require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const prisma = require('../config/database')
const { processIngest } = require('../services/ingestService')

;(async () => {
  const d = await prisma.device.findFirst({ include: { configSlaves: true } })
  await processIngest({
    deviceId: d.id,
    slaveId: d.configSlaves[0].id,
    readings: [{ variableName: 'VoltageA', value: 231, unit: 'V' }],
    organizationId: d.organizationId,
  })
  console.log('ingest ok')
  await prisma.$disconnect()
})().catch(async (e) => {
  console.error('ingest failed:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
