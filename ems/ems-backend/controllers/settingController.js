// ─── System setting controller ────────────────────────────────────────────────
// Key-value store for global platform configuration (SystemSetting table).
// All operations are SUPER_ADMIN only.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')

// @desc  List all system settings ordered by key
// @access SUPER_ADMIN
const getSettings = async (req, res, next) => {
  try {
    const data = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Create or update a setting by key (upsert)
// @access SUPER_ADMIN
const upsertSetting = async (req, res, next) => {
  try {
    const { key }  = req.params
    const { type, value, description } = req.body

    const data = await prisma.systemSetting.upsert({
      where:  { key },
      update: { value, type, description },
      create: { key, type: type || 'string', value, description },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Delete a setting by key
// @access SUPER_ADMIN
const deleteSetting = async (req, res, next) => {
  try {
    const existing = await prisma.systemSetting.findUnique({ where: { key: req.params.key } })
    if (!existing) return next(new AppError('Setting not found', 404))

    await prisma.systemSetting.delete({ where: { key: req.params.key } })
    res.json({ success: true, message: 'Setting deleted' })
  } catch (err) { next(err) }
}

module.exports = { getSettings, upsertSetting, deleteSetting }
