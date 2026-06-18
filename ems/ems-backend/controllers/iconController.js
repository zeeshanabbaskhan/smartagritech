// ─── Icon controller ──────────────────────────────────────────────────────────
// Icons are uploaded to Cloudinary via multer middleware and referenced by
// DeviceTemplateVariable records.  Deletion is blocked when icons are in use.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

// @desc  List icons; filterable by status
// @access Any authenticated user
const getIcons = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = {}
    if (req.query.status) where.status = req.query.status

    const [data, total] = await Promise.all([
      prisma.icon.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.icon.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Upload and create an icon (req.file populated by multer/Cloudinary)
// @access SUPER_ADMIN
const createIcon = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('Image file is required', 400))
    const data = await prisma.icon.create({ data: { name: req.body.name, imageUrl: req.file.path } })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update icon name and optionally replace the image
// @access SUPER_ADMIN
const updateIcon = async (req, res, next) => {
  try {
    const existing = await prisma.icon.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('Icon not found', 404))

    const updateData = { name: req.body.name }
    if (req.file) updateData.imageUrl = req.file.path

    const data = await prisma.icon.update({ where: { id: req.params.id }, data: updateData })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete an icon; blocked when referenced by template variables
// @access SUPER_ADMIN
const deleteIcon = async (req, res, next) => {
  try {
    const inUse = await prisma.deviceTemplateVariable.count({ where: { iconId: req.params.id } })
    if (inUse) return next(new AppError('Icon is in use by template variables.', 400))

    const existing = await prisma.icon.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('Icon not found', 404))

    await prisma.icon.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Icon deleted' })
  } catch (err) { next(err) }
}

module.exports = { getIcons, createIcon, updateIcon, deleteIcon }
