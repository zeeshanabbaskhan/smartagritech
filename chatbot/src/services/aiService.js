/**
 * aiService.js
 *
 * Calls the chatbot server endpoint at http://localhost:5175.
 * API keys and AI engine calls are handled entirely on the backend server.
 */

const SERVER_URL = import.meta.env.VITE_CHATBOT_SERVER_URL || 'http://localhost:5175'

export async function sendMessage(messages) {
  try {
    const res = await fetch(`${SERVER_URL}/api/chatbot/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || "I'm having trouble connecting right now. Please try again shortly.")
    }

    const data = await res.json()
    return data.reply
  } catch (err) {
    if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError') && !err.message.includes('HTTP')) {
      throw err
    }
    throw new Error("I'm having trouble connecting right now. Please try again shortly.")
  }
}

export const isConfigured = true
