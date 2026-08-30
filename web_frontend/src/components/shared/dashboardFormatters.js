/** Shared tile value formatting — match legacy Elsa DisplayValue rounding (2dp V/I/P, etc.). */
export function formatTileValue(value, name, unit = '') {
  if (!Number.isFinite(value)) return '—'
  const n = String(name || '')
  const u = String(unit || '')
  const combined = `${n} ${u}`.toLowerCase()
  if (/temp|°c/.test(combined)) return value.toFixed(1)
  if (/powerfactor|\bpf\b/.test(combined)) return value.toFixed(2)
  if (/frequency|\bhz\b/.test(combined)) return value.toFixed(2)
  if (/thd/.test(combined)) return value.toFixed(1)
  if (/voltage|current/.test(combined) && !/power/.test(combined)) return value.toFixed(2)
  if (/energy|kwh|consumption|units|export|activepower|reactive|apparent|operating|^power$/i.test(n) || /kw|kvar|kva/.test(u)) return value.toFixed(2)
  if (Math.abs(value) >= 1000) return value.toFixed(1)
  return value.toFixed(2)
}

/** Prefer API displayValue (legacy-rounded) when present. */
export function formatMetricValue(rawValue, displayValue, name, unit = '') {
  if (displayValue != null && displayValue !== '' && Number.isFinite(Number(displayValue))) {
    return formatTileValue(Number(displayValue), name, unit)
  }
  return formatTileValue(Number(rawValue), name, unit)
}
