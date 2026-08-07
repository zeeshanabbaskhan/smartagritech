/**
 * useChatbot.js
 * Core chatbot state management — messages, AI calls, voice integration.
 */
import { useState, useCallback, useRef } from 'react'
import { sendMessage, isConfigured } from './aiService'
import { useVoice } from './useVoice'

const SUGGESTED_QUESTIONS = [
  'Give me a summary of my organization',
  'Which devices are offline?',
  'Show my active alarms',
  'What is my energy use this month?',
  'Which devices cost the most?',
  'Forecast my monthly bill',
]

export function useChatbot() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! 👋 I'm **Elsa**, your energy assistant. I can help you with devices, alarms, energy analytics, billing, and cost savings. How can I assist you today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const messagesEndRef = useRef(null)

  // ── Voice integration ─────────────────────────────────────────────────────
  const { isListening, isSpeaking, voiceSupported, ttsSupported, toggleListening, speak, stopSpeaking } =
    useVoice({
      onTranscript: (text, isFinal) => {
        setInput(text)
        if (isFinal && text.trim()) {
          // Small delay so the user sees the final text before it sends
          setTimeout(() => handleSend(text), 400)
        }
      },
    })

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [])

  // ── Send a message ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || isLoading) return

    setInput('')
    setError(null)

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    scrollToBottom()

    try {
      // Build conversation history for the API (exclude welcome message)
      const history = [...messages.filter(m => m.id !== 'welcome'), userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const reply = await sendMessage(history)

      const botMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, botMsg])
      scrollToBottom()

      // Speak the response if voice output is enabled
      if (voiceEnabled && ttsSupported) {
        speak(reply)
      }
    } catch (err) {
      const errText = err.message || 'Something went wrong. Please try again.'
      setError(errText)
      const botErr = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: errText,
        timestamp: new Date(),
        isError: true,
      }
      setMessages(prev => [...prev, botErr])
      scrollToBottom()
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, voiceEnabled, ttsSupported, speak, scrollToBottom])

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // ── Clear chat ────────────────────────────────────────────────────────────
  const clearChat = useCallback(() => {
    stopSpeaking()
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Hello! 👋 I'm **Elsa**, your energy assistant. I can help you with devices, alarms, energy analytics, billing, and cost savings. How can I assist you today?",
      timestamp: new Date(),
    }])
    setError(null)
  }, [stopSpeaking])

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    voiceEnabled,
    setVoiceEnabled,
    isListening,
    isSpeaking,
    voiceSupported,
    ttsSupported,
    messagesEndRef,
    suggestedQuestions: SUGGESTED_QUESTIONS,
    isConfigured,
    handleSend,
    handleKeyDown,
    clearChat,
    toggleListening,
    stopSpeaking,
  }
}
