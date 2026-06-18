// ─── Optional Redis client (P-20, P-21, P-08, P-23) ───────────────────────
// When REDIS_URL is unset the app runs without caching, queues, or cluster
// rate-limit stores — all features degrade gracefully to in-process behaviour.

const { createClient } = require('redis')

let client  = null
let enabled = false

const initRedis = async () => {
  const url = process.env.REDIS_URL
  if (!url) {
    console.log('Redis: REDIS_URL not set — cache, queue, and cluster rate limits disabled')
    return false
  }
  try {
    client = createClient({ url })
    client.on('error', (err) => console.error('Redis error:', err.message))
    await client.connect()
    enabled = true
    console.log('Redis connected')
    return true
  } catch (err) {
    console.warn('Redis unavailable — running without Redis:', err.message)
    client  = null
    enabled = false
    return false
  }
}

const isEnabled  = () => enabled && client?.isOpen
const getClient  = () => (isEnabled() ? client : null)

const closeRedis = async () => {
  if (client?.isOpen) await client.quit()
  client  = null
  enabled = false
}

module.exports = { initRedis, isEnabled, getClient, closeRedis }
