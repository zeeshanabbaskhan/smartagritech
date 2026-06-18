// ─── Notification controller ──────────────────────────────────────────────────
// In-app notifications are created by notificationService when an alarm fires.
// All operations are scoped to the calling user (not their org).
const prisma      = require('../config/database')
const { AppError } = require('../middleware/errorHandler')
const { paginate } = require('../utils/helpers')

// @desc  List notifications for the calling user; filterable by read status
// @access Any authenticated user
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { userId: req.user.id }
    if (req.query.read !== undefined) where.read = req.query.read === 'true'

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } }),
    ])

    res.json({ success: true, data, total, unreadCount, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

// @desc  Mark a single notification as read
// @access Any authenticated user
const markRead = async (req, res, next) => {
  try {
    const existing = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!existing) return next(new AppError('Notification not found', 404))

    const data = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } })
    res.json({ success: true, data })
  } catch (err) { next(err) }
}

// @desc  Mark all unread notifications as read
// @access Any authenticated user
const markAllRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } })
    res.json({ success: true, message: 'All notifications marked as read' })
  } catch (err) { next(err) }
}

// @desc  Delete a single notification
// @access Any authenticated user
const deleteNotification = async (req, res, next) => {
  try {
    const existing = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.user.id } })
    if (!existing) return next(new AppError('Notification not found', 404))

    await prisma.notification.delete({ where: { id: req.params.id } })
    res.json({ success: true, message: 'Notification deleted' })
  } catch (err) { next(err) }
}

// @desc  Clear all notifications for the calling user
// @access Any authenticated user
const deleteAllNotifications = async (req, res, next) => {
  try {
    const result = await prisma.notification.deleteMany({ where: { userId: req.user.id } })
    res.json({ success: true, deleted: result.count })
  } catch (err) { next(err) }
}

module.exports = { getNotifications, markRead, markAllRead, deleteNotification, deleteAllNotifications }
