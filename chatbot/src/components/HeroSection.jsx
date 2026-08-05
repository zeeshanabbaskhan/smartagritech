import { Leaf, Cpu, Zap, Shield, TrendingUp, Bell } from 'lucide-react'

const features = [
  { icon: Cpu, label: 'IoT Device Monitoring', desc: 'Real-time sensor data from all connected devices' },
  { icon: Zap, label: 'Energy Analytics', desc: 'AI-powered insights on power factor & consumption' },
  { icon: Bell, label: 'Smart Alarms', desc: 'Instant alerts when thresholds are breached' },
  { icon: TrendingUp, label: 'AI Predictions', desc: 'Anomaly detection & voltage imbalance analysis' },
  { icon: Shield, label: 'Secure Access', desc: 'Role-based access for admin, org & users' },
  { icon: Leaf, label: 'Smart Agriculture', desc: 'Optimized energy for sustainable farming' },
]

export default function HeroSection() {
  return (
    <main className="hero">
      {/* Background orbs */}
      <div className="hero-orb orb-1" />
      <div className="hero-orb orb-2" />
      <div className="hero-orb orb-3" />

      <div className="hero-content">
        {/* Logo / brand */}
        <div className="hero-brand">
          <div className="hero-logo">
            <Leaf size={28} strokeWidth={2} />
          </div>
          <span className="hero-brand-name">SmartAgriTech</span>
          <span className="hero-brand-badge">EMS Platform</span>
        </div>

        <h1 className="hero-title">
          Your AI-Powered<br />
          <span className="hero-title-accent">Energy Management</span><br />
          Assistant
        </h1>

        <p className="hero-subtitle">
          Ask questions about your devices, alarms, sensor data, and energy analytics
          — by typing or using your voice. Available 24/7.
        </p>

        <div className="hero-cta">
          <div className="hero-cta-hint">
            <span className="hero-cta-arrow">→</span>
            Click the chat bubble in the <strong>bottom-right corner</strong> to start
          </div>
        </div>

        {/* Feature grid */}
        <div className="feature-grid">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="feature-card">
              <div className="feature-icon">
                <Icon size={18} />
              </div>
              <div>
                <div className="feature-label">{label}</div>
                <div className="feature-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="hero-footer-note">
          This chatbot runs on <strong>Groq (LLaMA 3.3)</strong> or <strong>Gemini 1.5 Flash</strong> — free-tier AI APIs.
          Configure your key in <code>chatbot/.env.local</code>.
        </p>
      </div>
    </main>
  )
}
