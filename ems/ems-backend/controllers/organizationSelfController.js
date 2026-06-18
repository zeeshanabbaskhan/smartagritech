// ─── Organization self-service controller (ORG_ADMIN / any authenticated) ────
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')

// @desc  Return the calling user's own organisation
// @access Any authenticated user
const getMyOrganization = async (req, res, next) => {
  try {
    if (!req.user.organizationId) {
      return next(new AppError('No organization associated with this account', 404))
    }

    const data = await prisma.organization.findUnique({
      where:   { id: req.user.organizationId },
      include: { theme: { select: { id: true, name: true } } },
    })
    if (!data) return next(new AppError('Organization not found', 404))

    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Update the calling user's own organisation (name, description, logo only)
// @access ORG_ADMIN
const updateMyOrganization = async (req, res, next) => {
  try {
    if (!req.user.organizationId) {
      return next(new AppError('No organization associated with this account', 404))
    }

    const { name, description, logoUrl } = req.body
    const data = await prisma.organization.update({
      where:   { id: req.user.organizationId },
      data:    { name, description, logoUrl },
      include: { theme: { select: { id: true, name: true } } },
    })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

module.exports = { getMyOrganization, updateMyOrganization }
