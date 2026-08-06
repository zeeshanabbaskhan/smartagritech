/**
 * aiService.js  — Phase C (updated)
 *
 * No longer calls Groq/Gemini directly from the browser.
 * All AI calls are now proxied through the chatbot microserver at
 * http://localhost:5175 — API keys live only on the server.
 */

const SERVER_URL = import.meta.env.VITE_CHATBOT_SERVER_URL || 'http://localhost:5175'

export async function sendMessage(messages) {
  const res = await fetch(`${SERVER_URL}/api/chatbot/query`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messages }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Server error: ${res.status}`)
  }

  const data = await res.json()
  return data.reply
}

export const providerName = 'Groq (LLaMA 3.3)'
export const modelName    = 'llama-3.3-70b-versatile'
export const isConfigured = true   // server handles key validation

