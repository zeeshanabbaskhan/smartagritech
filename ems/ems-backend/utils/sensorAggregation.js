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

/** Cache whether Timescale continuous aggregate exists (avoids noisy prisma:error spam). */
let hourlyViewAvailable = null // null = unknown, true/false = probed

const probeHourlyView = async (db) => {
  if (hourlyViewAvailable != null) return hourlyViewAvailable
  try {
    const rows = await db.$queryRaw`
      SELECT 1 AS ok
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'sensor_readings_hourly'
      LIMIT 1
    `
    hourlyViewAvailable = Array.isArray(rows) && rows.length > 0
  } catch (_) {
    hourlyViewAvailable = false
  }
  if (!hourlyViewAvailable) {
    console.warn(
      '[sensorAggregation] sensor_readings_hourly missing — using raw sensor_readings. ' +
      'Run scripts/setup-timescaledb.sql on the DB if TimescaleDB is installed.'
    )
  }
  return hourlyViewAvailable
}

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
  if (useHourlyAggregate(opts.startDate) && (await probeHourlyView(db))) {
    try {
      return await bucketVariableHourly(db, opts)
    } catch (_) {
      hourlyViewAvailable = false
    }
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

/**
 * Period consumption for cumulative meters: last reading − first reading in [startDate, endDate).
 * Returns 0 when fewer than 2 samples or the meter went backwards.
 */
const deltaVariable = async (prisma, { deviceId, slaveId, variableName, startDate, endDate }) => {
  const db = readDb(prisma)
  const endClause = endDate ? Prisma.sql`AND v.timestamp < ${endDate}` : Prisma.empty

  try {
    const narrow = await db.$queryRaw`
      SELECT
        (ARRAY_AGG(v.value ORDER BY v.timestamp ASC))[1]::double precision AS first_val,
        (ARRAY_AGG(v.value ORDER BY v.timestamp DESC))[1]::double precision AS last_val,
        COUNT(*)::int AS n
      FROM sensor_reading_values v
      WHERE v."deviceId" = ${deviceId}
        AND v."variableName" = ${variableName}
        AND v.timestamp >= ${startDate}
        ${slaveClauseValues(slaveId)}
        ${endClause}
    `
    const row = narrow[0]
    if (row && Number(row.n) >= 2) {
      const first = Number(row.first_val)
      const last = Number(row.last_val)
      if (Number.isFinite(first) && Number.isFinite(last) && last >= first) {
        return parseFloat((last - first).toFixed(4))
      }
    }
  } catch (_) {}

  const endClauseSr = endDate ? Prisma.sql`AND sr."timestamp" < ${endDate}` : Prisma.empty
  const rows = await db.$queryRaw`
    WITH vals AS (
      SELECT (elem->>'value')::double precision AS val, sr."timestamp" AS ts
      FROM "sensor_readings" sr,
           jsonb_array_elements(sr.readings::jsonb) AS elem
      WHERE sr."deviceId" = ${deviceId}
        AND sr."timestamp" >= ${startDate}
        AND elem->>'variableName' = ${variableName}
        ${slaveClause(slaveId)}
        ${endClauseSr}
    )
    SELECT
      (ARRAY_AGG(val ORDER BY ts ASC))[1]::double precision AS first_val,
      (ARRAY_AGG(val ORDER BY ts DESC))[1]::double precision AS last_val,
      COUNT(*)::int AS n
    FROM vals
  `
  const row = rows[0]
  if (!row || Number(row.n) < 2) return 0
  const first = Number(row.first_val)
  const last = Number(row.last_val)
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return 0
  return parseFloat((last - first).toFixed(4))
}

/** Common cumulative / energy meter names seen across MQTT templates. */
const ENERGY_DELTA_VARS = [
  'Energy', 'PowerConsumption', 'TotalEnergy', 'ImportEnergy',
  'ActiveEnergy', 'kWh', 'KWH', 'Units', 'EnergyImport',
]

/**
 * Best-effort kWh for a window. Prefers cumulative energy deltas,
 * then PowerConsumption sum, then ActivePower (W) sum converted to kW·samples proxy.
 */
const periodEnergyKwh = async (prisma, opts) => {
  for (const variableName of ENERGY_DELTA_VARS) {
    const delta = await deltaVariable(prisma, { ...opts, variableName })
    if (delta > 0) return delta
  }

  const pcSum = await sumVariable(prisma, { ...opts, variableName: 'PowerConsumption' })
  if (pcSum > 0) return pcSum

  const apSum = await sumVariable(prisma, { ...opts, variableName: 'ActivePower' })
  if (apSum > 0) return parseFloat((apSum / 1000).toFixed(4))

  return 0
}

const bucketMany = async (prisma, deviceId, slaveId, startDate, bucketMs, names) => {
  const entries = await Promise.all(
    names.map(async (name) => [name, await bucketVariable(prisma, { deviceId, slaveId, variableName: name, startDate, bucketMs })])
  )
  return Object.fromEntries(entries)
}

module.exports = { bucketVariable, sumVariable, deltaVariable, periodEnergyKwh, bucketMany }
