// ─── Product controller ───────────────────────────────────────────────────────
// Public product catalog; no auth required for reads.
// Image uploads use multer/Cloudinary (req.file.path after upload middleware).
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

// @desc  List products; filterable by status (public)
// @access Public
const getProducts = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = {}
    if (req.query.status) where.status = req.query.status

    const [data, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.product.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Create a product with optional image upload
// @access SUPER_ADMIN
const createProduct = async (req, res, next) => {
  try {
    const { name, price, description, status } = req.body
    const imageUrl = req.file ? req.file.path : null

    const data = await prisma.product.create({
      data: { name, price: price != null ? parseFloat(price) : null, imageUrl, description, status },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update a product; image replaced only when a new file is uploaded
// @access SUPER_ADMIN
const updateProduct = async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('Product not found', 404))

    const { name, price, description, status } = req.body
    const updateData = { name, price: price != null ? parseFloat(price) : undefined, description, status }
    if (req.file) updateData.imageUrl = req.file.path

    const data = await prisma.product.update({ where: { id: req.params.id }, data: updateData })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a product
// @access SUPER_ADMIN
const deleteProduct = async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!existing) return next(new AppError('Product not found', 404))

    await prisma.product.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Product deleted' })
  } catch (err) { next(err) }
}

module.exports = { getProducts, createProduct, updateProduct, deleteProduct }
