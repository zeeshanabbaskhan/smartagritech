const prisma = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope } = require('../utils/helpers')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

/** SUPER_ADMIN may optionally scope by organizationId; ORG_ADMIN always org-scoped. */
function nodeWhere(req, nodeId) {
  const where = { id: nodeId }
  if (req.user.role === 'SUPER_ADMIN') {
    const orgId = req.body?.organizationId || req.query?.organizationId
    if (orgId) where.organizationId = orgId
  } else {
    Object.assign(where, orgScope(req.user))
  }
  return where
}

async function assertDevicesInOrg(orgId, deviceIds = []) {
  const unique = [...new Set((deviceIds || []).filter(Boolean))]
  if (!unique.length) return unique
  const count = await prisma.device.count({
    where: { organizationId: orgId, id: { in: unique } },
  })
  if (count !== unique.length) {
    throw new AppError('One or more devices do not belong to this organization', 400)
  }
  return unique
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

    const safeDeviceIds = await assertDevicesInOrg(orgId, deviceIds)

    const data = await prisma.facilityNode.create({
      data: {
        name: name.trim(),
        type: type || 'BUILDING',
        parentId: parentId || null,
        sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0,
        organizationId: orgId,
        devices: safeDeviceIds.length
          ? { create: safeDeviceIds.map((deviceId) => ({ deviceId })) }
          : undefined,
      },
      include: deviceInclude,
    })
    res.status(201).json({ success: true, data: mapNodeRow(data) })
  } catch (err) { next(err) }
}

const updateFacilityNode = async (req, res, next) => {
  try {
    const existing = await prisma.facilityNode.findFirst({ where: nodeWhere(req, req.params.id) })
    if (!existing) return next(new AppError('Facility node not found', 404))

    const { name, type, parentId, sortOrder, deviceIds } = req.body
    let safeDeviceIds
    if (Array.isArray(deviceIds)) {
      safeDeviceIds = await assertDevicesInOrg(existing.organizationId, deviceIds)
    }

    const data = await prisma.$transaction(async (tx) => {
      if (Array.isArray(safeDeviceIds)) {
        await tx.facilityNodeDevice.deleteMany({ where: { facilityNodeId: existing.id } })
        if (safeDeviceIds.length) {
          await tx.facilityNodeDevice.createMany({
            data: safeDeviceIds.map((deviceId) => ({ facilityNodeId: existing.id, deviceId })),
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
    const existing = await prisma.facilityNode.findFirst({ where: nodeWhere(req, req.params.id) })
    if (!existing) return next(new AppError('Facility node not found', 404))

    const safeDeviceIds = await assertDevicesInOrg(
      existing.organizationId,
      Array.isArray(req.body.deviceIds) ? req.body.deviceIds : [],
    )
    const data = await prisma.$transaction(async (tx) => {
      await tx.facilityNodeDevice.deleteMany({ where: { facilityNodeId: existing.id } })
      if (safeDeviceIds.length) {
        await tx.facilityNodeDevice.createMany({
          data: safeDeviceIds.map((deviceId) => ({ facilityNodeId: existing.id, deviceId })),
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
    const existing = await prisma.facilityNode.findFirst({ where: nodeWhere(req, req.params.id) })
    if (!existing) return next(new AppError('Facility node not found', 404))
    await prisma.facilityNode.delete({ where: { id: existing.id } })
    res.json({ success: true, message: 'Facility node deleted' })
  } catch (err) { next(err) }
}

/**
 * Replace entire tree for an org. Preserves existing node UUIDs when the client
 * sends them back, so custom-dashboard facility scopes stay valid across saves.
 */
const replaceFacilityTree = async (req, res, next) => {
  try {
    const { organizationId, nodes = [] } = req.body
    const orgId = resolveOrgId(req, organizationId)
    if (!orgId) return next(new AppError('organizationId is required', 400))

    const allDeviceIds = nodes.flatMap((n) => (Array.isArray(n.deviceIds) ? n.deviceIds : []))
    await assertDevicesInOrg(orgId, allDeviceIds)

    await prisma.$transaction(async (tx) => {
      const existing = await tx.facilityNode.findMany({
        where: { organizationId: orgId },
        select: { id: true },
      })
      const existingIds = new Set(existing.map((e) => e.id))
      const idMap = new Map()
      const keptIds = new Set()

      for (const n of nodes) {
        const clientKey = n.id || n.tempId
        const reuseId = n.id && UUID_RE.test(n.id) && existingIds.has(n.id) ? n.id : null
        if (reuseId) {
          await tx.facilityNode.update({
            where: { id: reuseId },
            data: {
              name: n.name,
              type: n.type || 'BUILDING',
              sortOrder: n.sortOrder ?? 0,
              parentId: null,
            },
          })
          idMap.set(clientKey, reuseId)
          keptIds.add(reuseId)
        } else {
          const createData = {
            name: n.name,
            type: n.type || 'BUILDING',
            sortOrder: n.sortOrder ?? 0,
            organizationId: orgId,
            parentId: null,
          }
          // New nodes from the editor may already carry a client UUID — keep it stable.
          if (n.id && UUID_RE.test(n.id) && !existingIds.has(n.id)) {
            createData.id = n.id
          }
          const created = await tx.facilityNode.create({ data: createData })
          idMap.set(clientKey, created.id)
          keptIds.add(created.id)
        }
      }

      const toDelete = [...existingIds].filter((id) => !keptIds.has(id))
      if (toDelete.length) {
        // Clear parents first so FK cascades don't block partial deletes oddly.
        await tx.facilityNode.deleteMany({
          where: { organizationId: orgId, id: { in: toDelete } },
        })
      }

      for (const n of nodes) {
        const newId = idMap.get(n.id || n.tempId)
        if (!newId) continue
        const parentKey = n.parentId
        const newParent = parentKey ? idMap.get(parentKey) : null
        await tx.facilityNode.update({
          where: { id: newId },
          data: { parentId: newParent || null },
        })
        await tx.facilityNodeDevice.deleteMany({ where: { facilityNodeId: newId } })
        const deviceIds = Array.isArray(n.deviceIds) ? [...new Set(n.deviceIds.filter(Boolean))] : []
        if (deviceIds.length) {
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
