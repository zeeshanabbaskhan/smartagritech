// ─── Shared utilities ─────────────────────────────────────────────────────────
// Centralises patterns duplicated across 15+ controllers so each change
// (e.g. adding a new role) only needs to happen in one place.

/**
 * Build a Prisma `where` clause fragment that scopes a query to the user's org.
 * SUPER_ADMIN with an explicit `extraId` override targets that specific org;
 * without an override they see every org (no filter).
 *
 * @param {object} user       - req.user set by the protect middleware
 * @param {string} [extraId]  - explicit organizationId (SUPER_ADMIN only)
 * @returns {object} Prisma where fragment
 */
const orgScope = (user, extraId) => {
  if (user.role === 'SUPER_ADMIN') return extraId ? { organizationId: extraId } : {}
  return { organizationId: user.organizationId }
}

/**
 * Extract page / limit / skip from req.query with safe defaults.
 *
 * @param {object} query - req.query
 * @returns {{ page: number, limit: number, skip: number }}
 */
const paginate = (query) => {
  const page  = Math.max(1, parseInt(query.page,  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10))
  const skip  = (page - 1) * limit
  return { page, limit, skip }
}

/**
 * Build a Prisma date-range filter object from optional ISO strings.
 * Returns undefined when neither bound is provided so callers can spread
 * it directly into a where clause without adding a no-op key.
 *
 * @param {string} [from]
 * @param {string} [to]
 * @returns {{ gte?: Date, lte?: Date } | undefined}
 */
const buildDateRange = (from, to) => {
  if (!from && !to) return undefined
  const range = {}
  if (from) range.gte = new Date(from)
  if (to)   range.lte = new Date(to)
  return range
}

// ─── Time-range helpers (used by sensorData + aiAnalytics) ───────────────────

/** Duration in ms for each named time window */
const TIME_RANGE_MS = {
  '1h':  3_600_000,
  '24h': 86_400_000,
  '7d':  604_800_000,
  '30d': 2_592_000_000,
}

/**
 * Bucket size in ms for chart aggregation within each time window.
 * Produces ≤ 60 data points per window at these granularities.
 */
const BUCKET_MS = {
  '1h':  60_000,       // 1-min buckets  → 60 pts
  '24h': 3_600_000,    // 1-hr buckets   → 24 pts
  '7d':  86_400_000,   // 1-day buckets  → 7  pts
  '30d': 86_400_000,   // 1-day buckets  → 30 pts
}

/**
 * Compute the start timestamp for a named time window.
 * Throws AppError 400 when the timeRange key is unrecognised so the caller
 * can forward it straight to next().
 *
 * @param {string} timeRange - one of '1h' | '24h' | '7d' | '30d'
 * @param {Function} AppError - AppError class from middleware/errorHandler
 * @returns {Date}
 */
const startOfRange = (timeRange, AppError) => {
  const ms = TIME_RANGE_MS[timeRange]
  if (!ms) {
    throw new AppError(`Invalid timeRange. Use: ${Object.keys(TIME_RANGE_MS).join(' | ')}`, 400)
  }
  return new Date(Date.now() - ms)
}

module.exports = { orgScope, paginate, buildDateRange, TIME_RANGE_MS, BUCKET_MS, startOfRange }
