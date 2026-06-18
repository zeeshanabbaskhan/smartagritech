// ─── Subscription controller ──────────────────────────────────────────────────
// Lets anonymous visitors submit a contact/subscription request.
// SUPER_ADMIN can list and update the status of incoming requests.
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

// @desc  Submit a new subscription / contact request (no auth required)
// @access Public
const createSubscription = async (req, res, next) => {
  try {
    const { name, email, phone, description, organizationId } = req.body
    if (!name || !email) return next(new AppError('name and email are required', 400))

    const data = await prisma.subscription.create({
      data: { name, email, phone, description, organizationId: organizationId || null },
    })
    res.status(201).json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  List all subscription requests; filterable by status
// @access SUPER_ADMIN
const getSubscriptions = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = {}
    if (req.query.status) where.status = req.query.status

    const [data, total] = await Promise.all([
      prisma.subscription.findMany({ where, skip, take: limit, orderBy: { submittedAt: 'desc' } }),
      prisma.subscription.count({ where }),
    ])
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Update the status of a subscription request (NEW | CONTACTED | CLOSED)
// @access SUPER_ADMIN
const updateSubscriptionStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['NEW', 'CONTACTED', 'CLOSED'].includes(status)) {
      return next(new AppError('status must be NEW, CONTACTED, or CLOSED', 400))
    }

    const data = await prisma.subscription.update({ where: { id: req.params.id }, data: { status } })
    res.json({ success: true, data })
  } catch (err) {
    if (err.code === 'P2025') return next(new AppError('Subscription not found', 404))
    next(err)
  }
}

module.exports = { createSubscription, getSubscriptions, updateSubscriptionStatus }
