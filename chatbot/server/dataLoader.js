/**
 * dataLoader.js  — Phase A
 *
 * Reads every CSV from /data/chatbot/ into memory on server startup.
 * Exposes a clean JS object (db) that the chatbot tool functions query
 * exactly as Prisma queries would — same field names, same relationships.
 *
 * No Postgres / Redis required for demo purposes.
 * Swap individual functions for real Prisma calls whenever DB is available.
 */

const fs   = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')

// ── Path to CSV data directory ────────────────────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '../../data/chatbot')

function readCsv(filename) {
  const file = path.join(DATA_DIR, filename)
  if (!fs.existsSync(file)) { console.warn(`[dataLoader] Missing: ${filename}`); return [] }
  const raw = fs.readFileSync(file, 'utf8')
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true })
}

// ── In-memory store ───────────────────────────────────────────────────────────
const db = {
  organizations:              [],
  users:                      [],
  gateways:                   [],
  devices:                    [],
  deviceUsers:                [],
  deviceConfigSlaves:         [],
  deviceConfigVariables:      [],
  alarmSettings:              [],
  alarmHistories:             [],
  alarmHistoryNotifications:  [],
  sensorReadings:             [],
  sensorReadingValues:        [],
  intervalHistories:          [],
}

function load() {
  db.organizations             = readCsv('organizations.csv')
  db.users                     = readCsv('users.csv')
  db.gateways                  = readCsv('gateways.csv')
  db.devices                   = readCsv('devices.csv')
  db.deviceUsers               = readCsv('device_users.csv')
  db.deviceConfigSlaves        = readCsv('device_config_slaves.csv')
  db.deviceConfigVariables     = readCsv('device_config_variables.csv')
  db.alarmSettings             = readCsv('alarm_settings.csv')
  db.alarmHistories            = readCsv('alarm_histories.csv')
  db.alarmHistoryNotifications = readCsv('alarm_history_notifications.csv')
  db.sensorReadings            = readCsv('sensor_readings_sample.csv')
  db.sensorReadingValues       = readCsv('sensor_reading_values_sample.csv')
  db.intervalHistories         = readCsv('interval_histories.csv')

  // ── Row count report vs manifest ──────────────────────────────────────────
  const manifest = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8')
  ).files

  const report = [
    ['organizations.csv',             db.organizations.length],
    ['users.csv',                     db.users.length],
    ['gateways.csv',                  db.gateways.length],
    ['devices.csv',                   db.devices.length],
    ['device_users.csv',              db.deviceUsers.length],
    ['device_config_slaves.csv',      db.deviceConfigSlaves.length],
    ['device_config_variables.csv',   db.deviceConfigVariables.length],
    ['alarm_settings.csv',            db.alarmSettings.length],
    ['alarm_histories.csv',           db.alarmHistories.length],
    ['alarm_history_notifications.csv', db.alarmHistoryNotifications.length],
    ['sensor_readings_sample.csv',    db.sensorReadings.length],
    ['sensor_reading_values_sample.csv', db.sensorReadingValues.length],
    ['interval_histories.csv',        db.intervalHistories.length],
  ]

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║  SmartAgriTech Chatbot — CSV Data Load Report        ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  report.forEach(([file, count]) => {
    const expected = manifest[file] ?? '?'
    const ok = count === expected || expected === '?'
    console.log(`║  ${ok ? '✓' : '✗'} ${file.padEnd(38)} ${String(count).padStart(3)} / ${String(expected).padStart(3)}  ║`)
  })
  console.log('╚══════════════════════════════════════════════════════╝\n')
}

module.exports = { db, load }
