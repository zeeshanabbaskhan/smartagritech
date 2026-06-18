// ─── Theme controller ─────────────────────────────────────────────────────────
// Themes define the colour palette applied to organisation dashboards.
// SUPER_ADMIN manages themes; assignment links a theme to an org.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

// @desc  List themes; filterable by status
// @access SUPER_ADMIN
const getThemes = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = {}
    if (req.query.status) where.status = req.query.status

    const [data, total] = await Promise.all([
      prisma.theme.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.theme.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a theme
// @access SUPER_ADMIN
const createTheme = async (req, res, next) => {
  try {
    const { name, headerFontColor, headerBgColor, bodyFontColor, bodyBgColor, fontSize, status } = req.body
    const data = await prisma.theme.create({
      data: { name, headerFontColor, headerBgColor, bodyFontColor, bodyBgColor, fontSize, status, createdBy: req.user.id },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a theme's colours and status
// @access SUPER_ADMIN
const updateTheme = async (req, res, next) => {
  try {
    const existing = await prisma.theme.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('Theme not found', 404))

    const { name, headerFontColor, headerBgColor, bodyFontColor, bodyBgColor, fontSize, status } = req.body
    const data = await prisma.theme.update({
      where: { id: req.params.id },
      data:  { name, headerFontColor, headerBgColor, bodyFontColor, bodyBgColor, fontSize, status },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a theme
// @access SUPER_ADMIN
const deleteTheme = async (req, res, next) => {
  try {
    const existing = await prisma.theme.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('Theme not found', 404))

    await prisma.theme.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Theme deleted' })
  } catch (err) { next(err) }
}

// @desc  Assign a theme to an organisation
// @access SUPER_ADMIN
const assignTheme = async (req, res, next) => {
  try {
    const { orgId } = req.body
    if (!orgId) return next(new AppError('orgId is required', 400))

    const data = await prisma.organization.update({ where: { id: orgId }, data: { themeId: req.params.id } })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

module.exports = { getThemes, createTheme, updateTheme, deleteTheme, assignTheme }
