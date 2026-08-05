import { useState, useRef, useEffect } from 'react'
import {
  MessageCircle, X, Send, Mic, MicOff, Volume2, VolumeX,
  RotateCcw, Bot, User, ChevronDown, Sparkles, Loader2,
  AlertCircle, Zap
} from 'lucide-react'
import { useChatbot } from '../hooks/useChatbot'
import { providerName, modelName } from '../services/aiService'
import { formatTime, renderMarkdown } from '../utils/formatters'

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const chatBodyRef = useRef(null)

  const {
    messages,
    input,
    setInput,
    isLoading,
    voiceEnabled,
    setVoiceEnabled,
    isListening,
    isSpeaking,
    voiceSupported,
    ttsSupported,
    messagesEndRef,
    suggestedQuestions,
    isConfigured,
    handleSend,
    handleKeyDown,
    clearChat,
    toggleListening,
    stopSpeaking,
  } = useChatbot()

  // ── Scroll detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = chatBodyRef.current
    if (!el) return
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(distFromBottom > 80)
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const onlyWelcome = messages.length === 1

  return (
    <>
      {/* ── Floating Action Button ─────────────────────────────────────────── */}
      <button
        id="chatbot-fab"
        aria-label="Open AI Assistant"
        onClick={() => setIsOpen(o => !o)}
        className={`chatbot-fab ${isOpen ? 'chatbot-fab-open' : ''}`}
      >
        {isSpeaking && (
          <span className="chatbot-fab-ring speaking-ring" />
        )}
        {isListening && (
          <span className="chatbot-fab-ring listening-ring" />
        )}
        <span className="chatbot-fab-icon">
          {isOpen
            ? <X size={22} strokeWidth={2.5} />
            : <MessageCircle size={22} strokeWidth={2} />
          }
        </span>
        {!isOpen && <span className="chatbot-fab-pulse" />}
      </button>

      {/* ── Chat Panel ────────────────────────────────────────────────────── */}
      <div className={`chatbot-panel ${isOpen ? 'chatbot-panel-open' : ''}`}>

        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <div className="chatbot-avatar">
              <Bot size={16} />
              <span className={`chatbot-status-dot ${isConfigured ? 'dot-online' : 'dot-offline'}`} />
            </div>
            <div>
              <div className="chatbot-header-title">SmartAgriTech AI</div>
              <div className="chatbot-header-sub">
                {isSpeaking
                  ? '🔊 Speaking…'
                  : isListening
                  ? '🎙️ Listening…'
                  : isLoading
                  ? '⚡ Thinking…'
                  : isConfigured
                  ? `${providerName} · ${modelName}`
                  : '⚠️ API key not set'}
              </div>
            </div>
          </div>
          <div className="chatbot-header-actions">
            {/* Voice output toggle */}
            {ttsSupported && (
              <button
                id="chatbot-tts-toggle"
                aria-label={voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
                onClick={() => { setVoiceEnabled(v => !v); if (isSpeaking) stopSpeaking() }}
                className={`chatbot-icon-btn ${voiceEnabled ? 'icon-btn-active' : ''}`}
                title={voiceEnabled ? 'Voice output ON' : 'Voice output OFF'}
              >
                {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            )}
            {/* Clear chat */}
            <button
              id="chatbot-clear"
              aria-label="Clear chat"
              onClick={clearChat}
              className="chatbot-icon-btn"
              title="Clear conversation"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {/* API not configured warning */}
        {!isConfigured && (
          <div className="chatbot-warning">
            <AlertCircle size={14} />
            <span>
              Set your API key in <code>chatbot/.env.local</code> to enable AI responses.
            </span>
          </div>
        )}

        {/* Messages */}
        <div ref={chatBodyRef} className="chatbot-body">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`chatbot-message ${msg.role === 'user' ? 'msg-user' : 'msg-bot'} ${msg.isError ? 'msg-error' : ''}`}
              style={{ animationDelay: `${idx * 0.02}s` }}
            >
              {msg.role === 'assistant' && (
                <div className="msg-avatar bot-avatar">
                  <Bot size={12} />
                </div>
              )}
              <div className="msg-bubble">
                <div
                  className="msg-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
                <div className="msg-time">{formatTime(msg.timestamp)}</div>
              </div>
              {msg.role === 'user' && (
                <div className="msg-avatar user-avatar">
                  <User size={12} />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="chatbot-message msg-bot">
              <div className="msg-avatar bot-avatar">
                <Bot size={12} />
              </div>
              <div className="msg-bubble typing-bubble">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          {/* Suggested questions — only on fresh chat */}
          {onlyWelcome && !isLoading && (
            <div className="chatbot-suggestions">
              <div className="suggestions-label">
                <Sparkles size={12} /> Try asking…
              </div>
              <div className="suggestions-grid">
                {suggestedQuestions.map(q => (
                  <button
                    key={q}
                    className="suggestion-chip"
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            id="chatbot-scroll-btn"
            aria-label="Scroll to latest"
            className="scroll-to-bottom-btn"
            onClick={scrollToBottom}
          >
            <ChevronDown size={16} />
          </button>
        )}

        {/* Speaking indicator bar */}
        {isSpeaking && (
          <div className="speaking-bar">
            <div className="waveform">
              {[...Array(7)].map((_, i) => (
                <span key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <span className="speaking-label">Speaking</span>
            <button
              id="chatbot-stop-speaking"
              className="stop-speaking-btn"
              onClick={stopSpeaking}
              aria-label="Stop speaking"
            >
              Stop
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="chatbot-footer">
          <div className={`chatbot-input-row ${isListening ? 'input-listening' : ''}`}>
            <textarea
              id="chatbot-input"
              className="chatbot-textarea"
              placeholder={isListening ? 'Listening… speak now' : 'Ask me anything…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
              aria-label="Chat input"
            />

            {/* Mic button */}
            {voiceSupported && (
              <button
                id="chatbot-mic-btn"
                aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                onClick={toggleListening}
                className={`chatbot-action-btn mic-btn ${isListening ? 'mic-active' : ''}`}
                title={isListening ? 'Click to stop recording' : 'Click to speak'}
              >
                {isListening
                  ? <MicOff size={16} />
                  : <Mic size={16} />
                }
                {isListening && <span className="mic-pulse-ring" />}
              </button>
            )}

            {/* Send button */}
            <button
              id="chatbot-send-btn"
              aria-label="Send message"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="chatbot-action-btn send-btn"
              title="Send (Enter)"
            >
              {isLoading
                ? <Loader2 size={16} className="spin" />
                : <Send size={16} />
              }
            </button>
          </div>
          <div className="chatbot-footer-note">
            <Zap size={10} /> Powered by SmartAgriTech AI · Press Enter to send
          </div>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="chatbot-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
