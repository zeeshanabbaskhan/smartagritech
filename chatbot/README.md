# SmartAgriTech AI Chatbot — Voice-Enabled Dashboard Assistant

A standalone, beautiful AI chatbot with **voice input + voice output** for the SmartAgriTech EMS dashboard.
Built as a **separate folder** — it does NOT modify any existing project files.

## ✨ Features
- 🤖 AI-powered responses via **Groq (LLaMA 3.3)** or **Google Gemini 1.5 Flash** (both free-tier)
- 🎙️ **Voice input** — click the mic and speak your question (Web Speech API)
- 🔊 **Voice output** — bot reads responses aloud (browser TTS, no API key needed)
- 💬 Rich **markdown rendering** in chat (bold, lists, code)
- ✨ Animated **waveform** while speaking, pulsing ring while listening
- 💡 **Suggested questions** on first open
- 🌙 Beautiful **dark UI** matching the main dashboard theme (amber/gold + dark navy)
- 📱 Fully **responsive** — works on mobile
- 🔒 Only **reads** data — never writes to or modifies the existing project

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd chatbot
npm install
```

### 2. Configure your AI key
Copy `.env.example` to `.env.local` and add your API key:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

**Option A — Groq (recommended, fastest):**
Get a free key at https://console.groq.com
```
VITE_AI_PROVIDER=groq
VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

**Option B — Google Gemini:**
Get a free key at https://aistudio.google.com
```
VITE_AI_PROVIDER=gemini
VITE_GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxx
```

### 3. Run
```bash
npm run dev
```
Opens at http://localhost:5174

## 🗂️ Folder Structure
```
chatbot/
├── src/
│   ├── components/
│   │   ├── ChatbotWidget.jsx   ← Main floating chat widget
│   │   └── HeroSection.jsx     ← Landing page
│   ├── hooks/
│   │   ├── useChatbot.js       ← Chat state management
│   │   └── useVoice.js         ← Web Speech API (STT + TTS)
│   ├── services/
│   │   └── aiService.js        ← Groq / Gemini API calls
│   ├── utils/
│   │   └── formatters.js       ← Markdown renderer & time format
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css               ← All styles
├── index.html
├── vite.config.js
├── package.json
├── .env.example
└── .gitignore
```

## 🎙️ Voice Usage
1. Click the **mic button** in the chat input — browser will ask for microphone permission
2. Speak your question clearly
3. The transcript appears in real time; it auto-sends when you finish speaking
4. The bot's response will be **read aloud** automatically (if voice output is ON)
5. Click the 🔊 button in the header to toggle voice output on/off
6. Click **Stop** in the green speaking bar to interrupt the bot

## 🔧 Supported Browsers
Voice input/output uses the Web Speech API:
- ✅ Chrome / Edge (best support)
- ✅ Safari 15+
- ⚠️ Firefox (TTS only, no STT)

## 📝 Notes
- This folder is **self-contained** — no files in the main project are changed
- The chatbot is pre-loaded with SmartAgriTech context (devices, alarms, energy analytics, etc.)
- To embed this into the main dashboard in the future, copy `ChatbotWidget.jsx` into `web_frontend/src/components/chatbot/`
