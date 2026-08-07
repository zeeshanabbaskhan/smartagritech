// ─── Device timestamp controller ──────────────────────────────────────────────
// DeviceTimestamp records the last time each device sent data (upserted by the
// ingest endpoint). Online = last ping within DEVICE_OFFLINE_AFTER_MS.
const prisma      = require('../config/database')
const { orgScope, paginate } = require('../utils/helpers')
const { OFFLINE_AFTER_MS } = require('../services/devicePresenceService')

// @desc  List device timestamps with computed online status
// @access SUPER_ADMIN | ORG_ADMIN
const getDeviceTimestamps = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query)
    const where = { ...orgScope(req.user) }

    const [records, total] = await Promise.all([
      prisma.deviceTimestamp.findMany({
        where, skip, take: limit,
        orderBy: { lastActiveAt: 'desc' },
        include: { device: { select: { id: true, name: true, status: true } } },
      }),
      prisma.deviceTimestamp.count({ where }),
    ])

    const now  = Date.now()
    const data = records.map((r) => ({
      ...r,
      lastActiveMinsAgo: Math.floor((now - new Date(r.lastActiveAt).getTime()) / 60_000),
      onlineStatus:      now - new Date(r.lastActiveAt).getTime() < OFFLINE_AFTER_MS ? 'ONLINE' : 'OFFLINE',
    }))

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

module.exports = { getDeviceTimestamps }
