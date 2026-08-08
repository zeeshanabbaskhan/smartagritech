// Shared device ACL for USER role.
// Explicit grants: DeviceUser ∪ AccessGroup ∪ DeviceGroup.
// No grants => all devices in the user's organization (org assignment is enough).
const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')

/**
 * Prisma `where` fragment for devices a USER can see when explicitly granted.
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
    {
      deviceGroupDevices: {
        some: {
          deviceGroup: {
            users: { some: { userId } },
          },
        },
      },
    },
  ],
})

/**
 * True when the USER has been assigned devices via DeviceUser, AccessGroup,
 * or DeviceGroup. No membership => not constrained beyond org scope.
 */
const userHasExplicitDeviceGrants = async (userId) => {
  const [direct, accessGroup, deviceGroup] = await Promise.all([
    prisma.deviceUser.findFirst({ where: { userId }, select: { userId: true } }),
    prisma.accessGroupUser.findFirst({ where: { userId }, select: { userId: true } }),
    prisma.deviceGroupUser.findFirst({ where: { userId }, select: { userId: true } }),
  ])
  return Boolean(direct || accessGroup || deviceGroup)
}

/**
 * Merge org scope with USER device ACL into a device `where` clause.
 * Async because USER may fall back to full-org access when unconstrained.
 */
const deviceWhereForUser = async (user, extra = {}) => {
  const where = { ...extra }
  if (user.role === 'USER') {
    const constrained = await userHasExplicitDeviceGrants(user.id)
    if (constrained) {
      Object.assign(where, userDeviceAccessWhere(user.id))
    }
  }
  return where
}

/**
 * Resolve device IDs the user may access (for anomaly / multi-device filters).
 * Returns null when the caller should not restrict by device id (admin roles).
 */
const listAccessibleDeviceIds = async (user) => {
  if (user.role !== 'USER') return null
  const constrained = await userHasExplicitDeviceGrants(user.id)
  const rows = await prisma.device.findMany({
    where: {
      organizationId: user.organizationId,
      ...(constrained ? userDeviceAccessWhere(user.id) : {}),
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

  // USER: all org devices unless explicitly constrained by grants
  const constrained = await userHasExplicitDeviceGrants(user.id)
  if (!constrained) return device

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
  userHasExplicitDeviceGrants,
  deviceWhereForUser,
  listAccessibleDeviceIds,
  assertDeviceAccess,
}
