#!/usr/bin/env node
// Export cold sensor rollups to JSON files for archival (P-38).
// Usage: node scripts/archive-cold-data.js [--days=90] [--out=./archives]

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const days = parseInt(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] || '90', 10)
const outDir = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] || path.join(__dirname, '..', 'archives')

const run = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    fs.mkdirSync(outDir, { recursive: true })
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const { rows } = await client.query(
      `SELECT bucket, "deviceId", variable_name, avg_value
       FROM sensor_readings_hourly
       WHERE bucket < $1
       ORDER BY bucket ASC`,
      [cutoff]
    )
    const file = path.join(outDir, `hourly-rollups-before-${cutoff.toISOString().slice(0, 10)}.json`)
    fs.writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), cutoff, rows }, null, 2))
    console.log(`Archived ${rows.length} hourly rollup rows → ${file}`)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((err) => { console.error(err); process.exit(1) })
