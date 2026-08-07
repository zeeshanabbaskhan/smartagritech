/**
 * Elsa AI engine — Groq / Gemini tool-calling against Prisma-backed tools.
 */

const Groq = require('groq-sdk')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { callTool } = require('./chatbotTools')
const billingTools = require('./billingTools')

async function dispatchTool(name, args, ctx) {
  try {
    if (billingTools[name]) return await billingTools[name](args || {}, ctx)
    return await callTool(name, args || {}, ctx)
  } catch (err) {
    console.error(`[chatbot dispatch] ${name}`, err)
    return { error: err.message }
  }
}

const PROVIDER = process.env.AI_PROVIDER || 'groq'

const SYSTEM_PROMPT = `You are Elsa — a knowledgeable, friendly energy assistant for the Elsa Energy EMS (Energy Management System) platform.

You have access to REAL live data tools that query the EMS database for the logged-in user's organization. ALWAYS use these tools to answer data or billing questions — NEVER guess or estimate any PKR, kWh, or percentage figure on your own.

ABOUT THE PLATFORM:
- IoT-based Energy Management System (Elsa Energy) for smart agriculture and industrial facilities
- Monitors real-time sensor data: voltage, current, power factor, energy consumption, frequency
- Manages gateways, devices, alarms, and interval energy histories
- All answers are scoped to the authenticated user's organization

TOOL USAGE RULES:
- Always call a tool when asked about devices, alarms, energy data, gateways, or billing
- You may pass orgName when helpful, but tools already scope to the user's organization
- Use getVariableValue for specific sensor readings (VoltageA, PowerFactor, etc.)
- Use getActiveAlarms for alarm queries — filter by ACTIVE or RESOLVED
- Use getEnergyConsumption for recent kWh questions (last N days)
- Use getOrgSummary for org-level overview questions
- Use getGatewayStatus when asked about offline/online gateways
- BILLING TOOLS (use these for cost/budget questions):
  • compareMonthlyBills — "this month vs last month"
  • getMonthlyBill(monthOffset=0) — current month bill; (monthOffset=1) — last month
  • getTopConsumingDevices — "which device uses most / costs most"
  • getDailyConsumptionBreakdown — "highest usage day" / "daily breakdown"
  • forecastMonthlyBill — "am I on track" / "what will my bill be"
  • getPowerFactorImpact — "is low power factor costing me"
  • simulateConsumptionReduction — "what if I cut [device] by X%"
  • getBudgetPlan — "how to keep bill under Rs. X" / "save 15% next month"

ACCURACY RULE: Every PKR, kWh, or percentage figure you state MUST come from a tool result. Never invent or round-estimate billing numbers.

RESPONSE STYLE:
- Be concise, warm, and professional
- Format numbers clearly with units (e.g. "228.78 V", "13.93 kWh", "PKR 445.39")
- For lists, use bullet points
- After data answers, offer to help with related queries
- Keep responses under 200 words unless detailed steps are requested`

const TOOL_SCHEMAS_OPENAI = [
  {
    type: 'function',
    function: {
      name: 'getOrgSummary',
      description: 'Get a summary of the organization: device count, online/offline status, gateways',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional; scoped automatically)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listDevicesForOrg',
      description: 'List all devices for the organization, optionally filtered by status',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          statusFilter: { type: 'string', enum: ['ONLINE', 'OFFLINE'], description: 'Filter by device status' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDeviceStatus',
      description: 'Get the status, gateway, and last-seen info of a specific device',
      parameters: {
        type: 'object',
        properties: {
          deviceName: { type: 'string', description: 'Device name (partial match ok)' },
          orgName: { type: 'string', description: 'Organization name (optional)' },
        },
        required: ['deviceName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getVariableValue',
      description: 'Get the current sensor value(s) of a variable on a device (e.g. VoltageA, PowerFactor, ActivePower)',
      parameters: {
        type: 'object',
        properties: {
          deviceName: { type: 'string', description: 'Device name (partial match ok)' },
          variableName: { type: 'string', description: 'Variable name, e.g. VoltageA, PowerFactor' },
        },
        required: ['deviceName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getActiveAlarms',
      description: 'Get recent alarm history, optionally filtered by alarm state',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          alarmState: { type: 'string', enum: ['ACTIVE', 'RESOLVED'], description: 'Filter by alarm state' },
          limit: { type: 'number', description: 'Max number of alarms to return' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getEnergyConsumption',
      description: 'Get energy consumption (kWh) and tariff data from interval history',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          deviceName: { type: 'string', description: 'Specific device name (optional)' },
          lastDays: { type: 'number', description: 'Number of recent days to include' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getGatewayStatus',
      description: 'Get gateway status, optionally filtered by online/offline',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          statusFilter: {
            type: 'string',
            enum: ['ONLINE', 'OFFLINE', 'GATEWAY_ALARM'],
            description: 'Filter by gateway status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUserDevices',
      description: 'Get all devices assigned to a specific user by their email address',
      parameters: {
        type: 'object',
        properties: {
          userEmail: { type: 'string', description: 'User email address' },
        },
        required: ['userEmail'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMonthlyBill',
      description:
        'Get monthly energy bill (total kWh, total PKR cost, and per-device breakdown). monthOffset=0 current month-to-date, 1 last month.',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          monthOffset: { type: 'string', description: '0 current, 1 last month (default 0)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compareMonthlyBills',
      description: 'Compare current month-to-date bill vs same period last month and full last month bill.',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTopConsumingDevices',
      description: 'Get top energy consuming devices ranked by total cost (PKR) and kWh over a period.',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          periodDays: { type: 'string', description: 'Number of days (default 30)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getDailyConsumptionBreakdown',
      description: 'Get daily energy cost/kWh breakdown and identify highest usage days.',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          periodDays: { type: 'string', description: 'Number of days (default 30)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forecastMonthlyBill',
      description: 'Forecast full monthly bill based on current month average daily cost.',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPowerFactorImpact',
      description: 'Analyze power factor alarms and low power factor readings for devices.',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulateConsumptionReduction',
      description: 'Simulate bill savings if energy consumption on a specific device is reduced by X%.',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          deviceName: { type: 'string', description: 'Device name' },
          percentReduction: { type: 'string', description: 'Percentage reduction e.g. 20' },
          periodDays: { type: 'string', description: 'Period in days (default 30)' },
        },
        required: ['deviceName', 'percentReduction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getBudgetPlan',
      description: 'Check if forecasted bill exceeds a target budget and generate a device-by-device cut plan.',
      parameters: {
        type: 'object',
        properties: {
          orgName: { type: 'string', description: 'Organization name (optional)' },
          targetAmountPKR: { type: 'string', description: 'Target monthly budget in PKR' },
        },
        required: ['targetAmountPKR'],
      },
    },
  },
]

async function callGroq(messages, ctx) {
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(new Error('GROQ_API_KEY is not configured'), { status: 503 })
  }

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  const allMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]

  for (let i = 0; i < 5; i++) {
    let response
    let attempts = 0
    while (attempts < 5) {
      try {
        response = await client.chat.completions.create({
          model,
          messages: allMessages,
          tools: TOOL_SCHEMAS_OPENAI,
          tool_choice: 'auto',
          max_tokens: 1024,
          temperature: 0.4,
        })
        break
      } catch (err) {
        if (err.status === 429 || err.message?.includes('rate_limit') || err.message?.includes('Rate limit')) {
          console.log(`[groq 429] attempt ${attempts + 1}/5 waiting 10s...`)
          await new Promise((r) => setTimeout(r, 10000))
          attempts++
        } else {
          throw err
        }
      }
    }

    if (!response?.choices?.length) {
      throw new Error('Groq API returned an empty response after retries.')
    }

    const choice = response.choices[0]

    if (choice.finish_reason === 'tool_calls' || choice.message?.tool_calls?.length) {
      allMessages.push(choice.message)

      for (const tc of choice.message.tool_calls) {
        let args = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        } catch {
          args = {}
        }
        const result = await dispatchTool(tc.function.name, args, ctx)
        console.log(`[tool] ${tc.function.name}(${JSON.stringify(args)}) →`, JSON.stringify(result).slice(0, 120))

        allMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        })
      }
      continue
    }

    return choice.message.content
  }

  return 'I was unable to complete the query. Please try rephrasing your question.'
}

const TOOL_SCHEMAS_GEMINI = TOOL_SCHEMAS_OPENAI.map((t) => ({
  name: t.function.name,
  description: t.function.description,
  parameters: {
    type: 'OBJECT',
    properties: Object.fromEntries(
      Object.entries(t.function.parameters.properties || {}).map(([k, v]) => [
        k,
        {
          type: (v.type || 'string').toUpperCase(),
          description: v.description,
          ...(v.enum ? { enum: v.enum } : {}),
        },
      ])
    ),
    required: t.function.parameters.required || [],
  },
}))

async function callGemini(messages, ctx) {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured'), { status: 503 })
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: TOOL_SCHEMAS_GEMINI }],
  })

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const lastMsg = messages[messages.length - 1].content
  const chatSession = model.startChat({ history })

  for (let i = 0; i < 5; i++) {
    const result = i === 0 ? await chatSession.sendMessage(lastMsg) : await chatSession.sendMessage('continue')
    const response = result.response
    const parts = response.candidates?.[0]?.content?.parts || []

    const funcCalls = parts.filter((p) => p.functionCall)
    if (funcCalls.length > 0) {
      const toolResults = []
      for (const p of funcCalls) {
        const toolResult = await dispatchTool(p.functionCall.name, p.functionCall.args || {}, ctx)
        toolResults.push({
          functionResponse: {
            name: p.functionCall.name,
            response: toolResult,
          },
        })
      }
      console.log(
        '[gemini tools]',
        funcCalls.map((p) => p.functionCall.name)
      )
      await chatSession.sendMessage(toolResults)
      const finalResult = await chatSession.sendMessage(
        'Based on the tool results, please provide your answer.'
      )
      const textParts = finalResult.response.candidates?.[0]?.content?.parts || []
      const text = textParts.filter((p) => p.text).map((p) => p.text).join('')
      if (text) return text
      continue
    }

    const text = parts.filter((p) => p.text).map((p) => p.text).join('')
    if (text) return text
  }

  return 'I was unable to complete the query. Please try rephrasing your question.'
}

async function chat(messages, ctx = {}) {
  if (PROVIDER === 'gemini') return callGemini(messages, ctx)
  return callGroq(messages, ctx)
}

module.exports = { chat }
