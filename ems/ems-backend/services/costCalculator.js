// ─── Cost calculator service ──────────────────────────────────────────────────
// Computes the electricity tariff for a DeviceConfigSlave over a date range
// by applying SlabRate tiers (ascending unitFrom order) to the total units
// consumed.  Any units exceeding the last defined tier use the last tier's rate.
const prisma = require('../config/database')

/**
 * @desc  Sum all sensor readings for `variableName` on the given slave within
 *        [startDate, endDate] and apply slab-rate tiered tariff calculation.
 *
 * @param {string}      deviceConfigSlaveId
 * @param {string}      variableName
 * @param {string|Date} startDate
 * @param {string|Date} endDate
 * @returns {Promise<{ totalUnit: number, tariff: number }>}
 */
const computeIntervalCost = async (deviceConfigSlaveId, variableName, startDate, endDate) => {
  const slave = await prisma.deviceConfigSlave.findUnique({ where: { id: deviceConfigSlaveId } })
  if (!slave) return { totalUnit: 0, tariff: 0 }

  const readings = await prisma.sensorReading.findMany({
    where: {
      deviceId:            slave.deviceId,
      deviceConfigSlaveId,
      timestamp: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    select: { readings: true },
  })

  let totalUnit = 0
  for (const row of readings) {
    const arr   = Array.isArray(row.readings) ? row.readings : []
    const entry = arr.find((r) => r.variableName === variableName)
    if (entry) totalUnit += Number(entry.value)
  }

  const slabs = await prisma.slabRate.findMany({
    where:   { deviceConfigSlaveId },
    orderBy: { unitFrom: 'asc' },
  })

  let tariff    = 0
  let remaining = totalUnit

  for (const slab of slabs) {
    if (remaining <= 0) break
    const tierCapacity = slab.unitTo - slab.unitFrom
    if (tierCapacity <= 0) continue
    const unitsInTier  = Math.min(remaining, tierCapacity)
    tariff    += unitsInTier * slab.rate
    remaining -= unitsInTier
  }

  // Units beyond the last defined slab are charged at the final tier's rate
  if (remaining > 0 && slabs.length) {
    tariff += remaining * slabs[slabs.length - 1].rate
  }

  return {
    totalUnit: parseFloat(totalUnit.toFixed(4)),
    tariff:    parseFloat(tariff.toFixed(2)),
  }
}

module.exports = { computeIntervalCost }
