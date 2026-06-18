// Bulk sensor reading insert via Postgres COPY (P-10).

const { pool } = require('../config/database')
const { from: copyFrom } = require('pg-copy-streams')
const { Readable } = require('stream')

/**
 * COPY rows into sensor_readings. Each row: { id, deviceId, deviceConfigSlaveId, organizationId, timestamp, readings }.
 */
const copySensorReadings = async (rows) => {
  if (!rows.length) return
  const client = await pool.connect()
  try {
    const lines = rows.map((r) => {
      const ts = r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp
      const json = JSON.stringify(r.readings).replace(/\\/g, '\\\\').replace(/\t/g, ' ')
      return [r.id, r.deviceId, r.deviceConfigSlaveId || '\\N', r.organizationId, ts, json].join('\t')
    })
    const stream = client.query(copyFrom(`
      COPY sensor_readings (id, "deviceId", "deviceConfigSlaveId", "organizationId", timestamp, readings)
      FROM STDIN WITH (FORMAT text, NULL '\\N')
    `))
    await new Promise((resolve, reject) => {
      Readable.from(lines.join('\n') + '\n')
        .pipe(stream)
        .on('finish', resolve)
        .on('error', reject)
    })
  } finally {
    client.release()
  }
}

module.exports = { copySensorReadings }
