// ─── List type + list item controller ────────────────────────────────────────
// ListType is a named category (e.g. "DeviceModel"); ListTypeItem is one value
// within that category.  Items can be accessed via two URL patterns:
//   • Nested:     /api/list-types/:listTypeId/items/:itemId
//   • Standalone: /api/list-items/:id  (listTypeId from query/body)
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

// ─── LIST TYPES ───────────────────────────────────────────────────────────────

// @desc  List all list types (with item count)
// @access SUPER_ADMIN
const getListTypes = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)

    const [data, total] = await Promise.all([
      prisma.listType.findMany({
        skip, take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { items: true } } },
      }),
      prisma.listType.count(),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a list type
// @access SUPER_ADMIN
const createListType = async (req, res, next) => {
  try {
    const { name, description } = req.body
    const data = await prisma.listType.create({ data: { name, description } })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a list type's name/description/active state
// @access SUPER_ADMIN
const updateListType = async (req, res, next) => {
  try {
    const existing = await prisma.listType.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('List type not found', 404))

    const { name, description, isActive } = req.body
    const data = await prisma.listType.update({ where: { id: req.params.id }, data: { name, description, isActive } })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a list type; blocked when it still has items
// @access SUPER_ADMIN
const deleteListType = async (req, res, next) => {
  try {
    const count = await prisma.listTypeItem.count({ where: { listTypeId: req.params.id } })
    if (count) return next(new AppError('Cannot delete: list type has items. Remove items first.', 400))

    await prisma.listType.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'List type deleted' })
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('List type not found', 404))
    next(err)
  }
}

// ─── LIST TYPE ITEMS (nested under /list-types/:listTypeId) ──────────────────

// @desc  List items for a specific list type
// @access SUPER_ADMIN
const getListItems = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { listTypeId: req.params.listTypeId }
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true'

    const [data, total] = await Promise.all([
      prisma.listTypeItem.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.listTypeItem.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create an item within a list type
// @access SUPER_ADMIN
const createListItem = async (req, res, next) => {
  try {
    const { name, description } = req.body
    const listType = await prisma.listType.findUnique({ where: { id: req.params.listTypeId } })
    if (!listType) return next(new AppError('List type not found', 404))

    const data = await prisma.listTypeItem.create({ data: { listTypeId: req.params.listTypeId, name, description } })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a nested list item
// @access SUPER_ADMIN
const updateListItem = async (req, res, next) => {
  try {
    const where    = { id: req.params.itemId, listTypeId: req.params.listTypeId }
    const existing = await prisma.listTypeItem.findFirst({ where })
    if (!existing) return next(new AppError('List item not found', 404))

    const { name, description, isActive } = req.body
    const data = await prisma.listTypeItem.update({ where: { id: req.params.itemId }, data: { name, description, isActive } })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a nested list item
// @access SUPER_ADMIN
const deleteListItem = async (req, res, next) => {
  try {
    const where    = { id: req.params.itemId, listTypeId: req.params.listTypeId }
    const existing = await prisma.listTypeItem.findFirst({ where })
    if (!existing) return next(new AppError('List item not found', 404))

    await prisma.listTypeItem.delete({ where: { id: req.params.itemId } })
    res.json({ success: true, message: 'List item deleted' })
  } catch (err) { next(err) }
}

// ─── LIST ITEMS standalone (under /api/list-items) ───────────────────────────

// @desc  List items across all types; filterable by listTypeId and isActive
// @access SUPER_ADMIN
const getListItemsAll = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = {}
    if (req.query.listTypeId)     where.listTypeId = req.query.listTypeId
    if (req.query.isActive !== undefined) where.isActive = req.query.isActive === 'true'

    const [data, total] = await Promise.all([
      prisma.listTypeItem.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.listTypeItem.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create an item directly (listTypeId required in body)
// @access SUPER_ADMIN
const createListItemDirect = async (req, res, next) => {
  try {
    const { listTypeId, name, description } = req.body
    if (!listTypeId) return next(new AppError('listTypeId is required', 400))

    const listType = await prisma.listType.findUnique({ where: { id: listTypeId } })
    if (!listType) return next(new AppError('List type not found', 404))

    const data = await prisma.listTypeItem.create({ data: { listTypeId, name, description } })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a list item directly by id
// @access SUPER_ADMIN
const updateListItemDirect = async (req, res, next) => {
  try {
    const existing = await prisma.listTypeItem.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('List item not found', 404))

    const { name, description, isActive } = req.body
    const data = await prisma.listTypeItem.update({ where: { id: req.params.id }, data: { name, description, isActive } })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a list item directly by id
// @access SUPER_ADMIN
const deleteListItemDirect = async (req, res, next) => {
  try {
    await prisma.listTypeItem.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'List item deleted' })
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('List item not found', 404))
    next(err)
  }
}

module.exports = {
  getListTypes, createListType, updateListType, deleteListType,
  getListItems, createListItem, updateListItem, deleteListItem,
  getListItemsAll, createListItemDirect, updateListItemDirect, deleteListItemDirect,
}
