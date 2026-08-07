// ─── Theme controller ─────────────────────────────────────────────────────────
// Themes define branding + colour palette. SUPER_ADMIN manages themes;
// any authenticated user can fetch the active theme for their org / platform.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

const THEME_SELECT = {
  id: true,
  name: true,
  headerFontColor: true,
  headerBgColor: true,
  bodyFontColor: true,
  bodyBgColor: true,
  fontSize: true,
  logoUrl: true,
  sidebarColor: true,
  fontFamily: true,
  darkModeDefault: true,
  showLogoInSidebar: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}

const parseBool = (v, fallback) => {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'boolean') return v
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return fallback
}

const themeBodyFromReq = (req, existing = {}) => {
  const b = req.body || {}
  const logoFromUpload = req.file?.path || req.file?.secure_url || null
  return {
    name: b.name ?? existing.name,
    headerFontColor: b.headerFontColor ?? existing.headerFontColor ?? '#ffffff',
    headerBgColor: b.headerBgColor ?? b.primaryColor ?? existing.headerBgColor,
    bodyFontColor: b.bodyFontColor ?? existing.bodyFontColor ?? '#1f2937',
    bodyBgColor: b.bodyBgColor ?? b.secondaryColor ?? existing.bodyBgColor,
    fontSize: b.fontSize ?? existing.fontSize,
    logoUrl: logoFromUpload || b.logoUrl || existing.logoUrl || null,
    sidebarColor: b.sidebarColor ?? existing.sidebarColor ?? 'Dark',
    fontFamily: b.fontFamily ?? existing.fontFamily ?? 'Inter',
    darkModeDefault: parseBool(b.darkModeDefault, existing.darkModeDefault ?? true),
    showLogoInSidebar: parseBool(b.showLogoInSidebar, existing.showLogoInSidebar ?? true),
    status: b.status ?? existing.status ?? 'ACTIVE',
  }
}

// @desc  Active theme for current user (org theme, else first ACTIVE platform theme)
// @access any authenticated role
const getActiveTheme = async (req, res, next) => {
  try {
    let theme = null
    if (req.user.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        select: { theme: { select: THEME_SELECT }, logoUrl: true, name: true },
      })
      if (org?.theme) theme = org.theme
    }
    if (!theme) {
      theme = await prisma.theme.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        select: THEME_SELECT,
      })
    }
    res.json({ success: true, data: theme })
  } catch (err) { next(err) }
}

// @desc  List themes; filterable by status
// @access SUPER_ADMIN
const getThemes = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = {}
    if (req.query.status) where.status = req.query.status

    const [data, total] = await Promise.all([
      prisma.theme.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          ...THEME_SELECT,
          organizations: { select: { id: true, name: true } },
        },
      }),
      prisma.theme.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a theme
// @access SUPER_ADMIN
const createTheme = async (req, res, next) => {
  try {
    const fields = themeBodyFromReq(req)
    if (!fields.name) return next(new AppError('name is required', 400))
    const data = await prisma.theme.create({
      data: { ...fields, createdBy: req.user.id },
      select: THEME_SELECT,
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a theme's branding and colours
// @access SUPER_ADMIN
const updateTheme = async (req, res, next) => {
  try {
    const existing = await prisma.theme.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('Theme not found', 404))

    const fields = themeBodyFromReq(req, existing)
    const data = await prisma.theme.update({
      where: { id: req.params.id },
      data: fields,
      select: THEME_SELECT,
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

    const theme = await prisma.theme.findUnique({ where: { id: req.params.id } })
    if (!theme) return next(new AppError('Theme not found', 404))

    const data = await prisma.organization.update({
      where: { id: orgId },
      data: { themeId: req.params.id },
      select: { id: true, name: true, themeId: true },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

module.exports = {
  getActiveTheme, getThemes, createTheme, updateTheme, deleteTheme, assignTheme,
}
