/**
 * Apply template control (e.g. =s/100) + equation formulas to an ingest payload.
 * Direct vars: prefer controlFormula, fall back to acquisitionFormula.
 * Equation vars: controlFormula with Slave$$Var refs (not =s/100).
 * Returns computed readings suitable for currentValue / SensorReadingValue / Redis / socket.
 * Raw readings remain unchanged in SensorReading.readings JSON.
 */
const {
  applyAcquisitionFormula,
  applyEquationFormula,
} = require('./formulaEngine')

/**
 * Build name→configVar map. When preferredSlaveId is set and duplicate names exist
 * across slaves, resolve to that slave’s config variable.
 */
const mapConfigVarsByName = (configVars, preferredSlaveId) => {
  const byName = {}
  for (const v of configVars || []) {
    if (!v?.name) continue
    const existing = byName[v.name]
    if (!existing) {
      byName[v.name] = v
      continue
    }
    if (preferredSlaveId && v.deviceConfigSlaveId === preferredSlaveId) {
      byName[v.name] = v
    }
  }
  return byName
}

const isVoltage = (v) => {
  if (v.includes('voltage') || v.includes('volt')) return true
  if (/^v[0-9abc]/.test(v) || /^v_[0-9abc]/.test(v)) return true
  if (/^v(ab|bc|ca|12|23|31|ln|ll|an|bn|cn|1n|2n|3n)$/.test(v)) return true
  if (v.startsWith('phase') && (v.includes('v') || v.includes('volt'))) return true
  if (v.includes('linevoltage') || v.includes('line_voltage')) return true
  return false
}

const isCurrent = (v) => {
  if (v.includes('current') || v.includes('amp') || v.includes('curr')) return true
  if (/^i[0-9abcn]/.test(v) || /^i_[0-9abcn]/.test(v)) return true
  if (v.startsWith('phase') && (v.includes('i') || v.includes('amp') || v.includes('curr'))) return true
  return false
}

const isPower = (v) => {
  if (v.includes('powerfactor') || v === 'pf') return false
  if (v.includes('power') || v.includes('apparent') || v.includes('reactive') || v.includes('watt')) return true
  if (v.endsWith('kw') || v.endsWith('kvar') || v.endsWith('kva') || v.endsWith('w')) return true
  if (/^(p|q|s)[0-9abc]$/.test(v) || /^(p|q|s)_[0-9abc]$/.test(v)) return true
  return false
}

const isPowerFactor = (v) => {
  return v.includes('powerfactor') || v === 'pf' || v.includes('cosphi') || v.includes('cos_phi')
}

const isFrequency = (v) => {
  return v.includes('frequency') || v.includes('freq') || v.endsWith('hz') || v === 'hz'
}

const isUnits = (v) => {
  return v.includes('units') || v.includes('energy') || v.includes('kwh') || v.includes('mwh') || v.endsWith('kwh')
}

const applyStandardFormulation = (varName, rawVal) => {
  const num = typeof rawVal === 'number' ? rawVal : Number(rawVal)
  if (!Number.isFinite(num)) return rawVal

  const v = String(varName || '').toLowerCase().replace(/[\s_-]+/g, '')

  // 1. Power Factor: standard 0.00 to 1.00
  if (isPowerFactor(v)) {
    if (Math.abs(num) <= 1) return parseFloat(num.toFixed(4))
    if (Math.abs(num) > 100) return parseFloat((num / 1000).toFixed(4))
    return parseFloat((num / 100).toFixed(4))
  }

  // 2. Frequency: divided by 100
  if (isFrequency(v)) {
    return parseFloat((num / 100).toFixed(2))
  }

  // 3. Units / Energy: divided by 1000
  if (isUnits(v)) {
    return parseFloat((num / 1000).toFixed(4))
  }

  // 4. All Voltages & All Phase Voltages: divided by 10000
  if (isVoltage(v)) {
    return parseFloat((num / 10000).toFixed(4))
  }

  // 5. All Currents: divided by 10000
  if (isCurrent(v)) {
    return parseFloat((num / 10000).toFixed(4))
  }

  // 6. All Power (Active, Total, Apparent, Reactive): divided by 10000
  if (isPower(v)) {
    return parseFloat((num / 10000).toFixed(4))
  }

  return num
}

/**
 * @param {Array} configVars - DeviceConfigVariable rows with templateVariable + configSlave
 * @param {Array<{variableName, value}>} readings - raw ingest readings
 * @param {string} [preferredSlaveId] - when set, duplicate names resolve to this slave’s config var
 * @returns {Array<{variableName, value}>} computed readings (includes equation vars)
 */
const applyIngestFormulas = (configVars, readings, preferredSlaveId) => {
  const byName = mapConfigVarsByName(configVars, preferredSlaveId)

  // Map of "SlaveName$$VariableName" → computed numeric value
  const refValues = {}
  // Map of config var name → computed value (string|number)
  const computedByName = {}

  const slaveNameOf = (cv) =>
    cv.templateVariable?.templateSlave?.name ||
    cv.configSlave?.name ||
    ''

  // 1) Direct variables from payload (+ control formula, e.g. =s/100)
  // Prefer controlFormula; fall back to acquisitionFormula for older rows.
  for (const r of readings || []) {
    if (r.variableName == null) continue
    const cv = byName[r.variableName]
    const tv = cv?.templateVariable
    const isEquation = tv?.variableType === 'EQUATION'
    let value = r.value

    if (!isEquation) {
      const scaleFormula = tv?.controlFormula || tv?.acquisitionFormula
      if (scaleFormula) {
        value = applyAcquisitionFormula(scaleFormula, r.value)
      } else {
        value = applyStandardFormulation(r.variableName, r.value)
      }
    }

    computedByName[r.variableName] = value
    if (cv) {
      const sn = slaveNameOf(cv)
      if (sn) refValues[`${sn}$$${cv.name}`] = Number(value)
    }
  }

  // Also seed refs from existing currentValue for vars not in this payload
  // (helps equations that span multiple slaves when only one slave reports)
  for (const cv of configVars || []) {
    if (computedByName[cv.name] !== undefined) continue
    if (cv.currentValue == null || cv.currentValue === '') continue
    const num = Number(cv.currentValue)
    if (Number.isNaN(num)) continue
    const sn = slaveNameOf(cv)
    if (sn) refValues[`${sn}$$${cv.name}`] = num
    computedByName[cv.name] = num
  }

  // 2) Equation variables (after directs)
  for (const cv of configVars || []) {
    const tv = cv.templateVariable
    if (!tv || tv.variableType !== 'EQUATION') continue
    const formula = tv.controlFormula || tv.acquisitionFormula
    if (!formula) continue

    const result = applyEquationFormula(formula, (slave, variable) => {
      const key = `${slave}$$${variable}`
      if (refValues[key] != null) return refValues[key]
      // Fallback: match by variable name only within same device
      const peer = byName[variable]
      if (peer && computedByName[peer.name] != null) return Number(computedByName[peer.name])
      return null
    })

    if (result == null) continue
    computedByName[cv.name] = result
    const sn = slaveNameOf(cv)
    if (sn) refValues[`${sn}$$${cv.name}`] = result
  }

  // Build reading list: payload vars (computed) + newly computed equations not in payload
  const out = []
  const seen = new Set()
  for (const r of readings || []) {
    if (r.variableName == null) continue
    const value = computedByName[r.variableName] !== undefined
      ? computedByName[r.variableName]
      : r.value
    out.push({ variableName: r.variableName, value })
    seen.add(r.variableName)
  }
  for (const cv of configVars || []) {
    if (seen.has(cv.name)) continue
    if (cv.templateVariable?.variableType !== 'EQUATION') continue
    if (computedByName[cv.name] === undefined) continue
    // Only emit equation if it was freshly computable from this ingest
    // (has a controlFormula and we got a result)
    out.push({ variableName: cv.name, value: computedByName[cv.name] })
  }

  return out
}

const CONFIG_VAR_INCLUDE = {
  templateVariable: {
    select: {
      acquisitionFormula: true,
      controlFormula: true,
      variableType: true,
      templateSlave: { select: { name: true } },
    },
  },
  configSlave: { select: { name: true } },
}

module.exports = { applyIngestFormulas, CONFIG_VAR_INCLUDE }
