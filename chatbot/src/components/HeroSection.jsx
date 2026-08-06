import { Leaf, Cpu, Zap, Shield, TrendingUp, Bell } from 'lucide-react'

const features = [
  { icon: Cpu, label: 'IoT Device Monitoring', desc: 'Real-time sensor data from all connected devices' },
  { icon: Zap, label: 'Energy Analytics', desc: 'Instant insights on power factor & consumption' },
  { icon: Bell, label: 'Smart Alarms', desc: 'Instant alerts when thresholds are breached' },
  { icon: TrendingUp, label: 'Energy Forecasting', desc: 'Bill projections & consumption reduction models' },
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
            <img src="/elsa_logo.jpeg" alt="Elsa Energy" style={{ width: '100%', height: '100%', borderRadius: '6px', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none' }} />
          </div>
          <span className="hero-brand-name">Elsa Energy</span>
          <span className="hero-brand-badge">EMS Platform</span>
        </div>

        <h1 className="hero-title">
          Meet <span className="hero-title-accent">Elsa</span><br />
          Your Smart Energy<br />
          Assistant
        </h1>

        <p className="hero-subtitle">
          Ask Elsa questions about your devices, alarms, sensor data, billing breakdown, and cost-saving plans — by typing or using voice. Available 24/7.
        </p>

        <div className="hero-cta">
          <div className="hero-cta-hint">
            <span className="hero-cta-arrow">→</span>
            Click the chat bubble in the <strong>bottom-right corner</strong> to speak with Elsa
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
          Elsa Energy Assistant — Voice & text-enabled intelligence for energy optimization.
        </p>
      </div>
    </main>
  )
}
