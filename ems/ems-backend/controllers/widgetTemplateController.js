// ─── Widget template controller ───────────────────────────────────────────────
// Widget templates define the dashboard cards shown in the Flutter UI.
// Each card is tied to a variable name from the device readings.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { orgScope, paginate } = require('../utils/helpers')

// @desc  List widget templates; filterable by widgetType
// @access SUPER_ADMIN | ORG_ADMIN
const getWidgetTemplates = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user) }
    if (req.query.widgetType) where.widgetType = req.query.widgetType

    const [data, total] = await Promise.all([
      prisma.widgetTemplate.findMany({ where, skip, take: limit, orderBy: { position: 'asc' } }),
      prisma.widgetTemplate.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a widget template
// @access SUPER_ADMIN | ORG_ADMIN
const createWidgetTemplate = async (req, res, next) => {
  try {
    const { organizationId, name, iconId, themeId, widgetType, variableName, displayName, unit, position } = req.body
    const orgId = req.user.role === 'SUPER_ADMIN' ? organizationId : req.user.organizationId

    const data = await prisma.widgetTemplate.create({
      data: {
        organizationId: orgId,
        name, iconId, themeId, widgetType, variableName, displayName, unit,
        position:  position != null ? parseInt(position) : 0,
        createdBy: req.user.id,
      },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a widget template
// @access SUPER_ADMIN | ORG_ADMIN
const updateWidgetTemplate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.widgetTemplate.findFirst({ where })
    if (!existing) return next(new AppError('Widget template not found', 404))

    const { name, iconId, themeId, widgetType, variableName, displayName, unit, position, isActive } = req.body
    const data = await prisma.widgetTemplate.update({
      where: { id: req.params.id },
      data: {
        name, iconId, themeId, widgetType, variableName, displayName, unit,
        position: position != null ? parseInt(position) : undefined,
        isActive,
      },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a widget template
// @access SUPER_ADMIN | ORG_ADMIN
const deleteWidgetTemplate = async (req, res, next) => {
  try {
    const where    = { id: req.params.id, ...orgScope(req.user) }
    const existing = await prisma.widgetTemplate.findFirst({ where })
    if (!existing) return next(new AppError('Widget template not found', 404))

    await prisma.widgetTemplate.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Widget template deleted' })
  } catch (err) { next(err) }
}

module.exports = { getWidgetTemplates, createWidgetTemplate, updateWidgetTemplate, deleteWidgetTemplate }
