// ─── Device user assignment controller ───────────────────────────────────────
// Manages the many-to-many link between users and devices (deviceUsers table).
// Only users in the same organisation as the device can be assigned.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

// @desc  List users assigned to a device
// @access SUPER_ADMIN | ORG_ADMIN
const getDeviceUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { deviceId: req.params.deviceId }

    const [data, total] = await Promise.all([
      prisma.deviceUser.findMany({
        where, skip, take: limit,
        orderBy: { assignedAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
      }),
      prisma.deviceUser.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Assign a user to a device.
//        Both must belong to the same organisation.
// @access SUPER_ADMIN | ORG_ADMIN
const assignUser = async (req, res, next) => {
  try {
    const { userId }   = req.body
    const { deviceId } = req.params

    const [device, user] = await Promise.all([
      prisma.device.findUnique({ where: { id: deviceId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ])
    if (!device) return next(new AppError('Device not found', 404))
    if (!user)   return next(new AppError('User not found', 404))
    if (device.organizationId !== user.organizationId) {
      return next(new AppError('User and device must belong to the same organisation', 400))
    }

    const data = await prisma.deviceUser.create({
      data: { deviceId, userId, organizationId: device.organizationId, assignedBy: req.user.id },
    })
    res.status(201).json({ success: true, data })
  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('User is already assigned to this device', 400))
    next(err)
  }
}

// @desc  Remove a user from a device
// @access SUPER_ADMIN | ORG_ADMIN
const removeUser = async (req, res, next) => {
  try {
    const { deviceId, userId } = req.params
    await prisma.deviceUser.delete({ where: { deviceId_userId: { deviceId, userId } } })
    res.json({ success: true, message: 'User removed from device' })
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('Assignment not found', 404))
    next(err)
  }
}

module.exports = { getDeviceUsers, assignUser, removeUser }
