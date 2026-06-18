// ─── SQL-based sensor reading aggregation (P-11, P-12, P-14, P-36) ─────────

const { Prisma } = require('@prisma/client')
const { read: prismaRead } = require('../config/database')

const readDb = (fallback) => prismaRead || fallback

const slaveClause = (slaveId) =>
  slaveId ? Prisma.sql`AND sr."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty

const slaveClauseValues = (slaveId) =>
  slaveId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty

const useHourlyAggregate = (startDate) =>
  startDate && Date.now() - startDate.getTime() > 7 * 24 * 60 * 60 * 1000

const bucketVariableHourly = async (db, { deviceId, variableName, startDate, bucketMs }) => {
  const rows = await db.$queryRaw`
    SELECT
      (floor(extract(epoch from bucket) * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
      AVG(avg_value)::double precision AS avg_val
    FROM sensor_readings_hourly
    WHERE "deviceId" = ${deviceId}
      AND variable_name = ${variableName}
      AND bucket >= ${startDate}
    GROUP BY bucket_ms
    ORDER BY bucket_ms ASC
  `
  return rows.map((r) => ({
    timestamp: new Date(Number(r.bucket_ms)),
    value:     parseFloat(Number(r.avg_val).toFixed(4)),
  }))
}

const bucketVariable = async (prisma, opts) => {
  const db = readDb(prisma)
  if (useHourlyAggregate(opts.startDate)) {
    try {
      return await bucketVariableHourly(db, opts)
    } catch (_) { /* fall through if view missing */ }
  }

  const { deviceId, slaveId, variableName, startDate, bucketMs } = opts
  const rows = await db.$queryRaw`
    SELECT
      (floor(extract(epoch from sr."timestamp") * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
      AVG((elem->>'value')::double precision) AS avg_val
    FROM "sensor_readings" sr,
         jsonb_array_elements(sr.readings::jsonb) AS elem
    WHERE sr."deviceId" = ${deviceId}
      AND sr."timestamp" >= ${startDate}
      AND elem->>'variableName' = ${variableName}
      ${slaveClause(slaveId)}
    GROUP BY bucket_ms
    ORDER BY bucket_ms ASC
  `
  return rows.map((r) => ({
    timestamp: new Date(Number(r.bucket_ms)),
    value:     parseFloat(Number(r.avg_val).toFixed(4)),
  }))
}

const sumVariable = async (prisma, { deviceId, slaveId, variableName, startDate, endDate }) => {
  const db = readDb(prisma)
  const endClause = endDate ? Prisma.sql`AND v.timestamp < ${endDate}` : Prisma.empty

  try {
    const narrow = await db.$queryRaw`
      SELECT COALESCE(SUM(v.value), 0)::double precision AS total
      FROM sensor_reading_values v
      WHERE v."deviceId" = ${deviceId}
        AND v."variableName" = ${variableName}
        AND v.timestamp >= ${startDate}
        ${slaveClauseValues(slaveId)}
        ${endClause}
    `
    if (narrow[0]?.total != null) return parseFloat(Number(narrow[0].total).toFixed(4))
  } catch (_) {}

  const endClauseSr = endDate ? Prisma.sql`AND sr."timestamp" < ${endDate}` : Prisma.empty
  const rows = await db.$queryRaw`
    SELECT COALESCE(SUM((elem->>'value')::double precision), 0)::double precision AS total
    FROM "sensor_readings" sr,
         jsonb_array_elements(sr.readings::jsonb) AS elem
    WHERE sr."deviceId" = ${deviceId}
      AND sr."timestamp" >= ${startDate}
      AND elem->>'variableName' = ${variableName}
      ${slaveClause(slaveId)}
      ${endClauseSr}
  `
  return parseFloat(Number(rows[0]?.total ?? 0).toFixed(4))
}

const bucketMany = async (prisma, deviceId, slaveId, startDate, bucketMs, names) => {
  const entries = await Promise.all(
    names.map(async (name) => [name, await bucketVariable(prisma, { deviceId, slaveId, variableName: name, startDate, bucketMs })])
  )
  return Object.fromEntries(entries)
}

module.exports = { bucketVariable, sumVariable, bucketMany }
