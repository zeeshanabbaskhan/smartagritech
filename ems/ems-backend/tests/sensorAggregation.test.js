// ─── sensorAggregation test suite ───────────────────────────────────────────
// Run: node ems/ems-backend/tests/sensorAggregation.test.js
//
// Uses an in-memory mock Prisma client: every `$queryRaw` tagged template is rebuilt with the real
// Prisma.sql builder, its parameters are decoded (device, slave, time window, variable names,
// bucket size, sort direction) and evaluated against fixture rows for the two tables:
//   - sensor_readings        (live telemetry, JSON `readings` array per row)
//   - sensor_reading_values  (legacy, one row per variable)
// No database connection is ever opened.

const path = require('node:path')

// ─── Runner mode: re-run this file through node:test and print a compact summary ─
if (require.main === module && !process.env.NODE_TEST_CONTEXT) {
  const { run } = require('node:test')
  const { spec } = require('node:test/reporters')

  let passed = 0
  let failed = 0
  const failures = []
  const isSuite = (d) => d.details && d.details.type === 'suite'

  const stream = run({ files: [__filename] })
  stream.on('test:pass', (d) => { if (!isSuite(d)) passed++ })
  stream.on('test:fail', (d) => {
    if (isSuite(d)) return
    failed++
    const err = d.details && d.details.error
    failures.push(`${d.name}${err ? ` — ${(err.cause || err).message}` : ''}`)
  })

  const out = stream.compose(new spec())
  out.pipe(process.stdout)
  out.on('end', () => {
    const line = '─'.repeat(60)
    console.log(`\n${line}\n sensorAggregation test summary`)
    console.log(` Total: ${passed + failed}   Passed: ${passed}   Failed: ${failed}`)
    if (failures.length) {
      console.log('\n Failed tests:')
      failures.forEach((f) => console.log(`   ✖ ${f}`))
    }
    console.log(line)
    process.exitCode = failed ? 1 : 0
  })
} else {
  registerTests()
}

function registerTests() {
  const { describe, it, beforeEach } = require('node:test')
  const assert = require('node:assert/strict')
  const { Prisma } = require('@prisma/client')

  // Stub the DB module so requiring sensorAggregation never builds a pg pool, and
  // `readDb(prisma)` falls back to the mock passed into each call.
  const dbModulePath = require.resolve(path.join(__dirname, '..', 'config', 'database'))
  require.cache[dbModulePath] = {
    id: dbModulePath, filename: dbModulePath, loaded: true,
    exports: Object.assign({}, { read: null, pool: null }),
  }

  // The hourly-view probe logs a warning when the Timescale view is absent; keep output clean.
  const origWarn = console.warn
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[sensorAggregation]')) return
    origWarn(...args)
  }

  const agg = require('../utils/sensorAggregation')
  const { bucketVariable, bucketManyCombined, sumVariable, deltaVariable, periodEnergyKwh } = agg

  // ─── Constants ────────────────────────────────────────────────────────────
  const MIN = 60 * 1000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR
  const NOW = new Date('2026-10-21T12:00:00.000Z')
  const d = (s) => new Date(s)
  const addMs = (date, ms) => new Date(date.getTime() + ms)

  const AMBITION_1 = 'b9e024c1-2fbb-4b53-bc2b-f1bab8fc7f12'
  const AMBITION_2 = 'e3612434-3a9e-4769-834d-e9d91631f8f6'
  const AMBITION_3 = '04fa70be-06e8-423b-bc22-fa76178a909f'
  const A1_MAIN = 'a1-slave-main-incomer'
  const A1_GEN = 'a1-slave-generator'
  const A2_MAIN = 'a2-slave-main-incomer'
  const A3_MAIN = 'a3-slave-main-incomer'
  const UNKNOWN_DEVICE = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

  // ─── Mock Prisma client ───────────────────────────────────────────────────

  /**
   * @param {object}   fx
   * @param {Array}    fx.live       [{ deviceId, slaveId, ts, readings: [{ variableName, value }] }]
   * @param {Array}    fx.legacy     [{ deviceId, slaveId, ts, variableName, value }]
   * @param {Array}    fx.configVars [{ deviceId, deviceConfigSlaveId, name, isActive }]
   * @param {boolean}  fx.failLive / fx.failLegacy / fx.failConfig  make that source throw
   */
  function createMockPrisma(fx = {}) {
    const liveSamples = (fx.live || []).flatMap((r) =>
      r.readings.map((e) => ({
        deviceId: r.deviceId, slaveId: r.slaveId ?? null, ts: new Date(r.ts),
        variableName: e.variableName, value: Number(e.value),
      })))
    const legacySamples = (fx.legacy || []).map((r) => ({
      deviceId: r.deviceId, slaveId: r.slaveId ?? null, ts: new Date(r.ts),
      variableName: r.variableName, value: Number(r.value),
    }))
    const log = []

    const parse = (sql) => {
      const text = sql.text.replace(/\s+/g, ' ')
      const param = (re) => {
        const m = text.match(re)
        return m ? sql.values[Number(m[1]) - 1] : undefined
      }
      const inList = text.match(/IN \(([^)]*)\)/)
      const q = {
        text,
        table: text.includes('pg_catalog') ? 'catalog'
          : text.includes('sensor_readings_hourly') ? 'hourly'
          : text.includes('"sensor_readings" sr') ? 'live'
          : text.includes('sensor_reading_values v') ? 'legacy'
          : 'unknown',
        kind: text.includes('var_name') ? 'combined'
          : text.includes('bucket_ms') ? 'bucket'
          : text.includes('LIMIT 1') ? 'endpoint'
          : text.includes('SUM(') ? 'sum'
          : 'unknown',
        deviceId: param(/"deviceId" = \$(\d+)/),
        slaveId: param(/"deviceConfigSlaveId" = \$(\d+)/),
        start: param(/timestamp"? >= \$(\d+)/),
        endInclusive: param(/timestamp"? <= \$(\d+)/),
        endExclusive: param(/timestamp"? < \$(\d+)/),
        bucketMs: Number(param(/\/ \$(\d+)\)/)),
        names: inList ? [...inList[1].matchAll(/\$(\d+)/g)].map((m) => sql.values[Number(m[1]) - 1]) : [],
        dir: (text.match(/ORDER BY \S+ (ASC|DESC)/) || [])[1],
      }
      return q
    }

    const select = (samples, q) => samples.filter((s) =>
      (q.deviceId === undefined || s.deviceId === q.deviceId) &&
      (q.slaveId === undefined || s.slaveId === q.slaveId) &&
      (q.start === undefined || s.ts >= q.start) &&
      (q.endInclusive === undefined || s.ts <= q.endInclusive) &&
      (q.endExclusive === undefined || s.ts < q.endExclusive) &&
      q.names.includes(s.variableName) &&
      s.value > -10000000 && s.value < 10000000)

    const groupAvg = (samples, keyFn) => {
      const groups = new Map()
      for (const s of samples) {
        const k = keyFn(s)
        if (!groups.has(k.key)) groups.set(k.key, { ...k, sum: 0, n: 0 })
        const g = groups.get(k.key)
        g.sum += s.value
        g.n++
      }
      return [...groups.values()].sort((a, b) => a.bucket - b.bucket)
    }

    const bucketOf = (s, ms) => Math.floor(s.ts.getTime() / ms) * ms

    const execute = (q) => {
      if (q.table === 'catalog') return fx.hourlyView ? [{ ok: 1 }] : []
      if (q.table === 'hourly') throw new Error('sensor_readings_hourly not mocked')
      if (q.table === 'live' && fx.failLive) throw new Error('mock: sensor_readings unavailable')
      if (q.table === 'legacy' && fx.failLegacy) throw new Error('mock: sensor_reading_values unavailable')
      const rows = select(q.table === 'live' ? liveSamples : legacySamples, q)

      switch (q.kind) {
        case 'bucket':
          return groupAvg(rows, (s) => ({ key: bucketOf(s, q.bucketMs), bucket: bucketOf(s, q.bucketMs) }))
            .map((g) => ({ bucket_ms: BigInt(g.bucket), avg_val: g.sum / g.n }))
        case 'combined':
          return groupAvg(rows, (s) => ({
            key: `${s.variableName}|${bucketOf(s, q.bucketMs)}`, bucket: bucketOf(s, q.bucketMs), name: s.variableName,
          })).map((g) => ({ var_name: g.name, bucket_ms: BigInt(g.bucket), avg_val: g.sum / g.n }))
        case 'endpoint': {
          const sorted = [...rows].sort((a, b) => (q.dir === 'DESC' ? b.ts - a.ts : a.ts - b.ts))
          return sorted.length ? [{ val: sorted[0].value, ts: sorted[0].ts }] : []
        }
        case 'sum': {
          const total = rows.reduce((acc, s) => acc + s.value, 0)
          if (q.table === 'legacy') return [{ total }]
          const minTs = rows.length ? new Date(Math.min(...rows.map((s) => s.ts.getTime()))) : null
          return [{ total, min_ts: minTs }]
        }
        default:
          throw new Error(`mock: unrecognised query: ${q.text}`)
      }
    }

    return {
      log,
      resetLog() { log.length = 0 },
      queries(filter = {}) {
        return log.filter((q) => Object.entries(filter).every(([k, v]) => q[k] === v))
      },
      $queryRaw(strings, ...values) {
        const q = parse(Prisma.sql(strings, ...values))
        log.push(q)
        try {
          return Promise.resolve(execute(q))
        } catch (err) {
          return Promise.reject(err)
        }
      },
      deviceConfigVariable: {
        async findMany({ where }) {
          if (fx.failConfig) throw new Error('mock: deviceConfigVariable unavailable')
          const slaveMatch = (v) => {
            const w = where.deviceConfigSlaveId
            if (w === undefined) return true
            if (w && Array.isArray(w.in)) return w.in.includes(v.deviceConfigSlaveId)
            return v.deviceConfigSlaveId === w
          }
          return (fx.configVars || [])
            .filter((v) =>
              (where.deviceId === undefined || v.deviceId === where.deviceId) &&
              (where.isActive === undefined || (v.isActive ?? true) === where.isActive) &&
              slaveMatch(v) &&
              (!where.name || where.name.in.includes(v.name)))
            .map((v) => ({ name: v.name, deviceConfigSlaveId: v.deviceConfigSlaveId }))
        },
      },
    }
  }

  // ─── Assertion helpers ────────────────────────────────────────────────────
  const ts = (pts) => pts.map((p) => p.timestamp.toISOString())
  const days = (pts) => pts.map((p) => p.timestamp.toISOString().slice(0, 10))
  const vals = (pts) => pts.map((p) => p.value)

  const assertStrictlyAscending = (pts) => {
    for (let i = 1; i < pts.length; i++) {
      assert.ok(pts[i].timestamp > pts[i - 1].timestamp,
        `bucket ${i} (${pts[i].timestamp.toISOString()}) is not after ${pts[i - 1].timestamp.toISOString()}`)
    }
  }
  const assertUniqueBuckets = (pts) => {
    assert.equal(new Set(pts.map((p) => p.timestamp.getTime())).size, pts.length, 'duplicate bucket timestamps')
  }
  const assertNoUnknownQueries = (db) => {
    assert.deepEqual(db.log.filter((q) => q.table === 'unknown' || q.kind === 'unknown').map((q) => q.text), [])
  }
  const isoDaysBetween = (from, to) => {
    const out = []
    for (let t = d(from).getTime(); t <= d(to).getTime(); t += DAY) out.push(new Date(t).toISOString().slice(0, 10))
    return out
  }

  // ─── 1. 24-hour range: live telemetry only ────────────────────────────────
  describe('1. 24-hour range (live sensor_readings only)', () => {
    const start = d('2026-10-20T12:00:00.000Z')
    const end = NOW
    const live = []
    for (let h = 0; h < 24; h++) {
      const t = addMs(start, h * HOUR)
      live.push({ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: t,
        readings: [{ variableName: 'Total Power', value: 10 + h }, { variableName: 'Units', value: 1000 + h * 10 }] })
      live.push({ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: addMs(t, 30 * MIN),
        readings: [{ variableName: 'Total Power', value: 12 + h }, { variableName: 'Units', value: 1005 + h * 10 }] })
    }
    let db
    beforeEach(() => { db = createMockPrisma({ live }) })
    const base = { deviceId: AMBITION_1, slaveId: A1_MAIN, startDate: start, endDate: end }
    const expectedHours = Array.from({ length: 24 }, (_, h) => addMs(start, h * HOUR).toISOString())

    it('bucketManyCombined returns 24 hourly averaged buckets per metric', async () => {
      const res = await bucketManyCombined(db, { ...base, bucketMs: HOUR, metricNames: ['ActivePower', 'PowerConsumption'] })
      assert.deepEqual(ts(res.ActivePower), expectedHours)
      assert.deepEqual(vals(res.ActivePower), Array.from({ length: 24 }, (_, h) => 11 + h))
      assert.deepEqual(ts(res.PowerConsumption), expectedHours)
      assert.deepEqual(vals(res.PowerConsumption), Array.from({ length: 24 }, (_, h) => 1002.5 + h * 10))
      assert.equal(db.queries({ table: 'legacy' }).length, 1, 'legacy table is still consulted')
      assertNoUnknownQueries(db)
    })

    it('bucketVariable returns the same hourly series via alias resolution', async () => {
      const pts = await bucketVariable(db, { ...base, variableName: 'ActivePower', bucketMs: HOUR })
      assert.deepEqual(ts(pts), expectedHours)
      assert.deepEqual(vals(pts), Array.from({ length: 24 }, (_, h) => 11 + h))
      assertStrictlyAscending(pts)
      assertNoUnknownQueries(db)
    })

    it('periodEnergyKwh returns cumulative meter delta (last − first)', async () => {
      // first Units = 1000 @ start, last Units = 1235 @ start+23h30m
      assert.equal(await periodEnergyKwh(db, base), 235)
    })

    it('sumVariable sums every live sample in the window', async () => {
      // Σ (10+h) + (12+h) for h = 0..23 = 1080
      assert.equal(await sumVariable(db, { ...base, variableName: 'ActivePower' }), 1080)
      const legacySum = db.queries({ table: 'legacy', kind: 'sum' })[0]
      assert.equal(legacySum.endExclusive.toISOString(), start.toISOString(), 'legacy bounded by first live sample')
    })
  })

  // ─── 2. 7-day range: daily buckets over live telemetry ────────────────────
  describe('2. 7-day range (1-day buckets, live telemetry)', () => {
    const start = d('2026-10-15T00:00:00.000Z')
    const live = []
    for (let i = 0; i < 7; i++) {
      const dayStart = addMs(start, i * DAY)
      live.push({ deviceId: AMBITION_2, slaveId: A2_MAIN, ts: addMs(dayStart, 2 * HOUR),
        readings: [{ variableName: 'ActivePower', value: 100 + i * 10 }] })
      live.push({ deviceId: AMBITION_2, slaveId: A2_MAIN, ts: addMs(dayStart, 10 * HOUR),
        readings: [{ variableName: 'ActivePower', value: 110 + i * 10 }] })
    }
    const base = { deviceId: AMBITION_2, slaveId: A2_MAIN, startDate: start, endDate: NOW, bucketMs: DAY }
    const expectedDays = isoDaysBetween('2026-10-15', '2026-10-21')
    const expectedVals = Array.from({ length: 7 }, (_, i) => 105 + i * 10)

    it('bucketVariable returns 7 contiguous UTC-midnight buckets', async () => {
      const db = createMockPrisma({ live })
      const pts = await bucketVariable(db, { ...base, variableName: 'ActivePower' })
      assert.deepEqual(days(pts), expectedDays)
      assert.deepEqual(vals(pts), expectedVals)
      pts.forEach((p) => assert.equal(p.timestamp.getTime() % DAY, 0, 'bucket aligned to midnight UTC'))
      for (let i = 1; i < pts.length; i++) assert.equal(pts[i].timestamp - pts[i - 1].timestamp, DAY)
    })

    it('bucketManyCombined matches bucketVariable for daily buckets', async () => {
      const db = createMockPrisma({ live })
      const res = await bucketManyCombined(db, { ...base, metricNames: ['ActivePower'] })
      assert.deepEqual(days(res.ActivePower), expectedDays)
      assert.deepEqual(vals(res.ActivePower), expectedVals)
    })

    it('samples after endDate are excluded from the last bucket', async () => {
      const db = createMockPrisma({ live })
      const pts = await bucketVariable(db, { ...base, endDate: d('2026-10-21T05:00:00.000Z'), variableName: 'ActivePower' })
      assert.equal(pts.length, 7)
      assert.equal(pts[6].value, 160, 'only the 02:00 sample (160) falls before endDate on Oct 21')
    })
  })

  // ─── 3. 30-day range: legacy (Sep 28–29) + live (Oct 1–21) ────────────────
  describe('3. 30-day range (mixed legacy + live telemetry)', () => {
    const start = d('2026-09-21T00:00:00.000Z')
    const legacy = [
      { ts: '2026-09-28T06:00:00Z', value: 40 }, { ts: '2026-09-28T18:00:00Z', value: 60 },
      { ts: '2026-09-29T06:00:00Z', value: 70 }, { ts: '2026-09-29T18:00:00Z', value: 90 },
    ].map((r) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, variableName: 'ActivePower', ...r }))
    const live = []
    for (let day = 1; day <= 21; day++) {
      live.push({ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: `2026-10-${String(day).padStart(2, '0')}T06:00:00Z`,
        readings: [{ variableName: 'Total Power', value: 200 + day }] })
    }
    const base = { deviceId: AMBITION_1, slaveId: A1_MAIN, startDate: start, endDate: NOW, bucketMs: DAY }
    const expectedDays = ['2026-09-28', '2026-09-29', ...isoDaysBetween('2026-10-01', '2026-10-21')]
    const expectedVals = [50, 80, ...Array.from({ length: 21 }, (_, i) => 201 + i)]

    const assertSpanning = (pts) => {
      assert.deepEqual(days(pts), expectedDays)
      assert.deepEqual(vals(pts), expectedVals)
      assertStrictlyAscending(pts)
      assertUniqueBuckets(pts)
      // Every day that has data in either table is present; October is gap-free.
      const oct = pts.filter((p) => p.timestamp >= d('2026-10-01'))
      for (let i = 1; i < oct.length; i++) assert.equal(oct[i].timestamp - oct[i - 1].timestamp, DAY)
      // Sept 30 has no data in either table and is not zero-filled.
      assert.ok(!days(pts).includes('2026-09-30'))
    }

    it('bucketVariable stitches legacy days before live days in order', async () => {
      const db = createMockPrisma({ live, legacy })
      assertSpanning(await bucketVariable(db, { ...base, variableName: 'ActivePower' }))
      assertNoUnknownQueries(db)
    })

    it('bucketManyCombined stitches legacy days before live days in order', async () => {
      const db = createMockPrisma({ live, legacy })
      const res = await bucketManyCombined(db, { ...base, metricNames: ['ActivePower'] })
      assertSpanning(res.ActivePower)
    })

    it('multi-slave bucketVariable stitches per slave', async () => {
      const db = createMockPrisma({ live, legacy })
      const pts = await bucketVariable(db, { ...base, slaveId: undefined, slaveIds: [A1_MAIN], variableName: 'ActivePower' })
      assert.ok(pts.every((p) => p.slaveId === A1_MAIN))
      assertSpanning(pts)
    })
  })

  // ─── 4. Overlapping records: live wins, no duplicates ─────────────────────
  describe('4. Overlapping bucket in both tables', () => {
    const legacy = [
      { ts: '2026-09-29T12:00:00Z', value: 80 },
      { ts: '2026-10-01T06:00:00Z', value: 999 },
      { ts: '2026-10-01T18:00:00Z', value: 999 },
    ].map((r) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, variableName: 'ActivePower', ...r }))
    const live = [
      { ts: '2026-10-01T09:00:00Z', value: 50 },
      { ts: '2026-10-02T09:00:00Z', value: 60 },
    ].map((r) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: r.ts, readings: [{ variableName: 'ActivePower', value: r.value }] }))
    const base = { deviceId: AMBITION_1, slaveId: A1_MAIN, startDate: d('2026-09-28T00:00:00Z'), endDate: d('2026-10-03T00:00:00Z'), bucketMs: DAY }

    const assertLiveWins = (pts) => {
      assert.deepEqual(days(pts), ['2026-09-29', '2026-10-01', '2026-10-02'])
      assert.deepEqual(vals(pts), [80, 50, 60], 'Oct 1 must be the live value, not 999 / a blend / a sum')
      assertUniqueBuckets(pts)
    }

    it('bucketVariable keeps the live value for a shared bucket', async () => {
      assertLiveWins(await bucketVariable(createMockPrisma({ live, legacy }), { ...base, variableName: 'ActivePower' }))
    })

    it('bucketManyCombined keeps the live value for a shared bucket', async () => {
      const res = await bucketManyCombined(createMockPrisma({ live, legacy }), { ...base, metricNames: ['ActivePower'] })
      assertLiveWins(res.ActivePower)
    })

    it('multi-slave bucketVariable keeps the live value for a shared bucket', async () => {
      const pts = await bucketVariable(createMockPrisma({ live, legacy }),
        { ...base, slaveId: undefined, slaveIds: [A1_MAIN], variableName: 'ActivePower' })
      assertLiveWins(pts)
    })

    it('identical timestamps in both tables collapse to one live bucket', async () => {
      const sameTs = '2026-10-01T09:00:00Z'
      const db = createMockPrisma({
        live: [{ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: sameTs, readings: [{ variableName: 'ActivePower', value: 42 }] }],
        legacy: [{ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: sameTs, variableName: 'ActivePower', value: 7 }],
      })
      const pts = await bucketVariable(db, { ...base, bucketMs: HOUR, variableName: 'ActivePower' })
      assert.deepEqual(ts(pts), ['2026-10-01T09:00:00.000Z'])
      assert.deepEqual(vals(pts), [42])
    })

    it('sumVariable does not double count legacy rows overlapping live coverage', async () => {
      // live: 50 + 60; legacy only before first live sample (Oct 1 09:00): 80 + 999 (06:00) — 18:00 excluded
      const total = await sumVariable(createMockPrisma({ live, legacy }), { ...base, variableName: 'ActivePower' })
      assert.equal(total, 50 + 60 + 80 + 999)
    })
  })

  // ─── 5. Empty results ─────────────────────────────────────────────────────
  describe('5. Empty results', () => {
    const populated = {
      live: [{ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: '2026-10-10T00:00:00Z',
        readings: [{ variableName: 'ActivePower', value: 5 }, { variableName: 'Units', value: 100 }] }],
      legacy: [{ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: '2026-09-28T00:00:00Z', variableName: 'ActivePower', value: 5 }],
    }
    const scenarios = [
      ['unknown device', createMockPrisma(populated), { deviceId: UNKNOWN_DEVICE, startDate: d('2026-09-01'), endDate: NOW }],
      ['range with no data', createMockPrisma(populated), { deviceId: AMBITION_1, slaveId: A1_MAIN, startDate: d('2026-08-01'), endDate: d('2026-08-31') }],
      ['both tables empty', createMockPrisma({}), { deviceId: AMBITION_1, startDate: d('2026-09-01'), endDate: NOW }],
      ['both tables throwing', createMockPrisma({ ...populated, failLive: true, failLegacy: true, failConfig: true }),
        { deviceId: AMBITION_1, slaveId: A1_MAIN, startDate: d('2026-09-01'), endDate: NOW }],
    ]

    for (const [label, db, opts] of scenarios) {
      it(`${label}: every function returns [] / 0 without throwing`, async () => {
        const many = await bucketManyCombined(db, { ...opts, bucketMs: DAY, metricNames: ['ActivePower', 'PowerConsumption'] })
        assert.deepEqual(many, { ActivePower: [], PowerConsumption: [] })
        assert.deepEqual(await bucketVariable(db, { ...opts, bucketMs: DAY, variableName: 'ActivePower' }), [])
        assert.deepEqual(await bucketVariable(db, { ...opts, slaveIds: [A1_MAIN], bucketMs: DAY, variableName: 'ActivePower' }), [])
        assert.equal(await sumVariable(db, { ...opts, variableName: 'ActivePower' }), 0)
        assert.equal(await deltaVariable(db, { ...opts, variableName: 'Units' }), 0)
        assert.equal(await periodEnergyKwh(db, opts), 0)
      })
    }
  })

  // ─── 6. Energy calculations ───────────────────────────────────────────────
  describe('6. Energy calculations', () => {
    const meter = {
      legacy: [
        { ts: '2026-09-28T00:00:00Z', value: 1000 },
        { ts: '2026-09-29T12:00:00Z', value: 1050 },
      ].map((r) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, variableName: 'Units', ...r })),
      live: [
        { ts: '2026-10-01T00:00:00Z', value: 1100 },
        { ts: '2026-10-10T00:00:00Z', value: 1300 },
        { ts: '2026-10-21T06:00:00Z', value: 1500 },
      ].map((r) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: r.ts, readings: [{ variableName: 'Units', value: r.value }] })),
    }
    const base = { deviceId: AMBITION_1, slaveId: A1_MAIN, startDate: d('2026-09-21T00:00:00Z'), endDate: NOW }

    describe('deltaVariable', () => {
      it('earliest from legacy, latest from live → latest − earliest', async () => {
        const db = createMockPrisma(meter)
        assert.equal(await deltaVariable(db, { ...base, variableName: 'Units' }), 1500 - 1000)
        const endpoints = db.queries({ kind: 'endpoint' })
        assert.equal(endpoints.filter((q) => q.table === 'live').length, 2)
        assert.equal(endpoints.filter((q) => q.table === 'legacy').length, 2)
      })

      it('resolves aliases (Energy → Units)', async () => {
        assert.equal(await deltaVariable(createMockPrisma(meter), { ...base, variableName: 'Energy' }), 500)
      })

      it('window entirely inside live data', async () => {
        const v = await deltaVariable(createMockPrisma(meter), { ...base, startDate: d('2026-10-05T00:00:00Z'), variableName: 'Units' })
        assert.equal(v, 1500 - 1300)
      })

      it('endDate is exclusive', async () => {
        const v = await deltaVariable(createMockPrisma(meter), { ...base, endDate: d('2026-10-21T06:00:00Z'), variableName: 'Units' })
        assert.equal(v, 1300 - 1000)
      })

      it('meter rollback (latest < earliest) returns 0', async () => {
        const db = createMockPrisma({
          legacy: meter.legacy,
          live: [{ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: '2026-10-02T00:00:00Z', readings: [{ variableName: 'Units', value: 3 }] }],
        })
        assert.equal(await deltaVariable(db, { ...base, variableName: 'Units' }), 0)
      })
    })

    describe('periodEnergyKwh', () => {
      it('uses the cumulative meter delta across both tables', async () => {
        assert.equal(await periodEnergyKwh(createMockPrisma(meter), base), 500)
      })

      it('falls back to PowerConsumption sum when no meter increases', async () => {
        const db = createMockPrisma({
          live: [3, 5, 2].map((v, i) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: addMs(d('2026-10-20T00:00:00Z'), i * HOUR),
            readings: [{ variableName: 'PowerConsumption', value: v }] })),
        })
        assert.equal(await periodEnergyKwh(db, base), 10)
      })

      it('falls back to ActivePower sum / 1000 when no energy variables exist', async () => {
        const db = createMockPrisma({
          live: [1000, 2000, 3000].map((v, i) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: addMs(d('2026-10-20T00:00:00Z'), i * HOUR),
            readings: [{ variableName: 'Total Power', value: v }] })),
        })
        assert.equal(await periodEnergyKwh(db, base), 6)
      })
    })

    describe('sumVariable', () => {
      const legacy = [
        { ts: '2026-09-28T00:00:00Z', value: 10 },
        { ts: '2026-09-29T00:00:00Z', value: 20 },
        { ts: '2026-10-01T03:00:00Z', value: 999 }, // overlaps live coverage → ignored
        { ts: '2026-10-02T00:00:00Z', value: 999 }, // same timestamp as a live sample → ignored
      ].map((r) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, variableName: 'ActivePower', ...r }))
      const live = [
        { ts: '2026-10-01T00:00:00Z', value: 1 },
        { ts: '2026-10-02T00:00:00Z', value: 2 },
        { ts: '2026-10-03T00:00:00Z', value: 3 },
      ].map((r) => ({ deviceId: AMBITION_1, slaveId: A1_MAIN, ts: r.ts, readings: [{ variableName: 'ActivePower', value: r.value }] }))

      it('live sum + legacy sum up to the first live timestamp', async () => {
        const db = createMockPrisma({ live, legacy })
        assert.equal(await sumVariable(db, { ...base, variableName: 'ActivePower' }), 1 + 2 + 3 + 10 + 20)
        const [legacyQuery] = db.queries({ table: 'legacy', kind: 'sum' })
        assert.equal(legacyQuery.endExclusive.toISOString(), '2026-10-01T00:00:00.000Z')
      })

      it('legacy-only window is bounded by endDate', async () => {
        const db = createMockPrisma({ legacy })
        const total = await sumVariable(db, { ...base, endDate: d('2026-10-01T00:00:00Z'), variableName: 'ActivePower' })
        assert.equal(total, 30)
        assert.equal(db.queries({ table: 'legacy', kind: 'sum' })[0].endExclusive.toISOString(), '2026-10-01T00:00:00.000Z')
      })

      it('live-only window ignores legacy entirely', async () => {
        const total = await sumVariable(createMockPrisma({ live, legacy }),
          { ...base, startDate: d('2026-10-01T00:00:00Z'), variableName: 'ActivePower' })
        assert.equal(total, 6)
      })
    })
  })

  // ─── 7. Ambition 1 / 2 / 3 device + slave isolation ───────────────────────
  describe('7. Ambition 1, 2, 3 device and slave isolation', () => {
    const start = d('2026-10-20T22:00:00.000Z')
    const end = d('2026-10-21T03:00:00.000Z')
    // Value bands identify the source: A1 main 100s, A1 gen 150s, A2 200s, A3 300s.
    const sources = [
      { deviceId: AMBITION_1, slaveId: A1_MAIN, powerName: 'Total Power', power: 100, legacyPower: 120, units: 1000, unitsStep: 10 },
      { deviceId: AMBITION_1, slaveId: A1_GEN, powerName: 'ActivePower', power: 150, legacyPower: 170, units: 5000, unitsStep: 15 },
      { deviceId: AMBITION_2, slaveId: A2_MAIN, powerName: 'Total Power', power: 200, legacyPower: 250, units: 2000, unitsStep: 20 },
      { deviceId: AMBITION_3, slaveId: A3_MAIN, powerName: 'Total Power', power: 300, legacyPower: 350, units: 3000, unitsStep: 30 },
    ]
    const live = sources.flatMap((s) => [0, 1, 2].map((h) => ({
      deviceId: s.deviceId, slaveId: s.slaveId, ts: addMs(d('2026-10-21T00:10:00Z'), h * HOUR),
      readings: [{ variableName: s.powerName, value: s.power + h }, { variableName: 'Units', value: s.units + h * s.unitsStep }],
    })))
    const legacy = sources.map((s) => ({
      deviceId: s.deviceId, slaveId: s.slaveId, ts: '2026-10-20T22:30:00Z', variableName: s.powerName, value: s.legacyPower,
    }))
    const configVars = sources.map((s) => ({ deviceId: s.deviceId, deviceConfigSlaveId: s.slaveId, name: s.powerName, isActive: true }))
    const expectedTs = ['2026-10-20T22:00:00.000Z', '2026-10-21T00:00:00.000Z', '2026-10-21T01:00:00.000Z', '2026-10-21T02:00:00.000Z']

    let db
    beforeEach(() => { db = createMockPrisma({ live, legacy, configVars }) })

    const assertScoped = (deviceId, slaveId) => {
      const data = db.log.filter((q) => q.table === 'live' || q.table === 'legacy')
      assert.ok(data.length > 0)
      for (const q of data) {
        assert.equal(q.deviceId, deviceId, `query leaked outside device: ${q.text}`)
        if (slaveId !== undefined) assert.equal(q.slaveId, slaveId, `query leaked outside slave: ${q.text}`)
      }
    }

    for (const [label, s] of [['Ambition 1', sources[0]], ['Ambition 2', sources[2]], ['Ambition 3', sources[3]]]) {
      describe(`${label} (${s.deviceId})`, () => {
        const opts = { deviceId: s.deviceId, slaveId: s.slaveId, startDate: start, endDate: end }

        it('bucketVariable returns only this device/slave', async () => {
          const pts = await bucketVariable(db, { ...opts, bucketMs: HOUR, variableName: 'ActivePower' })
          assert.deepEqual(ts(pts), expectedTs)
          assert.deepEqual(vals(pts), [s.legacyPower, s.power, s.power + 1, s.power + 2])
          assertScoped(s.deviceId, s.slaveId)
          // configured variable narrows the candidate list to the slave's actual name
          db.queries({ table: 'live', kind: 'bucket' }).forEach((q) => assert.deepEqual(q.names, [s.powerName]))
        })

        it('bucketManyCombined returns only this device/slave', async () => {
          const res = await bucketManyCombined(db, { ...opts, bucketMs: HOUR, metricNames: ['ActivePower', 'PowerConsumption'] })
          assert.deepEqual(vals(res.ActivePower), [s.legacyPower, s.power, s.power + 1, s.power + 2])
          assert.deepEqual(vals(res.PowerConsumption), [0, 1, 2].map((h) => s.units + h * s.unitsStep))
          assertScoped(s.deviceId, s.slaveId)
        })

        it('sumVariable and deltaVariable are isolated', async () => {
          const sum = await sumVariable(db, { ...opts, variableName: 'ActivePower' })
          assert.equal(sum, s.legacyPower + 3 * s.power + 3)
          assert.equal(await deltaVariable(db, { ...opts, variableName: 'Units' }), 2 * s.unitsStep)
          assertScoped(s.deviceId, s.slaveId)
        })
      })
    }

    it('Ambition 1 without slave filter averages both of its slaves only', async () => {
      const pts = await bucketVariable(db, { deviceId: AMBITION_1, startDate: start, endDate: end, bucketMs: HOUR, variableName: 'ActivePower' })
      assert.deepEqual(vals(pts), [(120 + 170) / 2, 125, 126, 127])
      assertScoped(AMBITION_1, undefined)
    })

    it('Ambition 1 multi-slave query tags and separates each slave', async () => {
      const pts = await bucketVariable(db, {
        deviceId: AMBITION_1, slaveIds: [A1_MAIN, A1_GEN], startDate: start, endDate: end, bucketMs: HOUR, variableName: 'ActivePower',
      })
      const bySlave = (id) => pts.filter((p) => p.slaveId === id)
      assert.deepEqual(vals(bySlave(A1_MAIN)), [120, 100, 101, 102])
      assert.deepEqual(vals(bySlave(A1_GEN)), [170, 150, 151, 152])
      assert.equal(pts.length, 8)
      for (const q of db.log.filter((x) => x.table === 'live' || x.table === 'legacy')) {
        assert.equal(q.deviceId, AMBITION_1)
        assert.deepEqual(q.names, [q.slaveId === A1_MAIN ? 'Total Power' : 'ActivePower'])
      }
    })

    it('a slave from another device yields nothing (Ambition 2 slave on Ambition 1)', async () => {
      const opts = { deviceId: AMBITION_1, slaveId: A2_MAIN, startDate: start, endDate: end }
      assert.deepEqual(await bucketVariable(db, { ...opts, bucketMs: HOUR, variableName: 'ActivePower' }), [])
      assert.equal(await sumVariable(db, { ...opts, variableName: 'ActivePower' }), 0)
      assert.equal(await deltaVariable(db, { ...opts, variableName: 'Units' }), 0)
    })

    it('devices do not affect each other’s totals', async () => {
      const totals = {}
      for (const s of [sources[0], sources[2], sources[3]]) {
        totals[s.deviceId] = await sumVariable(db, { deviceId: s.deviceId, slaveId: s.slaveId, startDate: start, endDate: end, variableName: 'ActivePower' })
      }
      assert.deepEqual(totals, { [AMBITION_1]: 423, [AMBITION_2]: 853, [AMBITION_3]: 1253 })
    })
  })
}
