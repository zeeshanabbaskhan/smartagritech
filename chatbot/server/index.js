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
    return res.status(400).json({ error: 'messages array is required' })
  }

  // Validate each message has role + content
  const valid = messages.every(m => m.role && typeof m.content === 'string')
  if (!valid) {
    return res.status(400).json({ error: 'Each message must have role and content' })
  }

  try {
    const reply = await chat(messages)
    res.json({ reply })
  } catch (err) {
    console.error('[chatbot] AI error:', err.message)
    const isKeyError = err.message?.toLowerCase().includes('api key') ||
                       err.message?.toLowerCase().includes('authentication') ||
                       err.status === 401
    res.status(500).json({
      error: isKeyError
        ? 'AI API key error — check GROQ_API_KEY or GEMINI_API_KEY in chatbot/server/.env'
        : `AI error: ${err.message}`,
    })
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
