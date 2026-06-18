/**
 * Device / gateway simulator — pushes live readings to POST /api/ingest
 * the same way real Modbus gateways would (production path when Redis is on).
 *
 * Usage:
 *   npm run simulate:devices
 *   node scripts/deviceSimulator.js --interval 1 --concurrency 50
 *   node scripts/deviceSimulator.js --once --verbose
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const prisma = require('../config/database')
const { READING_RANGES, VARIABLE_UNITS, initValue, nextValue } = require('../utils/readingProfiles')

const DEFAULT_BASE = process.env.SIMULATOR_BASE_URL || 'http://localhost:5000'
const DEFAULT_INTERVAL = Number(process.env.SIMULATOR_INTERVAL_SEC) || 1
const DEFAULT_CONCURRENCY = Number(process.env.SIMULATOR_CONCURRENCY) || 50

const parseArgs = () => {
  const args = process.argv.slice(2)
  const opts = {
    interval: DEFAULT_INTERVAL,
    device: 'all',
    apiKey: process.env.INGEST_API_KEY || '',
    baseUrl: DEFAULT_BASE,
    spike: null,
    once: false,
    verbose: false,
    concurrency: DEFAULT_CONCURRENCY,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--interval' || a === '-i') opts.interval = Number(args[++i]) || DEFAULT_INTERVAL
    else if (a === '--device' || a === '-d') opts.device = args[++i] || 'all'
    else if (a === '--api-key' || a === '-k') opts.apiKey = args[++i] || ''
    else if (a === '--base-url' || a === '-u') opts.baseUrl = (args[++i] || DEFAULT_BASE).replace(/\/$/, '')
    else if (a === '--concurrency' || a === '-c') opts.concurrency = Number(args[++i]) || DEFAULT_CONCURRENCY
    else if (a === '--spike') opts.spike = args[++i] || 'VoltageA'
    else if (a === '--once') opts.once = true
    else if (a === '--verbose' || a === '-v') opts.verbose = true
    else if (a === '--help' || a === '-h') {
      console.log(`
Device simulator — POST /api/ingest on an interval (production: Redis + BullMQ batch)

Options:
  --interval, -i      Seconds between ticks (default: ${DEFAULT_INTERVAL})
  --device, -d        Device UUID or "all" (default: all)
  --concurrency, -c   Parallel ingest requests per tick (default: ${DEFAULT_CONCURRENCY})
  --api-key, -k       x-api-key header (default: INGEST_API_KEY from .env)
  --base-url, -u        API origin (default: ${DEFAULT_BASE})
  --spike             Force variable above range each tick (alarm test)
  --verbose, -v       Log every device (default: summary when fleet > 10)
  --once              Single tick then exit
`)
      process.exit(0)
    }
  }
  return opts
}

const buildSimulatorState = (variables) => {
  const state = {}
  for (const v of variables) {
    const range = READING_RANGES[v.name] || [0, 100]
    const base = v.currentValue != null ? parseFloat(v.currentValue) : initValue(v.name, range)
    state[v.name] = Number.isNaN(base) ? initValue(v.name, range) : base
  }
  return state
}

const tickReadings = (variables, state, spikeVar) => {
  const readings = []
  for (const v of variables) {
    const range = READING_RANGES[v.name] || [0, 100]
    let value = nextValue(v.name, state[v.name] ?? initValue(v.name, range), range)
    if (spikeVar && v.name === spikeVar) value = range[1] + 5
    state[v.name] = value
    readings.push({
      variableName: v.name,
      value,
      unit: v.unit || VARIABLE_UNITS[v.name] || '',
    })
  }
  return readings
}

const postIngest = async (opts, payload) => {
  const res = await fetch(`${opts.baseUrl}/api/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.message || body?.error || res.statusText
    throw new Error(`${res.status}: ${msg}`)
  }
  return body
}

const loadTargets = async (deviceFilter) => {
  const where = deviceFilter === 'all' ? {} : { id: deviceFilter }
  const devices = await prisma.device.findMany({
    where,
    select: {
      id: true,
      name: true,
      gatewayId: true,
      gateway: { select: { name: true, serialNumber: true } },
      configSlaves: {
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          isDefault: true,
          configVariables: {
            where: { isActive: true },
            select: { name: true, unit: true, currentValue: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })
  if (!devices.length) {
    throw new Error(deviceFilter === 'all' ? 'No devices found in database' : `Device not found: ${deviceFilter}`)
  }

  const targets = []
  for (const device of devices) {
    const slave = device.configSlaves.find((s) => s.isDefault) || device.configSlaves[0]
    if (!slave?.configVariables?.length) {
      console.warn(`[skip] ${device.name} — no config variables`)
      continue
    }
    targets.push({
      deviceId: device.id,
      deviceName: device.name,
      gatewayId: device.gatewayId,
      gatewayName: device.gateway?.name ?? '—',
      slaveId: slave.id,
      slaveName: slave.name,
      variables: slave.configVariables,
      state: buildSimulatorState(slave.configVariables),
    })
  }
  return targets
}

async function runPool(items, concurrency, fn) {
  const results = []
  let idx = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

const pushAll = async (opts, targets) => {
  const stats = { ok: 0, queued: 0, sync: 0, fail: 0 }
  const errors = []

  await runPool(targets, opts.concurrency, async (t) => {
    try {
      const readings = tickReadings(t.variables, t.state, opts.spike)
      const body = await postIngest(opts, {
        deviceId: t.deviceId,
        slaveId: t.slaveId,
        readings,
      })
      stats.ok++
      if (body.queued) stats.queued++
      else stats.sync++

      if (opts.verbose) {
        const sample = readings.slice(0, 2).map((r) => `${r.variableName}=${r.value}`).join(', ')
        console.log(
          `[${new Date().toISOString()}] ${t.gatewayName} / ${t.deviceName} → ok` +
          (body.queued ? ' (queued)' : ' (sync)') +
          ` | ${sample}…`
        )
      }
      return { ok: true }
    } catch (e) {
      stats.fail++
      if (errors.length < 5) errors.push(`${t.deviceName}: ${e.message}`)
      if (opts.verbose) console.error(`[error] ${t.deviceName}: ${e.message}`)
      return { ok: false }
    }
  })

  if (!opts.verbose) {
    const mode = stats.queued > stats.sync ? 'batch' : stats.queued > 0 ? 'mixed' : 'sync'
    console.log(
      `[${new Date().toISOString()}] tick: ${stats.ok}/${targets.length} ok, ${stats.fail} fail` +
      ` | queued=${stats.queued} sync=${stats.sync} (${mode})`
    )
  }
  if (errors.length) {
    console.error('  sample errors:', errors.join('; '))
  }
  return stats
}

const checkIngestMode = async (baseUrl) => {
  try {
    const res = await fetch(`${baseUrl}/health`)
    const body = await res.json()
    if (body.ingestMode === 'queued') {
      console.log('Backend ingest mode: queued (BullMQ batch — production path)')
      return body
    }
    console.warn(
      'Backend ingest mode: sync — batch ingest disabled.\n' +
      '  Production path: start Redis, set REDIS_URL=redis://localhost:6379 in .env, restart backend.'
    )
    return body
  } catch {
    console.warn('Could not reach backend /health — is npm run dev running?')
    return null
  }
}

const main = async () => {
  const opts = parseArgs()
  if (!opts.apiKey) {
    console.error('Missing API key. Set INGEST_API_KEY in .env or pass --api-key')
    process.exit(1)
  }

  const targets = await loadTargets(opts.device)
  if (!targets.length) {
    console.error('No simulatable devices. Run: npm run seed && npm run seed:fleet')
    process.exit(1)
  }

  if (targets.length > 10 && !opts.verbose) {
    opts.verbose = false
  } else if (targets.length <= 10) {
    opts.verbose = true
  }

  const gatewayCount = new Set(targets.map((t) => t.gatewayId).filter(Boolean)).size
  console.log(
    `Simulating ${targets.length} device(s) on ${gatewayCount} gateway(s), ` +
    `every ${opts.interval}s, concurrency=${opts.concurrency} → ${opts.baseUrl}/api/ingest`
  )
  if (targets.length <= 15) {
    for (const t of targets) {
      console.log(`  • ${t.gatewayName} / ${t.deviceName} (${t.variables.length} vars)`)
    }
  }
  if (opts.spike) console.log(`  ⚠ spike: ${opts.spike}`)

  await checkIngestMode(opts.baseUrl)

  await pushAll(opts, targets)
  if (opts.once) {
    await prisma.$disconnect()
    return
  }

  const timer = setInterval(() => { pushAll(opts, targets) }, opts.interval * 1000)
  const shutdown = async () => {
    clearInterval(timer)
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(async (err) => {
  console.error(err.message || err)
  await prisma.$disconnect()
  process.exit(1)
})
