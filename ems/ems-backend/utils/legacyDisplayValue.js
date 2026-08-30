/**
 * Match cfsmartems.com (Elsa EMS) DisplayValue rounding on computed readings.
 * Legacy stores CurrentValue (full computed) + DisplayValue (rounded for UI).
 * Dashboard tiles must show DisplayValue-equivalent numbers only.
 */

function legacyDisplayDecimals(value, meta = {}) {
  const name = String(meta.name || '')
  const label = String(meta.displayName || meta.label || name)
  const unit = String(meta.unit || '')
  const combined = `${name} ${label} ${unit}`.toLowerCase()

  if (/temp|°c/.test(combined)) return 1
  if (/powerfactor|\bpf\b|power factor/.test(combined)) return 2
  if (/frequency|\bhz\b/.test(combined)) return 2
  if (/thd/.test(combined)) return 1
  if (/voltage|current|\bv\b|\ba\b/.test(combined) && !/power/.test(combined)) return 2
  if (/energy|kwh|consumption|units|export power|operating power|active power|reactive|apparent|\bkw\b|\bkvar\b|\bkva\b|\bva\b|\bw\b/.test(combined)) return 2
  if (Math.abs(value) >= 1000) return 1
  return 2
}

/** Round computed value the way legacy DisplayValue does. */
function legacyDisplayValue(rawValue, meta = {}) {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return null
  const decimals = legacyDisplayDecimals(value, meta)
  return Number(value.toFixed(decimals))
}

/** String for UI tiles — same digits as legacy DisplayValue. */
function legacyDisplayString(rawValue, meta = {}) {
  const n = legacyDisplayValue(rawValue, meta)
  if (n == null) return null
  const decimals = legacyDisplayDecimals(n, meta)
  return n.toFixed(decimals)
}

module.exports = { legacyDisplayValue, legacyDisplayString, legacyDisplayDecimals }
