const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')

const includeMembers = {
  devices: { include: { device: { select: { id: true, name: true, status: true } } } },
  users: { include: { user: { select: { id: true, fullName: true, email: true, role: true } } } },
  creator: { select: { id: true, fullName: true, role: true } },
  _count: { select: { devices: true, users: true } },
}

function mapGroup(g) {
  const { creator, devices, users, ...rest } = g
  return {
    ...rest,
    deviceIds: (devices || []).map((d) => d.deviceId),
    userIds: (users || []).map((u) => u.userId),
    devices: (devices || []).map((d) => d.device),
    users: (users || []).map((u) => u.user),
    createdByRole: creator?.role || null,
    createdByName: creator?.fullName || null,
  }
}

const resolveOrgId = (req, bodyOrgId) => {
  if (req.user.role === 'SUPER_ADMIN') return bodyOrgId || req.query.organizationId
  return req.user.organizationId
}

/** Ensure member devices/users belong to the target organization. */
async function assertMembersInOrg(orgId, deviceIds = [], userIds = []) {
  const uniqueDevices = [...new Set((deviceIds || []).filter(Boolean))]
  const uniqueUsers = [...new Set((userIds || []).filter(Boolean))]

  if (uniqueDevices.length) {
    const count = await prisma.device.count({
      where: { organizationId: orgId, id: { in: uniqueDevices } },
    })
    if (count !== uniqueDevices.length) {
      throw new AppError('One or more devices do not belong to this organization', 400)
    }
  }

  if (uniqueUsers.length) {
    const count = await prisma.user.count({
      where: {
        organizationId: orgId,
        id: { in: uniqueUsers },
        status: { not: 'DELETED' },
        role: { not: 'SUPER_ADMIN' },
      },
    })
    if (count !== uniqueUsers.length) {
      throw new AppError('One or more users do not belong to this organization', 400)
    }
  }

  return { deviceIds: uniqueDevices, userIds: uniqueUsers }
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

    const members = await assertMembersInOrg(orgId, deviceIds, userIds)

    const data = await prisma.accessGroup.create({
      data: {
        name: name.trim(),
        organizationId: orgId,
        createdBy: req.user.id,
        devices: {
          create: members.deviceIds.map((deviceId) => ({ deviceId })),
        },
        users: {
          create: members.userIds.map((userId) => ({ userId })),
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
    if (Array.isArray(deviceIds) || Array.isArray(userIds)) {
      await assertMembersInOrg(
        existing.organizationId,
        Array.isArray(deviceIds) ? deviceIds : [],
        Array.isArray(userIds) ? userIds : [],
      )
    }

    const data = await prisma.$transaction(async (tx) => {
      if (Array.isArray(deviceIds)) {
        await tx.accessGroupDevice.deleteMany({ where: { accessGroupId: existing.id } })
        if (deviceIds.length) {
          await tx.accessGroupDevice.createMany({
            data: [...new Set(deviceIds.filter(Boolean))].map((deviceId) => ({ accessGroupId: existing.id, deviceId })),
            skipDuplicates: true,
          })
        }
      }
      if (Array.isArray(userIds)) {
        await tx.accessGroupUser.deleteMany({ where: { accessGroupId: existing.id } })
        if (userIds.length) {
          await tx.accessGroupUser.createMany({
            data: [...new Set(userIds.filter(Boolean))].map((userId) => ({ accessGroupId: existing.id, userId })),
            skipDuplicates: true,
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
