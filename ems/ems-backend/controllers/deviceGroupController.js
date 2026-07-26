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

/**
 * When SUPER_ADMIN has defined access groups for an org, ORG_ADMIN device groups
 * may only include devices that appear in those admin-created access groups.
 */
async function enforceAdminDeviceCeiling(req, orgId, deviceIds) {
  if (req.user.role !== 'ORG_ADMIN') return deviceIds
  const uniqueDevices = [...new Set((deviceIds || []).filter(Boolean))]
  if (!uniqueDevices.length) return uniqueDevices

  const adminGroups = await prisma.accessGroup.findMany({
    where: {
      organizationId: orgId,
      creator: { role: 'SUPER_ADMIN' },
    },
    select: { id: true, devices: { select: { deviceId: true } } },
  })
  if (!adminGroups.length) return uniqueDevices

  const allowed = new Set(adminGroups.flatMap((g) => g.devices.map((d) => d.deviceId)))
  const outside = uniqueDevices.filter((id) => !allowed.has(id))
  if (outside.length) {
    throw new AppError('Device group may only include devices from admin-defined access groups', 400)
  }
  return uniqueDevices
}

const listDeviceGroups = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user, req.query.organizationId) }
    const [rows, total] = await Promise.all([
      prisma.deviceGroup.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: includeMembers,
      }),
      prisma.deviceGroup.count({ where }),
    ])
    res.json({
      success: true,
      data: rows.map(mapGroup),
      total, page, pages: Math.ceil(total / limit) || 1,
    })
  } catch (err) { next(err) }
}

const createDeviceGroup = async (req, res, next) => {
  try {
    const { name, description, organizationId, deviceIds = [], userIds = [] } = req.body
    const orgId = resolveOrgId(req, organizationId)
    if (!orgId) return next(new AppError('organizationId is required', 400))
    if (!name?.trim()) return next(new AppError('name is required', 400))

    let members = await assertMembersInOrg(orgId, deviceIds, userIds)
    members = {
      ...members,
      deviceIds: await enforceAdminDeviceCeiling(req, orgId, members.deviceIds),
    }

    const data = await prisma.deviceGroup.create({
      data: {
        name: name.trim(),
        description: description || null,
        organizationId: orgId,
        createdBy: req.user.id,
        devices: { create: members.deviceIds.map((deviceId) => ({ deviceId })) },
        users: { create: members.userIds.map((userId) => ({ userId })) },
      },
      include: includeMembers,
    })
    res.status(201).json({ success: true, data: mapGroup(data) })
  } catch (err) { next(err) }
}

const updateDeviceGroup = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.deviceGroup.findFirst({ where })
    if (!existing) return next(new AppError('Device group not found', 404))

    const { name, description, deviceIds, userIds, isActive } = req.body
    let safeDeviceIds = deviceIds
    let safeUserIds = userIds
    if (Array.isArray(deviceIds) || Array.isArray(userIds)) {
      const members = await assertMembersInOrg(
        existing.organizationId,
        Array.isArray(deviceIds) ? deviceIds : [],
        Array.isArray(userIds) ? userIds : [],
      )
      if (Array.isArray(deviceIds)) {
        safeDeviceIds = await enforceAdminDeviceCeiling(req, existing.organizationId, members.deviceIds)
      }
      if (Array.isArray(userIds)) safeUserIds = members.userIds
    }

    const data = await prisma.$transaction(async (tx) => {
      if (Array.isArray(safeDeviceIds)) {
        await tx.deviceGroupDevice.deleteMany({ where: { deviceGroupId: existing.id } })
        if (safeDeviceIds.length) {
          await tx.deviceGroupDevice.createMany({
            data: safeDeviceIds.map((deviceId) => ({ deviceGroupId: existing.id, deviceId })),
            skipDuplicates: true,
          })
        }
      }
      if (Array.isArray(safeUserIds)) {
        await tx.deviceGroupUser.deleteMany({ where: { deviceGroupId: existing.id } })
        if (safeUserIds.length) {
          await tx.deviceGroupUser.createMany({
            data: safeUserIds.map((userId) => ({ deviceGroupId: existing.id, userId })),
            skipDuplicates: true,
          })
        }
      }
      return tx.deviceGroup.update({
        where: { id: existing.id },
        data: {
          name: name?.trim() || undefined,
          description: description !== undefined ? description : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
        },
        include: includeMembers,
      })
    })
    res.json({ success: true, data: mapGroup(data) })
  } catch (err) { next(err) }
}

const deleteDeviceGroup = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.deviceGroup.findFirst({ where })
    if (!existing) return next(new AppError('Device group not found', 404))
    await prisma.deviceGroup.delete({ where: { id: existing.id } })
    res.json({ success: true, message: 'Device group deleted' })
  } catch (err) { next(err) }
}

module.exports = { listDeviceGroups, createDeviceGroup, updateDeviceGroup, deleteDeviceGroup }
