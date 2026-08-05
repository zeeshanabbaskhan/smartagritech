/**
 * aiService.js
 * Unified AI client supporting Groq and Gemini.
 * Reads config from Vite env vars (VITE_AI_PROVIDER, VITE_GROQ_API_KEY, etc.)
 */

const PROVIDER = import.meta.env.VITE_AI_PROVIDER || 'groq'
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile'
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash'

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the SmartAgriTech AI Assistant — a helpful, friendly, and knowledgeable support agent for the SmartAgriTech EMS (Energy Management System) platform.

ABOUT THE PLATFORM:
SmartAgriTech is an IoT-based Energy Management System designed for smart agriculture and industrial facilities. It allows organizations to:
- Monitor real-time sensor data from IoT devices (energy meters, flow sensors, temperature, humidity, etc.)
- Set up alarms and notifications for critical thresholds
- Analyze AI-powered analytics: voltage imbalance, current imbalance, power factor, energy consumption anomalies
- Manage gateways, MQTT bridges, and device templates
- View historical sensor data and interval history
- Manage user subscriptions and slab rates
- Build custom dashboards with drag-and-drop widgets
- Schedule automated tasks
- Monitor power flow via mind-map visualization

ROLES:
- Super Admin: Full platform access — manage organizations, users, devices, templates
- Org Admin: Manage own organization's devices, gateways, analytics
- End User: View dashboards, receive alarms, track energy consumption

COMMON USER QUERIES YOU HANDLE:
- How to add/configure a device or gateway
- How to set up alarms and alarm contacts
- Understanding sensor readings (voltage, current, power factor, kWh)
- Navigating the dashboard sections
- Subscription and billing questions
- AI analytics explanations (what is voltage imbalance, etc.)
- MQTT bridge configuration
- Historical data export
- Schedule tasks setup
- Troubleshooting offline devices

RESPONSE STYLE:
- Be concise, warm, and professional
- Use simple language (avoid jargon unless the user asks for technical details)
- Use bullet points or numbered steps for instructions
- If you don't know something specific about this deployment, say so and offer to escalate
- Keep responses under 200 words unless the user asks for detailed steps
- Always end with a follow-up question or offer to help further`

// ─── Groq API ─────────────────────────────────────────────────────────────────
async function callGroq(messages) {
  if (!GROQ_KEY || GROQ_KEY === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY not configured. Please set VITE_GROQ_API_KEY in your .env.local file.')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 512,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'
}

// ─── Gemini API ───────────────────────────────────────────────────────────────
async function callGemini(messages) {
  if (!GEMINI_KEY || GEMINI_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY not configured. Please set VITE_GEMINI_API_KEY in your .env.local file.')
  }

  // Convert OpenAI-style messages to Gemini format
  const geminiContents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  // Prepend system prompt as a user turn (Gemini 1.5 supports systemInstruction)
  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: geminiContents,
    generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.7,
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.'
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function sendMessage(messages) {
  if (PROVIDER === 'gemini') {
    return callGemini(messages)
  }
  return callGroq(messages)
}

export const providerName = PROVIDER === 'gemini' ? 'Gemini' : 'Groq'
export const modelName = PROVIDER === 'gemini' ? GEMINI_MODEL : GROQ_MODEL
export const isConfigured = PROVIDER === 'gemini'
  ? (!!GEMINI_KEY && GEMINI_KEY !== 'your_gemini_api_key_here')
  : (!!GROQ_KEY && GROQ_KEY !== 'your_groq_api_key_here')
