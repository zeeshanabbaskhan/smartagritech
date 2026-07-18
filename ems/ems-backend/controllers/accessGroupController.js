const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')

const includeMembers = {
  devices: { include: { device: { select: { id: true, name: true, status: true } } } },
  users: { include: { user: { select: { id: true, fullName: true, email: true, role: true } } } },
  _count: { select: { devices: true, users: true } },
}

function mapGroup(g) {
  return {
    ...g,
    deviceIds: (g.devices || []).map((d) => d.deviceId),
    userIds: (g.users || []).map((u) => u.userId),
    devices: (g.devices || []).map((d) => d.device),
    users: (g.users || []).map((u) => u.user),
  }
}

const resolveOrgId = (req, bodyOrgId) => {
  if (req.user.role === 'SUPER_ADMIN') return bodyOrgId || req.query.organizationId
  return req.user.organizationId
}

const listAccessGroups = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user, req.query.organizationId) }
    const [rows, total] = await Promise.all([
      prisma.accessGroup.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: includeMembers,
      }),
      prisma.accessGroup.count({ where }),
    ])
    res.json({
      success: true,
      data: rows.map(mapGroup),
      total, page, pages: Math.ceil(total / limit) || 1,
    })
  } catch (err) { next(err) }
}

const createAccessGroup = async (req, res, next) => {
  try {
    const { name, organizationId, deviceIds = [], userIds = [] } = req.body
    const orgId = resolveOrgId(req, organizationId)
    if (!orgId) return next(new AppError('organizationId is required', 400))
    if (!name?.trim()) return next(new AppError('name is required', 400))

    const data = await prisma.accessGroup.create({
      data: {
        name: name.trim(),
        organizationId: orgId,
        createdBy: req.user.id,
        devices: {
          create: deviceIds.map((deviceId) => ({ deviceId })),
        },
        users: {
          create: userIds.map((userId) => ({ userId })),
        },
      },
      include: includeMembers,
    })
    res.status(201).json({ success: true, data: mapGroup(data) })
  } catch (err) { next(err) }
}

const updateAccessGroup = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.accessGroup.findFirst({ where })
    if (!existing) return next(new AppError('Access group not found', 404))

    const { name, deviceIds, userIds } = req.body
    const data = await prisma.$transaction(async (tx) => {
      if (Array.isArray(deviceIds)) {
        await tx.accessGroupDevice.deleteMany({ where: { accessGroupId: existing.id } })
        if (deviceIds.length) {
          await tx.accessGroupDevice.createMany({
            data: deviceIds.map((deviceId) => ({ accessGroupId: existing.id, deviceId })),
          })
        }
      }
      if (Array.isArray(userIds)) {
        await tx.accessGroupUser.deleteMany({ where: { accessGroupId: existing.id } })
        if (userIds.length) {
          await tx.accessGroupUser.createMany({
            data: userIds.map((userId) => ({ accessGroupId: existing.id, userId })),
          })
        }
      }
      return tx.accessGroup.update({
        where: { id: existing.id },
        data: { name: name?.trim() || undefined },
        include: includeMembers,
      })
    })
    res.json({ success: true, data: mapGroup(data) })
  } catch (err) { next(err) }
}

const deleteAccessGroup = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.accessGroup.findFirst({ where })
    if (!existing) return next(new AppError('Access group not found', 404))
    await prisma.accessGroup.delete({ where: { id: existing.id } })
    res.json({ success: true, message: 'Access group deleted' })
  } catch (err) { next(err) }
}

module.exports = { listAccessGroups, createAccessGroup, updateAccessGroup, deleteAccessGroup }
