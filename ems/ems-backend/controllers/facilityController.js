const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope } = require('../utils/helpers')

const resolveOrgId = (req, bodyOrgId) => {
  if (req.user.role === 'SUPER_ADMIN') return bodyOrgId || req.query.organizationId
  return req.user.organizationId
}

const deviceInclude = {
  devices: {
    include: { device: { select: { id: true, name: true, status: true } } },
  },
}

function mapNodeRow(n) {
  const deviceIds = (n.devices || []).map((d) => d.deviceId)
  const devices = (n.devices || []).map((d) => d.device).filter(Boolean)
  const { devices: _join, ...rest } = n
  return { ...rest, deviceIds, devices }
}

function buildTree(nodes) {
  const mapped = nodes.map(mapNodeRow)
  const byId = new Map(mapped.map((n) => [n.id, { ...n, children: [] }]))
  const roots = []
  for (const n of byId.values()) {
    if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId).children.push(n)
    else roots.push(n)
  }
  const sortRec = (list) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    list.forEach((c) => sortRec(c.children))
  }
  sortRec(roots)
  return roots
}

const getFacilityTree = async (req, res, next) => {
  try {
    const orgId = resolveOrgId(req)
    if (!orgId) return next(new AppError('organizationId is required', 400))
    const nodes = await prisma.facilityNode.findMany({
      where: { organizationId: orgId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: deviceInclude,
    })
    res.json({ success: true, data: buildTree(nodes), flat: nodes.map(mapNodeRow) })
  } catch (err) { next(err) }
}

const createFacilityNode = async (req, res, next) => {
  try {
    const { name, type, parentId, sortOrder, organizationId, deviceIds = [] } = req.body
    const orgId = resolveOrgId(req, organizationId)
    if (!orgId) return next(new AppError('organizationId is required', 400))
    if (!name?.trim()) return next(new AppError('name is required', 400))

    if (parentId) {
      const parent = await prisma.facilityNode.findFirst({
        where: { id: parentId, organizationId: orgId },
      })
      if (!parent) return next(new AppError('Parent node not found', 404))
    }

    const data = await prisma.facilityNode.create({
      data: {
        name: name.trim(),
        type: type || 'BUILDING',
        parentId: parentId || null,
        sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0,
        organizationId: orgId,
        devices: Array.isArray(deviceIds) && deviceIds.length
          ? { create: deviceIds.map((deviceId) => ({ deviceId })) }
          : undefined,
      },
      include: deviceInclude,
    })
    res.status(201).json({ success: true, data: mapNodeRow(data) })
  } catch (err) { next(err) }
}

const updateFacilityNode = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.facilityNode.findFirst({ where })
    if (!existing) return next(new AppError('Facility node not found', 404))

    const { name, type, parentId, sortOrder, deviceIds } = req.body
    const data = await prisma.$transaction(async (tx) => {
      if (Array.isArray(deviceIds)) {
        await tx.facilityNodeDevice.deleteMany({ where: { facilityNodeId: existing.id } })
        if (deviceIds.length) {
          await tx.facilityNodeDevice.createMany({
            data: deviceIds.map((deviceId) => ({ facilityNodeId: existing.id, deviceId })),
            skipDuplicates: true,
          })
        }
      }
      return tx.facilityNode.update({
        where: { id: existing.id },
        data: {
          name: name?.trim() || undefined,
          type: type || undefined,
          parentId: parentId === undefined ? undefined : (parentId || null),
          sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : undefined,
        },
        include: deviceInclude,
      })
    })
    res.json({ success: true, data: mapNodeRow(data) })
  } catch (err) { next(err) }
}

const setFacilityDevices = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.facilityNode.findFirst({ where })
    if (!existing) return next(new AppError('Facility node not found', 404))

    const deviceIds = Array.isArray(req.body.deviceIds) ? req.body.deviceIds : []
    const data = await prisma.$transaction(async (tx) => {
      await tx.facilityNodeDevice.deleteMany({ where: { facilityNodeId: existing.id } })
      if (deviceIds.length) {
        await tx.facilityNodeDevice.createMany({
          data: deviceIds.map((deviceId) => ({ facilityNodeId: existing.id, deviceId })),
          skipDuplicates: true,
        })
      }
      return tx.facilityNode.findUnique({
        where: { id: existing.id },
        include: deviceInclude,
      })
    })
    res.json({ success: true, data: mapNodeRow(data) })
  } catch (err) { next(err) }
}

const deleteFacilityNode = async (req, res, next) => {
  try {
    const where = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.facilityNode.findFirst({ where })
    if (!existing) return next(new AppError('Facility node not found', 404))
    await prisma.facilityNode.delete({ where: { id: existing.id } })
    res.json({ success: true, message: 'Facility node deleted' })
  } catch (err) { next(err) }
}

/** Replace entire tree for an org (used by hierarchy editor Save). Preserves deviceIds via client node keys. */
const replaceFacilityTree = async (req, res, next) => {
  try {
    const { organizationId, nodes = [] } = req.body
    const orgId = resolveOrgId(req, organizationId)
    if (!orgId) return next(new AppError('organizationId is required', 400))

    await prisma.$transaction(async (tx) => {
      await tx.facilityNode.deleteMany({ where: { organizationId: orgId } })
      const idMap = new Map()
      for (const n of nodes) {
        const created = await tx.facilityNode.create({
          data: {
            name: n.name,
            type: n.type || 'BUILDING',
            sortOrder: n.sortOrder ?? 0,
            organizationId: orgId,
            parentId: null,
          },
        })
        idMap.set(n.id || n.tempId, created.id)
      }
      for (const n of nodes) {
        const newId = idMap.get(n.id || n.tempId)
        const parentKey = n.parentId
        if (parentKey) {
          const newParent = idMap.get(parentKey)
          if (newParent) {
            await tx.facilityNode.update({
              where: { id: newId },
              data: { parentId: newParent },
            })
          }
        }
        const deviceIds = Array.isArray(n.deviceIds) ? n.deviceIds.filter(Boolean) : []
        if (deviceIds.length && newId) {
          await tx.facilityNodeDevice.createMany({
            data: deviceIds.map((deviceId) => ({ facilityNodeId: newId, deviceId })),
            skipDuplicates: true,
          })
        }
      }
    })

    const flat = await prisma.facilityNode.findMany({
      where: { organizationId: orgId },
      include: deviceInclude,
    })
    res.json({ success: true, data: buildTree(flat), flat: flat.map(mapNodeRow) })
  } catch (err) { next(err) }
}

module.exports = {
  getFacilityTree, createFacilityNode, updateFacilityNode, deleteFacilityNode,
  replaceFacilityTree, setFacilityDevices,
}
