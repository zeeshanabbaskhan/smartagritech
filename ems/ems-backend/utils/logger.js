// Structured logging (P-50) — JSON in production, readable in development.

const log = (level, msg, meta = {}) => {
  const entry = { level, msg, ts: new Date().toISOString(), ...meta }
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry))
  } else {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    console.log(`[${level}] ${msg}${extra}`)
  }
}

module.exports = {
  info:  (msg, meta) => log('info', msg, meta),
  warn:  (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
}
