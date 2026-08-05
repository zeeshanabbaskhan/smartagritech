/**
 * useVoice.js
 * Encapsulates Web Speech API — voice recognition (STT) and speech synthesis (TTS).
 */
import { useState, useRef, useCallback, useEffect } from 'react'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export function useVoice({ onTranscript }) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceSupported] = useState(!!SpeechRecognition)
  const [ttsSupported] = useState(!!window.speechSynthesis)
  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const utteranceRef = useRef(null)

  // ── Clean up recognition on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening()
      stopSpeaking()
    }
  }, [])

  // ── Start voice recognition ───────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!voiceSupported || isListening) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('')
      const isFinal = event.results[event.results.length - 1].isFinal
      onTranscript(transcript, isFinal)
    }

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [voiceSupported, isListening, onTranscript])

  // ── Stop voice recognition ────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  // ── Toggle listening ──────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // ── Speak text (TTS) ──────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!ttsSupported || !text) return

    // Cancel any ongoing speech
    synthRef.current.cancel()

    // Strip markdown-style formatting for cleaner TTS
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, ' ')
      .trim()

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.volume = 1.0
    utterance.lang = 'en-US'

    // Prefer a natural English voice if available
    const voices = synthRef.current.getVoices()
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
    ) || voices.find(v => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    synthRef.current.speak(utterance)
  }, [ttsSupported])

  // ── Stop speaking ─────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [])

  return {
    isListening,
    isSpeaking,
    voiceSupported,
    ttsSupported,
    toggleListening,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  }
}
