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
  voltagea: ['voltagea', 'phasevoltagea', 'phaseavoltage', 'voltage_a', 'voltage', 'v_a', 'v1', 'phasevoltage1'],
  voltageb: ['voltageb', 'phasevoltageb', 'phasebvoltage', 'voltage_b', 'v_b', 'v2', 'phasevoltage2'],
  voltagec: ['voltagec', 'phasevoltagec', 'phasecvoltage', 'voltage_c', 'v_c', 'v3', 'phasevoltage3'],
  voltageimbalance: ['voltageimbalance', 'voltage_imbalance', 'v_imbalance', 'vimbalance'],
  currenta: ['currenta', 'current a', 'phasecurrenta', 'phaseacurrent', 'current_a', 'i_a', 'i1', 'current1'],
  currentb: ['currentb', 'current b', 'phasecurrentb', 'phasebcurrent', 'current_b', 'i_b', 'i2', 'current2'],
  currentc: ['currentc', 'current c', 'phasecurrentc', 'phaseccurrent', 'current_c', 'i_c', 'i3', 'current3'],
  currentimbalance: ['currentimbalance', 'current_imbalance', 'i_imbalance', 'iimbalance'],
  powerfactor: ['powerfactor', 'power factor', 'pf', 'totalpowerfactor', 'averagepowerfactor'],
  activepower: ['activepower', ' activepower', 'active power', 'totalpower', 'total active power', 'power', 'powera'],
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
    'ActivePower', 'Total Power', 'Total Active Power', 'Active Power',
    'TotalPower', 'TotalActivePower', 'ActivePowerTotal', 'Power',
    'kW', 'PowerConsumption', 'PowerA', 'PowerB', 'PowerC',
    'Total Active Power (kW)', 'Total Active Power(kW)', 'Active Power Total',
  ],
  exportpower: ['ExportPower', 'SolarPower', 'Export', 'Solar', 'ExportActivePower', 'Solar Power'],
  powerconsumption: ['Units', 'PowerConsumption', 'EnergyConsumption', 'ActiveEnergy', 'kWh', 'TotalEnergy', 'Energy', 'ImportEnergy', 'Active Energy', 'Total Energy'],
  currenta: ['Current A', 'CurrentA', 'PhaseCurrentA', 'Phase Current A', 'Ia', 'Current 1', 'Phase CurrentA'],
  currentb: ['Current B', 'CurrentB', 'PhaseCurrentB', 'Phase Current B', 'Ib', 'Current 2', 'Phase CurrentB'],
  currentc: ['Current C', 'CurrentC', 'PhaseCurrentC', 'Phase Current C', 'Ic', 'Current 3', 'Phase CurrentC'],
  voltagea: ['Voltage', 'VoltageA', 'Voltage A', 'Phase VoltageA', 'PhaseVoltageA', 'Phase Voltage A', 'Va', 'V1'],
  voltageb: ['VoltageB', 'Voltage B', 'Phase VoltageB', 'PhaseVoltageB', 'Phase Voltage B', 'Vb', 'V2'],
  voltagec: ['VoltageC', 'Voltage C', 'Phase VoltageC', 'PhaseVoltageC', 'Phase Voltage C', 'Vc', 'V3'],
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

const bucketVariable = async (prisma, opts) => {
  const db = readDb(prisma)
  if (useHourlyAggregate(opts.startDate) && (await probeHourlyView(db))) {
    try {
      return await bucketVariableHourly(db, opts)
    } catch (_) {
      hourlyViewAvailable = false
    }
  }

  const { deviceId, slaveId, variableName, startDate, endDate, bucketMs } = opts
  const rawNames = getRawCandidateNames(variableName)

  // High-performance index scan on sensor_reading_values using IN (...)
  try {
    const endClause = endDate ? Prisma.sql`AND v."timestamp" <= ${endDate}` : Prisma.empty
    const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
    const slvClause = slaveId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty

    const narrow = await db.$queryRaw`
      SELECT
        (floor(extract(epoch from v."timestamp") * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
        AVG(v.value)::double precision AS avg_val
      FROM sensor_reading_values v
      WHERE v."timestamp" >= ${startDate}
        ${devClause}
        ${slvClause}
        ${endClause}
        AND v."variableName" IN (${Prisma.join(rawNames)})
        AND v.value > -10000000
        AND v.value < 10000000
      GROUP BY bucket_ms
      ORDER BY bucket_ms ASC
    `
    if (Array.isArray(narrow) && narrow.length > 0) {
      return narrow.map((r) => ({
        timestamp: new Date(Number(r.bucket_ms)),
        value: parseFloat(Number(r.avg_val).toFixed(4)),
      }))
    }
  } catch (_) {}

  // Fallback to indexed sensor_readings table
  try {
    const endClauseSr = endDate ? Prisma.sql`AND sr."timestamp" <= ${endDate}` : Prisma.empty
    const rows = await db.$queryRaw`
      SELECT
        (floor(extract(epoch from sr."timestamp") * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
        AVG((elem->>'value')::double precision) AS avg_val
      FROM "sensor_readings" sr,
           jsonb_array_elements(sr.readings::jsonb) AS elem
      WHERE sr."deviceId" = ${deviceId}
        AND sr."timestamp" >= ${startDate}
        ${endClauseSr}
        AND elem->>'variableName' IN (${Prisma.join(rawNames)})
        AND (elem->>'value')::double precision > -10000000
        AND (elem->>'value')::double precision < 10000000
        ${slaveClause(slaveId)}
      GROUP BY bucket_ms
      ORDER BY bucket_ms ASC
    `
    return rows.map((r) => ({
      timestamp: new Date(Number(r.bucket_ms)),
      value:     parseFloat(Number(r.avg_val).toFixed(4)),
    }))
  } catch (_) {
    return []
  }
}

/**
 * Fetch and aggregate multiple metrics in a single grouped SQL pass.
 * Drastically reduces round-trips and full scans for dashboard charts.
 */
const bucketManyCombined = async (prisma, { deviceId, slaveId, startDate, endDate, bucketMs, metricNames }) => {
  const db = readDb(prisma)
  const endClause = endDate ? Prisma.sql`AND v."timestamp" <= ${endDate}` : Prisma.empty
  const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
  const slvClause = slaveId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty

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

  try {
    const rows = await db.$queryRaw`
      SELECT
        v."variableName",
        (floor(extract(epoch from v."timestamp") * 1000 / ${bucketMs}) * ${bucketMs})::bigint AS bucket_ms,
        AVG(v.value)::double precision AS avg_val
      FROM sensor_reading_values v
      WHERE v."timestamp" >= ${startDate}
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
      const metricBucketMap = {}
      for (const name of metricNames) metricBucketMap[name] = new Map()

      for (const r of rows) {
        const metric = candidateToMetric.get(r.variableName)
        if (metric && metricBucketMap[metric]) {
          const bMs = Number(r.bucket_ms)
          if (!metricBucketMap[metric].has(bMs)) {
            metricBucketMap[metric].set(bMs, parseFloat(Number(r.avg_val).toFixed(4)))
          }
        }
      }

      for (const name of metricNames) {
        const map = metricBucketMap[name]
        result[name] = Array.from(map.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([ts, val]) => ({ timestamp: new Date(ts), value: val }))
      }
      return result
    }
  } catch (_) {}

  // Fallback to calling bucketVariable for each metric if needed
  for (const name of metricNames) {
    result[name] = await bucketVariable(prisma, { deviceId, slaveId, variableName: name, startDate, endDate, bucketMs })
  }
  return result
}

const sumVariable = async (prisma, { deviceId, slaveId, variableName, startDate, endDate }) => {
  const db = readDb(prisma)
  const endClause = endDate ? Prisma.sql`AND v.timestamp < ${endDate}` : Prisma.empty
  const devClause = deviceId ? Prisma.sql`AND v."deviceId" = ${deviceId}` : Prisma.empty
  const slvClause = slaveId ? Prisma.sql`AND v."deviceConfigSlaveId" = ${slaveId}` : Prisma.empty
  const rawNames = getRawCandidateNames(variableName)

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

module.exports = { bucketVariable, bucketManyCombined, sumVariable, deltaVariable, periodEnergyKwh, bucketMany, getVariableAliases }

