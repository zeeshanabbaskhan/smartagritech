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
 * @param {Array} configVars - DeviceConfigVariable rows with templateVariable + configSlave
 * @param {Array<{variableName, value}>} readings - raw ingest readings
 * @returns {Array<{variableName, value}>} computed readings (includes equation vars)
 */
const applyIngestFormulas = (configVars, readings) => {
  const byName = Object.fromEntries(
    (configVars || []).map((v) => [v.name, v])
  )

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
        const num = Number(r.value)
        value = Number.isNaN(num) ? r.value : num
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
