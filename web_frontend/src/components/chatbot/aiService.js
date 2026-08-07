/**
 * Elsa chatbot client — calls authenticated EMS backend.
 */
import emsApi from '../../api/emsApi'

export async function sendMessage(messages) {
  try {
    const data = await emsApi.chatbotQuery(messages)
    if (!data?.reply) {
      throw new Error("I didn't quite catch that — could you rephrase your question?")
    }
    return data.reply
  } catch (err) {
    const msg = err?.message || ''
    if (
      msg &&
      !msg.includes('fetch') &&
      !msg.includes('Failed to fetch') &&
      !msg.includes('NetworkError') &&
      !/^Request failed \(\d+\)$/.test(msg)
    ) {
      throw new Error(msg)
    }
    throw new Error("I'm having trouble connecting right now. Please try again shortly.")
  }
}

export const isConfigured = true
