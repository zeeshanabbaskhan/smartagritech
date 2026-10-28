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

const bucketVariableHourly = async (db, { deviceId, variableName, startDate, endDate, bucketMs }) => {
  const rows = await db.$queryRaw`
    SELECT
      (floor(extract(epoch from bucket) * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
      AVG(avg_value)::double precision AS avg_val
    FROM sensor_readings_hourly
    WHERE "deviceId" = ${deviceId}
      AND variable_name = ${variableName}
      AND bucket >= ${startDate}
      ${endDate ? Prisma.sql`AND bucket <= ${endDate}` : Prisma.empty}
    GROUP BY bucket_ms
    ORDER BY bucket_ms ASC
  `
  return rows.map((r) => ({
    timestamp: new Date(Number(r.bucket_ms)),
    value:     parseFloat(Number(r.avg_val).toFixed(4)),
  }))
}

const VARIABLE_ALIASES = {
  voltagea: ['voltagea', 'voltage_a', 'voltage', 'v_a', 'v1', 'phaseavoltage'],
  voltageb: ['voltageb', 'voltage_b', 'v_b', 'v2', 'phasebvoltage'],
  voltagec: ['voltagec', 'voltage_c', 'v_c', 'v3', 'phasecvoltage'],
  phasevoltagea: ['phasevoltagea', 'phase voltagea', 'phase voltage a', 'vab', 'v12', 'linevoltagea', 'line voltage a'],
  phasevoltageb: ['phasevoltageb', 'phase voltageb', 'phase voltage b', 'vbc', 'v23', 'linevoltageb', 'line voltage b'],
  phasevoltagec: ['phasevoltagec', 'phase voltagec', 'phase voltage c', 'vca', 'v31', 'linevoltagec', 'line voltage c'],
  voltageimbalance: ['voltageimbalance', 'voltage_imbalance', 'v_imbalance', 'vimbalance'],
  currenta: ['currenta', 'current a', 'phasecurrenta', 'phaseacurrent', 'current_a', 'i_a', 'i1', 'current1'],
  currentb: ['currentb', 'current b', 'phasecurrentb', 'phasebcurrent', 'current_b', 'i_b', 'i2', 'current2'],
  currentc: ['currentc', 'current c', 'phasecurrentc', 'phaseccurrent', 'current_c', 'i_c', 'i3', 'current3'],
  currentimbalance: ['currentimbalance', 'current_imbalance', 'i_imbalance', 'iimbalance'],
  powerfactor: ['powerfactor', 'power factor', 'pf', 'totalpowerfactor', 'averagepowerfactor'],
  activepower: ['activepower', ' activepower', 'active power', 'totalpower', 'total active power', 'power', 'totalkw', 'kw'],
  powerconsumption: ['powerconsumption', 'energy', 'units', 'kwh', 'totalenergy', 'importenergy', 'activeenergy'],
  frequency: ['frequency', 'freq', 'hz'],
  thd_v: ['thd_v', 'thdv', 'thd-v', 'thd v', 'thd_voltage'],
  thd_i: ['thd_i', 'thdi', 'thd-i', 'thd i', 'thd_current'],
  energy: ['energy', 'units', 'kwh', 'powerconsumption', 'totalenergy', 'importenergy', 'activeenergy'],
}

const getVariableAliases = (name) => {
  const norm = String(name || '').toLowerCase().replace(/[\s_-]+/g, '')
  const known = VARIABLE_ALIASES[norm]
  if (known) return Array.from(new Set(known.map((a) => a.toLowerCase().replace(/[\s_-]+/g, ''))))
  return [norm]
}

const RAW_VARIABLE_CANDIDATES = {
  activepower: [
    'Total Power', 'Total Active Power', 'Active Power', 'ActivePower',
    'TotalPower', 'TotalActivePower', 'ActivePowerTotal', 'Power',
    'Total kW', 'kW', 'Total Active Power (kW)', 'Total Active Power(kW)', 'Active Power Total',
  ],
  exportpower: ['ExportPower', 'SolarPower', 'Export', 'Solar', 'ExportActivePower', 'Solar Power'],
  powerconsumption: ['Units', 'PowerConsumption', 'EnergyConsumption', 'ActiveEnergy', 'kWh', 'TotalEnergy', 'Energy', 'ImportEnergy', 'Active Energy', 'Total Energy'],
  currenta: ['Current A', 'CurrentA', 'PhaseCurrentA', 'Phase Current A', 'Ia', 'Current 1', 'Phase CurrentA'],
  currentb: ['Current B', 'CurrentB', 'PhaseCurrentB', 'Phase Current B', 'Ib', 'Current 2', 'Phase CurrentB'],
  currentc: ['Current C', 'CurrentC', 'PhaseCurrentC', 'Phase Current C', 'Ic', 'Current 3', 'Phase CurrentC'],
  voltagea: ['Voltage', 'VoltageA', 'Voltage A', 'Va', 'V1', 'Voltage R'],
  voltageb: ['VoltageB', 'Voltage B', 'Vb', 'V2', 'Voltage Y'],
  voltagec: ['VoltageC', 'Voltage C', 'Vc', 'V3', 'Voltage B_Phase'],
  phasevoltagea: ['Phase VoltageA', 'Phase Voltage A', 'PhaseVoltageA', 'Line Voltage A', 'Line Voltage AB', 'Line Voltage', 'Vab', 'V12'],
  phasevoltageb: ['Phase VoltageB', 'Phase Voltage B', 'PhaseVoltageB', 'Line Voltage B', 'Line Voltage BC', 'Vbc', 'V23'],
  phasevoltagec: ['Phase VoltageC', 'Phase Voltage C', 'PhaseVoltageC', 'Line Voltage C', 'Line Voltage CA', 'Vca', 'V31'],
  voltageimbalance: ['VoltageImbalance', 'Voltage Imbalance', 'V_Imbalance', 'VImbalance'],
  currentimbalance: ['CurrentImbalance', 'Current Imbalance', 'I_Imbalance', 'IImbalance'],
  powerfactor: ['Power Factor', 'PowerFactor', 'PF', 'pf', 'Average Power Factor', 'Total Power Factor', 'TotalPowerFactor'],
  frequency: ['Frequency', 'Freq', 'Hz', 'Line Frequency'],
  thd_v: ['THD_V', 'THDV', 'THD-V', 'THD V', 'THD_Voltage', 'THD Voltage'],
  thd_i: ['THD_I', 'THDI', 'THD-I', 'THD I', 'THD_Current', 'THD Current'],
  energy: ['Energy', 'Units', 'kWh', 'PowerConsumption', 'TotalEnergy', 'ImportEnergy', 'ActiveEnergy'],
}

const getRawCandidateNames = (name) => {
  const norm = String(name || '').toLowerCase().replace(/[\s_-]+/g, '')
  const candidates = RAW_VARIABLE_CANDIDATES[norm] || []
  const aliases = getVariableAliases(name)
  return Array.from(new Set([name, ...candidates, ...aliases]))
}

const LEGACY_CUTOFF = new Date('2026-10-09T23:59:59.999Z')

const bucketVariable = async (prisma, opts) => {
  const db = readDb(prisma)
  const { deviceId, slaveId, slaveIds, variableName, startDate, endDate, bucketMs } = opts
  const rawNames = getRawCandidateNames(variableName)
  const isMultiSlave = Array.isArray(slaveIds) && slaveIds.length > 0
  const targetSlaveIds = isMultiSlave ? slaveIds : (slaveId ? [slaveId] : [null])

  if (!isMultiSlave && useHourlyAggregate(opts.startDate) && (await probeHourlyView(db))) {
    try {
      return await bucketVariableHourly(db, opts)
    } catch (_) {
      hourlyViewAvailable = false
    }
  }

  // 1. Resolve actual active configured variable names for the device / slaves to minimize B-Tree candidate branches
  let varNameBySlave = null
  try {
    const configuredVars = await prisma.deviceConfigVariable.findMany({
      where: {
        ...(deviceId ? { deviceId } : {}),
        isActive: true,
        ...(isMultiSlave ? { deviceConfigSlaveId: { in: slaveIds } } : (slaveId ? { deviceConfigSlaveId: slaveId } : {})),
        name: { in: rawNames },
      },
      select: { name: true, deviceConfigSlaveId: true },
    })
    if (configuredVars.length > 0) {
      varNameBySlave = new Map()
      configuredVars.forEach((v) => {
        const key = v.deviceConfigSlaveId || 'default'
        if (!varNameBySlave.has(key)) varNameBySlave.set(key, [])
        varNameBySlave.get(key).push(v.name)
      })
    }
  } catch (_) {}

  // Seamless Multi-Era Queries:
  // - Legacy era (<= 2026-10-09): sensor_reading_values (clean scaled values)
  // - Active era (>= 2026-10-10): sensor_readings (active live production telemetry)
  const queryLegacy = async (sId, start, end) => {
    try {
      const matchingVars = (varNameBySlave && (varNameBySlave.get(sId) || varNameBySlave.get('default'))) || rawNames
      const slvClause = sId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${sId}` : Prisma.empty
      const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
      const endClause = end ? Prisma.sql`AND v."timestamp" <= ${end}` : Prisma.empty
      const rows = await db.$queryRaw`
        SELECT
          ${sId ? Prisma.sql`${sId}::text AS slave_id,` : Prisma.empty}
          (floor(extract(epoch from v."timestamp") * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
          AVG(v.value)::double precision AS avg_val
        FROM sensor_reading_values v
        WHERE v."timestamp" >= ${start}
          ${devClause}
          ${slvClause}
          ${endClause}
          AND v."variableName" IN (${Prisma.join(matchingVars)})
          AND v.value > -10000000 AND v.value < 10000000
        GROUP BY ${sId ? Prisma.sql`slave_id,` : Prisma.empty} bucket_ms
        ORDER BY bucket_ms ASC
      `
      return rows.map((r) => ({
        ...(sId ? { slaveId: r.slave_id } : {}),
        timestamp: new Date(Number(r.bucket_ms)),
        value: parseFloat(Number(r.avg_val).toFixed(4)),
      }))
    } catch (_) {
      return []
    }
  }

  const queryActive = async (sId, start, end) => {
    try {
      const matchingVars = (varNameBySlave && (varNameBySlave.get(sId) || varNameBySlave.get('default'))) || rawNames
      const slvClause = sId ? Prisma.sql`AND sr."deviceConfigSlaveId" = ${sId}` : Prisma.empty
      const devClause = deviceId ? Prisma.sql`AND sr."deviceId" = ${deviceId}` : Prisma.empty
      const endClause = end ? Prisma.sql`AND sr."timestamp" <= ${end}` : Prisma.empty
      const rows = await db.$queryRaw`
        SELECT
          ${sId ? Prisma.sql`${sId}::text AS slave_id,` : Prisma.empty}
          (floor(extract(epoch from sr."timestamp") * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
          AVG((elem->>'value')::double precision) AS avg_val
        FROM "sensor_readings" sr,
             jsonb_array_elements(sr.readings) AS elem
        WHERE sr."timestamp" >= ${start}
          ${devClause}
          ${slvClause}
          ${endClause}
          AND elem->>'variableName' IN (${Prisma.join(matchingVars)})
          AND (elem->>'value')::double precision > -10000000
          AND (elem->>'value')::double precision < 10000000
        GROUP BY ${sId ? Prisma.sql`slave_id,` : Prisma.empty} bucket_ms
        ORDER BY bucket_ms ASC
      `
      return rows.map((r) => ({
        ...(sId ? { slaveId: r.slave_id } : {}),
        timestamp: new Date(Number(r.bucket_ms)),
        value: parseFloat(Number(r.avg_val).toFixed(4)),
      }))
    } catch (_) {
      return []
    }
  }

  const querySingleSlave = async (sId) => {
    const isSpanning = startDate <= LEGACY_CUTOFF && (!endDate || endDate > LEGACY_CUTOFF)
    const isLegacyOnly = endDate && endDate <= LEGACY_CUTOFF
    const isActiveOnly = startDate > LEGACY_CUTOFF

    if (isActiveOnly) {
      const activePts = await queryActive(sId, startDate, endDate)
      if (activePts.length > 0) return activePts
      return await queryLegacy(sId, startDate, endDate)
    }
    if (isLegacyOnly) {
      const legacyPts = await queryLegacy(sId, startDate, endDate)
      if (legacyPts.length > 0) return legacyPts
      return await queryActive(sId, startDate, endDate)
    }
    if (isSpanning) {
      const [legacyPts, activePts] = await Promise.all([
        queryLegacy(sId, startDate, LEGACY_CUTOFF),
        queryActive(sId, new Date(LEGACY_CUTOFF.getTime() + 1), endDate),
      ])
      const map = new Map()
      legacyPts.forEach((p) => map.set(p.timestamp.getTime(), p))
      activePts.forEach((p) => map.set(p.timestamp.getTime(), p))
      return Array.from(map.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    }
    return []
  }

  if (isMultiSlave) {
    const tasks = targetSlaveIds.map(querySingleSlave)
    const results = await Promise.all(tasks)
    return results.flat()
  }

  return await querySingleSlave(slaveId || null)
}

/**
 * Fetch and aggregate multiple metrics in a single grouped SQL pass.
 * Drastically reduces round-trips and full scans for dashboard charts.
 */
const bucketManyCombined = async (prisma, { deviceId, slaveId, startDate, endDate, bucketMs, metricNames }) => {
  const db = readDb(prisma)

  const candidateToMetric = new Map()
  const allCandidates = new Set()

  for (const name of metricNames) {
    const rawNames = getRawCandidateNames(name)
    for (const raw of rawNames) {
      allCandidates.add(raw)
      if (!candidateToMetric.has(raw)) candidateToMetric.set(raw, name)
    }
  }

  const candidateList = Array.from(allCandidates)
  const result = {}
  for (const name of metricNames) {
    result[name] = []
  }

  if (!candidateList.length) return result

  const metricBucketMap = {}
  for (const name of metricNames) metricBucketMap[name] = new Map()

  const queryLegacy = async (start, end) => {
    try {
      const endClause = end ? Prisma.sql`AND v."timestamp" <= ${end}` : Prisma.empty
      const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
      const slvClause = slaveId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty
      const rows = await db.$queryRaw`
        SELECT
          v."variableName",
          (floor(extract(epoch from v."timestamp") * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
          AVG(v.value)::double precision AS avg_val
        FROM sensor_reading_values v
        WHERE v."timestamp" >= ${start}
          ${devClause}
          ${slvClause}
          ${endClause}
          AND v."variableName" IN (${Prisma.join(candidateList)})
          AND v.value > -10000000
          AND v.value < 10000000
        GROUP BY v."variableName", bucket_ms
        ORDER BY bucket_ms ASC
      `
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const metric = candidateToMetric.get(r.variableName)
          if (metric && metricBucketMap[metric]) {
            const bMs = Number(r.bucket_ms)
            metricBucketMap[metric].set(bMs, parseFloat(Number(r.avg_val).toFixed(4)))
          }
        }
      }
    } catch (_) {}
  }

  const queryActive = async (start, end) => {
    try {
      const endClauseSr = end ? Prisma.sql`AND sr."timestamp" <= ${end}` : Prisma.empty
      const devClauseSr = deviceId ? Prisma.sql`AND sr."deviceId" = ${deviceId}` : Prisma.empty
      const srRows = await db.$queryRaw`
        SELECT
          elem->>'variableName' AS var_name,
          (floor(extract(epoch from sr."timestamp") * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
          AVG((elem->>'value')::double precision) AS avg_val
        FROM "sensor_readings" sr,
             jsonb_array_elements(sr.readings) AS elem
        WHERE sr."timestamp" >= ${start}
          ${devClauseSr}
          ${slaveClause(slaveId)}
          ${endClauseSr}
          AND elem->>'variableName' IN (${Prisma.join(candidateList)})
          AND (elem->>'value')::double precision > -10000000
          AND (elem->>'value')::double precision < 10000000
        GROUP BY var_name, bucket_ms
        ORDER BY bucket_ms ASC
      `
      if (Array.isArray(srRows)) {
        for (const r of srRows) {
          const metric = candidateToMetric.get(r.var_name)
          if (metric && metricBucketMap[metric]) {
            const bMs = Number(r.bucket_ms)
            metricBucketMap[metric].set(bMs, parseFloat(Number(r.avg_val).toFixed(4)))
          }
        }
      }
    } catch (_) {}
  }

  const isSpanning = startDate <= LEGACY_CUTOFF && (!endDate || endDate > LEGACY_CUTOFF)
  const isLegacyOnly = endDate && endDate <= LEGACY_CUTOFF
  const isActiveOnly = startDate > LEGACY_CUTOFF

  if (isActiveOnly) {
    await queryActive(startDate, endDate)
  } else if (isLegacyOnly) {
    await queryLegacy(startDate, endDate)
  } else if (isSpanning) {
    await Promise.all([
      queryLegacy(startDate, LEGACY_CUTOFF),
      queryActive(new Date(LEGACY_CUTOFF.getTime() + 1), endDate),
    ])
  }

  for (const name of metricNames) {
    const map = metricBucketMap[name]
    result[name] = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, val]) => ({ timestamp: new Date(ts), value: val }))
  }

  return result
}

const sumVariable = async (prisma, { deviceId, slaveId, variableName, startDate, endDate }) => {
  const db = readDb(prisma)
  const endClause = endDate ? Prisma.sql`AND v.timestamp < ${endDate}` : Prisma.empty
  const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
  const slvClause = slaveId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty
  const rawNames = getRawCandidateNames(variableName)

  // Primary: indexed sensor_readings table (active live telemetry)
  try {
    const endClauseSr = endDate ? Prisma.sql`AND sr."timestamp" < ${endDate}` : Prisma.empty
    const devClauseSr = deviceId ? Prisma.sql`AND sr."deviceId" = ${deviceId}` : Prisma.empty
    const slvClauseSr = slaveId ? Prisma.sql`AND sr."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty
    const srRows = await db.$queryRaw`
      SELECT COALESCE(SUM((elem->>'value')::double precision), 0)::double precision AS total
      FROM "sensor_readings" sr,
           jsonb_array_elements(sr.readings) AS elem
      WHERE sr."timestamp" >= ${startDate}
        ${devClauseSr}
        ${slvClauseSr}
        ${endClauseSr}
        AND elem->>'variableName' IN (${Prisma.join(rawNames)})
        AND (elem->>'value')::double precision > -10000000
        AND (elem->>'value')::double precision < 10000000
    `
    if (srRows[0]?.total != null && Number(srRows[0].total) > 0) return parseFloat(Number(srRows[0].total).toFixed(4))
  } catch (_) {}

  // Fallback to legacy sensor_reading_values table
  try {
    const narrow = await db.$queryRaw`
      SELECT COALESCE(SUM(v.value), 0)::double precision AS total
      FROM sensor_reading_values v
      WHERE v.timestamp >= ${startDate}
        ${devClause}
        ${slvClause}
        ${endClause}
        AND v."variableName" IN (${Prisma.join(rawNames)})
        AND v.value > -10000000 AND v.value < 10000000
    `
    if (narrow[0]?.total != null) return parseFloat(Number(narrow[0].total).toFixed(4))
  } catch (_) {}

  return 0
}

/**
 * Period consumption for cumulative meters: last reading − first reading in [startDate, endDate).
 * Uses index seek (LIMIT 1 on ASC and DESC) for sub-millisecond execution.
 * Returns 0 when fewer than 2 samples or the meter went backwards.
 */
const deltaVariable = async (prisma, { deviceId, slaveId, variableName, startDate, endDate }) => {
  const db = readDb(prisma)
  const endClause = endDate ? Prisma.sql`AND v.timestamp < ${endDate}` : Prisma.empty
  const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
  const slvClause = slaveId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty
  const rawNames = getRawCandidateNames(variableName)

  // Primary: indexed sensor_readings table (active live telemetry)
  try {
    const endClauseSr = endDate ? Prisma.sql`AND sr."timestamp" < ${endDate}` : Prisma.empty
    const devClauseSr = deviceId ? Prisma.sql`AND sr."deviceId" = ${deviceId}` : Prisma.empty
    const slvClauseSr = slaveId ? Prisma.sql`AND sr."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty
    const [firstSr, lastSr] = await Promise.all([
      db.$queryRaw`
        SELECT (elem->>'value')::double precision AS val
        FROM "sensor_readings" sr,
             jsonb_array_elements(sr.readings) AS elem
        WHERE sr."timestamp" >= ${startDate}
          ${devClauseSr}
          ${slvClauseSr}
          ${endClauseSr}
          AND elem->>'variableName' IN (${Prisma.join(rawNames)})
          AND (elem->>'value')::double precision > -10000000
          AND (elem->>'value')::double precision < 10000000
        ORDER BY sr."timestamp" ASC
        LIMIT 1
      `,
      db.$queryRaw`
        SELECT (elem->>'value')::double precision AS val
        FROM "sensor_readings" sr,
             jsonb_array_elements(sr.readings) AS elem
        WHERE sr."timestamp" >= ${startDate}
          ${devClauseSr}
          ${slvClauseSr}
          ${endClauseSr}
          AND elem->>'variableName' IN (${Prisma.join(rawNames)})
          AND (elem->>'value')::double precision > -10000000
          AND (elem->>'value')::double precision < 10000000
        ORDER BY sr."timestamp" DESC
        LIMIT 1
      `,
    ])
    if (firstSr?.[0] && lastSr?.[0]) {
      const first = Number(firstSr[0].val)
      const last = Number(lastSr[0].val)
      if (Number.isFinite(first) && Number.isFinite(last) && last >= first) {
        return parseFloat((last - first).toFixed(4))
      }
    }
  } catch (_) {}

  // Fallback to legacy sensor_reading_values table
  try {
    const [firstRow, lastRow] = await Promise.all([
      db.$queryRaw`
        SELECT v.value::double precision AS val
        FROM sensor_reading_values v
        WHERE v.timestamp >= ${startDate}
          ${devClause}
          ${slvClause}
          ${endClause}
          AND v."variableName" IN (${Prisma.join(rawNames)})
          AND v.value > -10000000 AND v.value < 10000000
        ORDER BY v.timestamp ASC
        LIMIT 1
      `,
      db.$queryRaw`
        SELECT v.value::double precision AS val
        FROM sensor_reading_values v
        WHERE v.timestamp >= ${startDate}
          ${devClause}
          ${slvClause}
          ${endClause}
          AND v."variableName" IN (${Prisma.join(rawNames)})
          AND v.value > -10000000 AND v.value < 10000000
        ORDER BY v.timestamp DESC
        LIMIT 1
      `
    ])
    if (firstRow?.[0] && lastRow?.[0]) {
      const first = Number(firstRow[0].val)
      const last = Number(lastRow[0].val)
      if (Number.isFinite(first) && Number.isFinite(last) && last >= first) {
        return parseFloat((last - first).toFixed(4))
      }
    }
  } catch (_) {}

  return 0
}

/** Common cumulative / energy meter names seen across MQTT templates. */
const ENERGY_DELTA_VARS = [
  'Energy', 'PowerConsumption', 'TotalEnergy', 'ImportEnergy',
  'ActiveEnergy', 'kWh', 'KWH', 'Units', 'EnergyImport', 'Active Energy', 'Total Energy',
]

/**
 * Best-effort kWh for a window. Uses index seek on candidate cumulative meters for instant sub-millisecond execution.
 */
const periodEnergyKwh = async (prisma, opts) => {
  const db = readDb(prisma)
  const { deviceId, slaveId, startDate, endDate } = opts
  const endClause = endDate ? Prisma.sql`AND v.timestamp < ${endDate}` : Prisma.empty
  const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
  const slvClause = slaveId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty

  // Primary: active sensor_readings table
  for (const varName of ['Units', 'Energy', 'TotalEnergy', 'ImportEnergy', 'ActiveEnergy', 'kWh', 'PowerConsumption']) {
    try {
      const endClauseSr = endDate ? Prisma.sql`AND sr."timestamp" < ${endDate}` : Prisma.empty
      const devClauseSr = deviceId ? Prisma.sql`AND sr."deviceId" = ${deviceId}` : Prisma.empty
      const rawNames = getRawCandidateNames(varName)
      const [firstSr, lastSr] = await Promise.all([
        db.$queryRaw`
          SELECT (elem->>'value')::double precision AS val
          FROM "sensor_readings" sr,
               jsonb_array_elements(sr.readings) AS elem
          WHERE sr."timestamp" >= ${startDate}
            ${devClauseSr}
            ${slaveClause(slaveId)}
            ${endClauseSr}
            AND elem->>'variableName' IN (${Prisma.join(rawNames)})
            AND (elem->>'value')::double precision > -10000000
            AND (elem->>'value')::double precision < 10000000
          ORDER BY sr."timestamp" ASC
          LIMIT 1
        `,
        db.$queryRaw`
          SELECT (elem->>'value')::double precision AS val
          FROM "sensor_readings" sr,
               jsonb_array_elements(sr.readings) AS elem
          WHERE sr."timestamp" >= ${startDate}
            ${devClauseSr}
            ${slaveClause(slaveId)}
            ${endClauseSr}
            AND elem->>'variableName' IN (${Prisma.join(rawNames)})
            AND (elem->>'value')::double precision > -10000000
            AND (elem->>'value')::double precision < 10000000
          ORDER BY sr."timestamp" DESC
          LIMIT 1
        `,
      ])
      if (firstSr?.[0] && lastSr?.[0]) {
        const first = Number(firstSr[0].val)
        const last = Number(lastSr[0].val)
        if (Number.isFinite(first) && Number.isFinite(last) && last >= first) {
          return parseFloat((last - first).toFixed(4))
        }
      }
    } catch (_) {}
  }

  // Fallback: legacy sensor_reading_values table
  for (const varName of ENERGY_DELTA_VARS) {
    try {
      const [firstRow, lastRow] = await Promise.all([
        db.$queryRaw`
          SELECT v.value::double precision AS val
          FROM sensor_reading_values v
          WHERE v.timestamp >= ${startDate}
            ${devClause}
            ${slvClause}
            ${endClause}
            AND v."variableName" = ${varName}
            AND v.value > -10000000 AND v.value < 10000000
          ORDER BY v.timestamp ASC
          LIMIT 1
        `,
        db.$queryRaw`
          SELECT v.value::double precision AS val
          FROM sensor_reading_values v
          WHERE v.timestamp >= ${startDate}
            ${devClause}
            ${slvClause}
            ${endClause}
            AND v."variableName" = ${varName}
            AND v.value > -10000000 AND v.value < 10000000
          ORDER BY v.timestamp DESC
          LIMIT 1
        `
      ])
      if (firstRow?.[0] && lastRow?.[0]) {
        const first = Number(firstRow[0].val)
        const last = Number(lastRow[0].val)
        if (Number.isFinite(first) && Number.isFinite(last) && last >= first && (last - first) > 0) {
          return parseFloat((last - first).toFixed(4))
        }
      }
    } catch (_) {}
  }

  // Fallback to PowerConsumption sum or ActivePower sum
  const pcSum = await sumVariable(prisma, { ...opts, variableName: 'PowerConsumption' })
  if (pcSum > 0) return pcSum

  const apSum = await sumVariable(prisma, { ...opts, variableName: 'ActivePower' })
  if (apSum > 0) return parseFloat((apSum / 1000).toFixed(4))

  return 0
}

const bucketMany = async (prisma, deviceId, slaveId, startDate, bucketMs, names) => {
  return bucketManyCombined(prisma, { deviceId, slaveId, startDate, bucketMs, metricNames: names })
}

module.exports = { bucketVariable, bucketManyCombined, sumVariable, deltaVariable, periodEnergyKwh, bucketMany, getVariableAliases, getRawCandidateNames }

