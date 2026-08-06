/**
 * index.js — SmartAgriTech Chatbot Microserver
 *
 * Standalone Express server (no Prisma, no Redis).
 * Phase A: loads CSV data into memory on startup.
 * Phase B: exposes POST /api/chatbot/query with Groq/Gemini tool-calling.
 */

require('dotenv').config()

const express = require('express')
const cors    = require('cors')
const { db, load } = require('./dataLoader')
const { chat }     = require('./aiEngine')

const app  = express()
const PORT = process.env.PORT || 5175

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5174')
  .split(',').map(o => o.trim())

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '64kb' }))

// ── Phase A: Load CSV data ────────────────────────────────────────────────────
load()

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    ts:     new Date().toISOString(),
    data: {
      organizations: db.organizations.length,
      devices:       db.devices.length,
      alarms:        db.alarmHistories.length,
      intervalRows:  db.intervalHistories.length,
    },
  })
})

// ── Phase B: Chatbot query endpoint ──────────────────────────────────────────
/**
 * POST /api/chatbot/query
 * Body: { messages: [{ role: 'user'|'assistant', content: string }] }
 * Returns: { reply: string }
 *
 * NOTE: No auth required in this standalone server — it only serves
 * read-only demo data. When embedded into the main EMS backend,
 * add the `protect` middleware here.
 */
app.post('/api/chatbot/query', async (req, res) => {
  const { messages } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "I didn't quite catch that — could you rephrase your question?" })
  }

  // Validate each message has role + content
  const valid = messages.every(m => m.role && typeof m.content === 'string')
  if (!valid) {
    return res.status(400).json({ error: "I didn't quite catch that — could you rephrase your question?" })
  }

  try {
    const reply = await chat(messages)
    res.json({ reply })
  } catch (err) {
    // Log full technical error server-side ONLY (never send stack/API details to client)
    console.error('[chatbot server error detail]', {
      timestamp: new Date().toISOString(),
      message: err.message,
      status: err.status || err.statusCode,
      code: err.code,
      stack: err.stack,
    })

    // Classify error to a friendly, client-safe message in Elsa's voice
    const msgLower = (err.message || '').toLowerCase()
    const status = err.status || err.statusCode || 500

    let clientMessage = "Something went wrong on my end. Please try again, or contact support if the issue continues."

    if (status === 429 || msgLower.includes('rate limit') || msgLower.includes('quota') || msgLower.includes('too many requests') || msgLower.includes('resource_exhausted')) {
      clientMessage = "I'm a little busy right now — please try again in a moment."
    } else if (msgLower.includes('econnrefused') || msgLower.includes('etimedout') || msgLower.includes('timeout') || msgLower.includes('fetch failed') || msgLower.includes('network') || msgLower.includes('socket hang up')) {
      clientMessage = "I'm having trouble connecting right now. Please try again shortly."
    } else if (status >= 500 || msgLower.includes('bad gateway') || msgLower.includes('service unavailable') || msgLower.includes('503') || msgLower.includes('500') || msgLower.includes('overloaded') || msgLower.includes('internal error')) {
      clientMessage = "I'm temporarily unavailable. Please try again in a few minutes, or contact support if this continues."
    } else if (msgLower.includes('json') || msgLower.includes('malformed') || msgLower.includes('invalid response') || msgLower.includes('parse') || msgLower.includes('empty response')) {
      clientMessage = "I didn't quite catch that — could you rephrase your question?"
    } else if (status === 401 || msgLower.includes('api key') || msgLower.includes('auth') || msgLower.includes('unauthorized') || msgLower.includes('invalid_api_key')) {
      clientMessage = "I'm temporarily unavailable. Please try again in a few minutes, or contact support if this continues."
    }

    res.status(status >= 400 && status < 600 ? status : 500).json({ error: clientMessage })
  }
})

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }))

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Chatbot server running on http://localhost:${PORT}`)
  console.log(`   POST http://localhost:${PORT}/api/chatbot/query`)
  console.log(`   GET  http://localhost:${PORT}/health\n`)
})
