// Shared device ACL: USER may access devices via DeviceUser OR AccessGroup membership.
const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')

/**
 * Prisma `where` fragment for devices a USER can see (union of direct + access-group).
 * SUPER_ADMIN / ORG_ADMIN should not use this — they use orgScope only.
 */
const userDeviceAccessWhere = (userId) => ({
  OR: [
    { deviceUsers: { some: { userId } } },
    {
      accessGroupDevices: {
        some: {
          accessGroup: {
            users: { some: { userId } },
          },
        },
      },
    },
  ],
})

/**
 * Merge org scope with USER device ACL into a device `where` clause.
 */
const deviceWhereForUser = (user, extra = {}) => {
  const where = { ...extra }
  if (user.role === 'USER') {
    Object.assign(where, userDeviceAccessWhere(user.id))
  }
  return where
}

/**
 * Resolve device IDs the user may access (for anomaly / multi-device filters).
 * Returns null when the caller should not restrict by device id (admin roles).
 */
const listAccessibleDeviceIds = async (user) => {
  if (user.role !== 'USER') return null
  const rows = await prisma.device.findMany({
    where: {
      organizationId: user.organizationId,
      ...userDeviceAccessWhere(user.id),
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/**
 * Load a device and enforce org + USER ACL. Throws AppError on deny/missing.
 */
const assertDeviceAccess = async (deviceId, user) => {
  if (!deviceId) throw new AppError('deviceId is required', 400)

  const device = await prisma.device.findUnique({ where: { id: deviceId } })
  if (!device) throw new AppError('Device not found', 404)

  if (user.role === 'SUPER_ADMIN') return device

  if (device.organizationId !== user.organizationId) {
    throw new AppError('Access denied', 403)
  }

  if (user.role === 'ORG_ADMIN') return device

  // USER: must be assigned directly or via an access group
  const allowed = await prisma.device.findFirst({
    where: {
      id: deviceId,
      ...userDeviceAccessWhere(user.id),
    },
    select: { id: true },
  })
  if (!allowed) throw new AppError('Access denied', 403)
  return device
}

module.exports = {
  userDeviceAccessWhere,
  deviceWhereForUser,
  listAccessibleDeviceIds,
  assertDeviceAccess,
}
