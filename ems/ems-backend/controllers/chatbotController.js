const { chat } = require('../services/chatbot/aiEngine')

function mapClientError(err) {
  const msgLower = (err.message || '').toLowerCase()
  const status = err.status || err.statusCode || 500

  let clientMessage =
    'Something went wrong on my end. Please try again, or contact support if the issue continues.'

  if (
    status === 429 ||
    msgLower.includes('rate limit') ||
    msgLower.includes('quota') ||
    msgLower.includes('too many requests') ||
    msgLower.includes('resource_exhausted')
  ) {
    clientMessage = "I'm a little busy right now — please try again in a moment."
  } else if (
    msgLower.includes('econnrefused') ||
    msgLower.includes('etimedout') ||
    msgLower.includes('timeout') ||
    msgLower.includes('fetch failed') ||
    msgLower.includes('network') ||
    msgLower.includes('socket hang up')
  ) {
    clientMessage = "I'm having trouble connecting right now. Please try again shortly."
  } else if (
    status >= 500 ||
    msgLower.includes('bad gateway') ||
    msgLower.includes('service unavailable') ||
    msgLower.includes('503') ||
    msgLower.includes('500') ||
    msgLower.includes('overloaded') ||
    msgLower.includes('internal error') ||
    msgLower.includes('not configured')
  ) {
    clientMessage =
      "I'm temporarily unavailable. Please try again in a few minutes, or contact support if this continues."
  } else if (
    msgLower.includes('json') ||
    msgLower.includes('malformed') ||
    msgLower.includes('invalid response') ||
    msgLower.includes('parse') ||
    msgLower.includes('empty response')
  ) {
    clientMessage = "I didn't quite catch that — could you rephrase your question?"
  } else if (
    status === 401 ||
    msgLower.includes('api key') ||
    msgLower.includes('auth') ||
    msgLower.includes('unauthorized') ||
    msgLower.includes('invalid_api_key')
  ) {
    clientMessage =
      "I'm temporarily unavailable. Please try again in a few minutes, or contact support if this continues."
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    clientMessage,
  }
}

/**
 * POST /api/chatbot/query
 * Body: { messages: [{ role, content }], organizationId? (SUPER_ADMIN only) }
 */
const query = async (req, res) => {
  const { messages, organizationId: bodyOrgId } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    const msg = "I didn't quite catch that — could you rephrase your question?"
    return res.status(400).json({ error: msg, message: msg })
  }

  const valid = messages.every(
    (m) => m && m.role && typeof m.content === 'string' && m.content.length < 8000
  )
  if (!valid) {
    const msg = "I didn't quite catch that — could you rephrase your question?"
    return res.status(400).json({ error: msg, message: msg })
  }

  // Org scope from JWT — never trust client org for non-super-admins
  let organizationId = req.user.organizationId
  if (req.user.role === 'SUPER_ADMIN' && bodyOrgId) {
    organizationId = bodyOrgId
  }

  if (!organizationId && req.user.role !== 'SUPER_ADMIN') {
    const msg = 'Your account is not linked to an organization.'
    return res.status(403).json({ error: msg, message: msg })
  }

  const ctx = {
    organizationId: organizationId || null,
    role: req.user.role,
    userId: req.user.id,
  }

  try {
    const sanitized = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))

    const reply = await chat(sanitized, ctx)
    return res.json({ reply })
  } catch (err) {
    console.error('[chatbot server error detail]', {
      timestamp: new Date().toISOString(),
      message: err.message,
      status: err.status || err.statusCode,
      code: err.code,
      stack: err.stack,
      userId: req.user?.id,
    })

    const { status, clientMessage } = mapClientError(err)
    return res.status(status).json({ error: clientMessage, message: clientMessage })
  }
}

module.exports = { query }
