/**
 * extend-billing-history.js  — Phase D1
 *
 * Generates 60 days of daily IntervalHistory rows per device (covering
 * "last month" July 2026 + "this month" August 1–5 2026).
 *
 * Uses the SAME deterministic IDs and device/org UUIDs from generate-sample-data.js
 * so everything is consistent. Writes a new CSV that REPLACES interval_histories.csv
 * with the full 60-day dataset (idempotent — safe to re-run).
 *
 * Run from repo root:
 *   node data/chatbot/scripts/extend-billing-history.js
 */

const fs     = require('fs')
const path   = require('path')
const crypto = require('crypto')

const OUT_DIR  = path.join(__dirname, '..')
const NOW      = new Date('2026-08-06T00:00:00.000Z')  // "today" in the dataset

// ── Same deterministic ID function as generate-sample-data.js ─────────────────
const id = (label) => {
  const h = crypto.createHash('sha256').update(`ems-chatbot-sample:${label}`).digest('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`
}

const csvEscape = (v) => {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ── Seeded PRNG (same as original but with a different seed for billing variation)
let seed = 137
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff }
const rand = (min, max, dp = 2) => parseFloat((rnd() * (max - min) + min).toFixed(dp))

// ── Device specs (exact same IDs as generate-sample-data.js) ─────────────────
const orgGF  = { id: id('org:greenfield'), name: 'Greenfield Energy Co' }
const orgRD  = { id: id('org:riverdale'),  name: 'Riverdale Manufacturing' }

const deviceSpecs = [
  // Greenfield — commercial campus (lower kWh, ~12–24/day per meter)
  { name: 'Energy Meter 001', org: orgGF, baseKwh: 13.5,  tariffRate: 32.0 },
  { name: 'Energy Meter 002', org: orgGF, baseKwh: 15.2,  tariffRate: 32.0 },
  { name: 'Energy Meter 003', org: orgGF, baseKwh: 11.8,  tariffRate: 32.0 },
  { name: 'Energy Meter 004', org: orgGF, baseKwh: 9.4,   tariffRate: 32.0 },
  { name: 'Energy Meter 005', org: orgGF, baseKwh: 8.6,   tariffRate: 32.0 },
  { name: 'HVAC Meter North', org: orgGF, baseKwh: 22.0,  tariffRate: 32.0 },  // HVAC uses most
  // Riverdale — industrial plant (higher kWh, ~16–28/day)
  { name: 'Press Line Meter A',   org: orgRD, baseKwh: 17.5, tariffRate: 28.5 },
  { name: 'Press Line Meter B',   org: orgRD, baseKwh: 18.8, tariffRate: 28.5 },
  { name: 'Compressor Bank Meter',org: orgRD, baseKwh: 19.3, tariffRate: 28.5 },
  { name: 'Paint Shop Meter',     org: orgRD, baseKwh: 21.8, tariffRate: 28.5 },
  { name: 'Warehouse Main Meter', org: orgRD, baseKwh: 22.3, tariffRate: 28.5 },
  { name: 'Cold Storage Meter',   org: orgRD, baseKwh: 23.6, tariffRate: 28.5 }, // highest consumer
]

// ── Load configSlave IDs from existing CSV (needed for FK) ───────────────────
function loadConfigSlaveIds() {
  const csvPath = path.join(OUT_DIR, 'device_config_slaves.csv')
  if (!fs.existsSync(csvPath)) {
    // fallback: generate deterministically
    const map = {}
    for (const d of deviceSpecs) {
      const devId = id(`device:${d.name}`)
      map[devId] = id(`cslave:${devId}`)
    }
    return map
  }
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n')
  const headers = lines[0].split(',')
  const devIdx = headers.indexOf('deviceId')
  const csIdx  = headers.indexOf('id')
  const map = {}
  for (const line of lines.slice(1)) {
    const cols = line.split(',')
    map[cols[devIdx]] = cols[csIdx]
  }
  return map
}

// ── Day pattern helpers ───────────────────────────────────────────────────────
// Weekday multiplier: weekdays ~1.0, Sat ~0.85, Sun ~0.65
const weekdayMult = (date) => {
  const dow = date.getUTCDay()  // 0=Sun,6=Sat
  if (dow === 0) return 0.65
  if (dow === 6) return 0.82
  return 1.0
}

// Month pattern: slight upward trend July→August (summer peak)
const monthMult = (date) => {
  const m = date.getUTCMonth() // 6=Jul, 7=Aug
  if (m === 7) return 1.08   // August slightly higher (summer heat)
  return 1.0
}

// Day-of-month pattern — mid-month production peaks for manufacturing
const domMult = (date, isIndustrial) => {
  const dom = date.getUTCDate()
  if (!isIndustrial) return 1.0
  if (dom >= 10 && dom <= 20) return 1.06  // mid-month production run
  return 1.0
}

function main() {
  const configSlaveMap = loadConfigSlaveIds()
  const rows = []

  // Generate 60 days: day 60 is oldest (2026-06-07), day 1 is yesterday (2026-08-05)
  // TODAY = 2026-08-06 (partial, not included — only complete days)
  for (const spec of deviceSpecs) {
    const devId = id(`device:${spec.name}`)
    const csId  = configSlaveMap[devId] || id(`cslave:${devId}`)
    const isIndustrial = spec.org.id === orgRD.id

    for (let dayOffset = 1; dayOffset <= 60; dayOffset++) {
      // startDate = midnight UTC, dayOffset days ago
      const endDate   = new Date(NOW.getTime() - (dayOffset - 1) * 86400_000)
      endDate.setUTCHours(0, 0, 0, 0)
      const startDate = new Date(endDate.getTime() - 86400_000)

      // Realistic daily kWh with weekday/month/dom pattern + random ±12%
      const noise    = 1 + (rnd() - 0.5) * 0.24          // ±12% random noise
      const wMult    = weekdayMult(startDate)
      const mMult    = monthMult(startDate)
      const dMult    = domMult(startDate, isIndustrial)
      const totalUnit = parseFloat(
        Math.max(3, spec.baseKwh * wMult * mMult * dMult * noise).toFixed(2)
      )

      // Tariff = kWh × rate (consistent per device, slight rate variation simulating slab)
      const rateVariation = 1 + (rnd() - 0.5) * 0.04   // ±2% rate fluctuation
      const tariff = parseFloat((totalUnit * spec.tariffRate * rateVariation).toFixed(2))

      rows.push({
        id:                  id(`ih60:${devId}:d${dayOffset}`),
        organizationId:      spec.org.id,
        organizationName:    spec.org.name,
        deviceId:            devId,
        deviceName:          spec.name,
        deviceConfigSlaveId: csId,
        variableName:        'PowerConsumption',
        slaveName:           'Main Meter',
        totalUnit,
        tariff,
        startDate:           startDate.toISOString(),
        endDate:             endDate.toISOString(),
        computedAt:          new Date(endDate.getTime() + 12 * 3600_000).toISOString(),
      })
    }
  }

  // Sort chronologically (newest first matches original file order)
  rows.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))

  // Write CSV
  const headers = [
    'id','organizationId','organizationName','deviceId','deviceName',
    'deviceConfigSlaveId','variableName','slaveName',
    'totalUnit','tariff','startDate','endDate','computedAt',
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(','))
  }
  const outPath = path.join(OUT_DIR, 'interval_histories.csv')
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')

  // ── Sanity check ─────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  Phase D1 — Billing History Extension Report                 ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Total rows written: ${rows.length}                              ║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')

  // Sanity: Cold Storage Meter — last month (July) vs this month (Aug 1–5)
  const csm = rows.filter(r => r.deviceName === 'Cold Storage Meter')
  const julyRows = csm.filter(r => {
    const d = new Date(r.startDate); return d.getUTCMonth() === 6  // July
  })
  const augRows = csm.filter(r => {
    const d = new Date(r.startDate); return d.getUTCMonth() === 7  // August
  })
  const julyKwh    = julyRows.reduce((s, r) => s + parseFloat(r.totalUnit), 0).toFixed(2)
  const julyCost   = julyRows.reduce((s, r) => s + parseFloat(r.tariff),    0).toFixed(2)
  const augKwh     = augRows.reduce((s, r)  => s + parseFloat(r.totalUnit), 0).toFixed(2)
  const augCost    = augRows.reduce((s, r)  => s + parseFloat(r.tariff),    0).toFixed(2)

  console.log(`║  Cold Storage Meter — July 2026:  ${julyKwh} kWh / PKR ${julyCost}   ║`)
  console.log(`║  Cold Storage Meter — Aug 1–5:    ${augKwh}  kWh / PKR ${augCost}    ║`)

  // Greenfield total this month
  const gfAug = rows.filter(r => {
    const d = new Date(r.startDate)
    return r.organizationId === orgGF.id && d.getUTCMonth() === 7
  })
  const gfAugCost = gfAug.reduce((s, r) => s + parseFloat(r.tariff), 0).toFixed(2)
  console.log(`║  Greenfield — Aug 1–5 total cost: PKR ${gfAugCost}              ║`)

  // Riverdale total last month
  const rdJuly = rows.filter(r => {
    const d = new Date(r.startDate)
    return r.organizationId === orgRD.id && d.getUTCMonth() === 6
  })
  const rdJulyCost = rdJuly.reduce((s, r) => s + parseFloat(r.tariff), 0).toFixed(2)
  console.log(`║  Riverdale — July 2026 total cost: PKR ${rdJulyCost}          ║`)
  console.log('╚══════════════════════════════════════════════════════════════╝\n')
}

main()
