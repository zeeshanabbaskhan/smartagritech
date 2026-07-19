/**
 * Idempotent schema ensure on server start.
 * - Always applies prisma/add_cf_features.sql (CF tables).
 * - Applies scripts/setup-timescaledb.sql only when TimescaleDB is installed
 *   and sensor_readings_hourly is missing.
 *
 * Disable: ENSURE_SCHEMA_ON_START=false
 * Skip Timescale only: ENSURE_TIMESCALE_ON_START=false
 */

const fs = require('fs')
const path = require('path')
const { pool } = require('../config/database')
const logger = require('./logger')

const runSqlFile = async (relPath) => {
  const full = path.join(__dirname, '..', relPath)
  const sql = fs.readFileSync(full, 'utf8')
  await pool.query(sql)
}

const relationExists = async (name) => {
  const { rows } = await pool.query(
    `SELECT 1
     FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1
     LIMIT 1`,
    [name]
  )
  return rows.length > 0
}

const ensureCfFeatures = async () => {
  await runSqlFile('prisma/add_cf_features.sql')
  logger.info('CF schema ensured (add_cf_features.sql)')
}

const ensureTimescale = async () => {
  if (process.env.ENSURE_TIMESCALE_ON_START === 'false') return

  const { rows: ext } = await pool.query(
    `SELECT 1 FROM pg_extension WHERE extname = 'timescaledb' LIMIT 1`
  )
  if (!ext.length) {
    logger.info('TimescaleDB extension not installed — skipping hourly aggregate setup')
    return
  }

  if (await relationExists('sensor_readings_hourly')) {
    logger.info('sensor_readings_hourly already present')
    return
  }

  await runSqlFile('scripts/setup-timescaledb.sql')
  logger.info('TimescaleDB setup applied (sensor_readings_hourly)')
}

const ensureSchemaOnStart = async () => {
  if (process.env.ENSURE_SCHEMA_ON_START === 'false') {
    logger.info('Schema ensure skipped (ENSURE_SCHEMA_ON_START=false)')
    return
  }

  try {
    await ensureCfFeatures()
  } catch (err) {
    logger.error('CF schema ensure failed', { message: err.message })
    throw err
  }

  try {
    await ensureTimescale()
  } catch (err) {
    logger.warn('TimescaleDB setup failed (continuing with raw sensor_readings)', {
      message: err.message,
    })
  }
}

module.exports = { ensureSchemaOnStart }
