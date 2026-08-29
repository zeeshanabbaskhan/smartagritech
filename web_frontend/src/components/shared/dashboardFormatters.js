/** Shared tile value formatting for dashboard / slave metrics. */
export function formatTileValue(value, name, unit = '') {
  if (!Number.isFinite(value)) return '—'
  const n = String(name || '')
  const u = String(unit || '')
  if (/temp/i.test(n) || u === '°C') return value.toFixed(1)
  if (/powerfactor|\bpf\b/i.test(n)) return value.toFixed(2)
  if (/thd/i.test(n) || u === '%') return value.toFixed(1)
  if (/kw|kvar|kva|kwh/i.test(u)) return value.toFixed(2)
  if (Math.abs(value) >= 1000 && !/voltage|current|freq/i.test(n)) return value.toFixed(2)
  if (Math.abs(value) >= 100) return value.toFixed(1)
  return value.toFixed(2)
}
