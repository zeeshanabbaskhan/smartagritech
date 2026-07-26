import { useState, useRef, useEffect } from 'react'
import PageState, { useFetch } from '../../components/ui/PageState'
import { Send, Bot, User, Zap, TrendingUp, Activity, AlertTriangle } from 'lucide-react'
import emsApi, { list } from '../../api/emsApi'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import { useDevices } from '../../context/DeviceContext'
import { mapAnomaly } from '../../utils/mappers'

const quickQuestions = ["What's my peak demand?", 'Any anomalies this week?', 'How is my power factor?']

export default function UserAIAnalytics() {
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const { data: summary, loading, error, reload } = useFetch(async () => {
    const deviceId = selectedDeviceId
    if (!deviceId) return { stats: [], deviceId: null }
    const q = { deviceId, slaveId: selectedSlaveId || undefined, timeRange: '30d' }
    const [dashRes, energyRes, pfRes, predRes, anomRes] = await Promise.all([
      emsApi.getDashboardSummary(q).catch(() => null),
      emsApi.getAiEnergy(q).catch(() => null),
      emsApi.getAiPowerFactor(q).catch(() => null),
      emsApi.getAiPredictions({ deviceId, variableName: 'PowerConsumption' }).catch(() => null),
      emsApi.getAnomalies({ limit: 50 }).catch(() => null),
    ])
    const monthlyKwh = energyRes?.data?.totalConsumption ?? dashRes?.data?.totalPowerConsumption?.value
    const powerSeries = energyRes?.data?.chartData ?? dashRes?.data?.totalPowerConsumption?.chartData ?? []
    const peakKw = powerSeries.reduce((max, p) => Math.max(max, Number(p.value) || 0), 0)
    const avgPf = pfRes?.data?.current ?? dashRes?.data?.powerFactor?.value
    const anomalies = list(anomRes).map(mapAnomaly).filter((a) => !a.deviceId || a.deviceId === deviceId)
    const activeAnoms = anomalies.filter((a) => a.status === 'Active').length
    const predictions = predRes?.data?.predictions ?? predRes?.data ?? []
    const predCount = Array.isArray(predictions) ? predictions.length : 0
    const stats = [
      { label: 'Monthly Energy', value: monthlyKwh != null ? `${Number(monthlyKwh).toLocaleString()} units` : '—', icon: Zap, color: 'text-primary-600' },
      { label: 'Peak Demand', value: peakKw > 0 ? `${Number(peakKw).toFixed(1)} kW` : '—', icon: TrendingUp, color: 'text-primary-600' },
      { label: 'Avg Power Factor', value: avgPf != null ? Number(avgPf).toFixed(2) : '—', icon: Activity, color: 'text-success-600' },
      { label: 'Active Anomalies', value: String(activeAnoms), icon: AlertTriangle, color: 'text-danger-600' },
    ]
    return {
      stats,
      deviceId,
      monthlyKwh,
      peakKw,
      avgPf,
      activeAnoms,
      predCount,
      anomalies,
    }
  }, [selectedDeviceId, selectedSlaveId])

  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hello! Ask about your device's logged energy, power factor, anomalies, or forecast points. Answers use your real telemetry only." },
  ])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const buildReply = (msg, snap) => {
    const q = msg.toLowerCase()
    if (!snap?.deviceId) return 'Select a device first so I can load its telemetry.'
    if (q.includes('peak') || q.includes('demand')) {
      return snap.peakKw > 0
        ? `Peak measured demand for this device is ${Number(snap.peakKw).toFixed(1)} kW over the last 30 days.`
        : 'No peak demand readings are available for this device yet.'
    }
    if (q.includes('anomal')) {
      return snap.activeAnoms > 0
        ? `There ${snap.activeAnoms === 1 ? 'is' : 'are'} ${snap.activeAnoms} active anomal${snap.activeAnoms === 1 ? 'y' : 'ies'} on this device right now.`
        : 'No active anomalies are recorded for this device.'
    }
    if (q.includes('power factor') || q.includes('pf')) {
      return snap.avgPf != null
        ? `The latest power factor reading is ${Number(snap.avgPf).toFixed(2)}.`
        : 'No power factor readings are available for this device yet.'
    }
    if (q.includes('cost') || q.includes('reduce') || q.includes('save')) {
      return snap.monthlyKwh != null
        ? `Logged consumption for the period is ${Number(snap.monthlyKwh).toLocaleString()} units. Cost estimates need your configured tariff — check Slab Rates for the actual rate.`
        : 'No consumption data is available yet to discuss cost reduction.'
    }
    if (q.includes('forecast') || q.includes('predict')) {
      return snap.predCount > 0
        ? `There are ${snap.predCount} forecast points stored for Power Consumption on this device.`
        : 'No forecast points are stored for this device yet.'
    }
    if (snap.monthlyKwh != null) {
      return `Logged consumption is ${Number(snap.monthlyKwh).toLocaleString()} units. Peak demand is ${snap.peakKw > 0 ? `${Number(snap.peakKw).toFixed(1)} kW` : 'unavailable'}, power factor is ${snap.avgPf != null ? Number(snap.avgPf).toFixed(2) : 'unavailable'}, and there are ${snap.activeAnoms} active anomalies.`
    }
    return 'No logged analytics are available for this device yet.'
  }

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: msg }])
    setChatLoading(true)
    try {
      // Refresh snapshot so answers reflect latest API data
      let snap = summary
      if (summary?.deviceId) {
        const q = { deviceId: summary.deviceId, slaveId: selectedSlaveId || undefined, timeRange: '30d' }
        const [energyRes, pfRes, anomRes, predRes] = await Promise.all([
          emsApi.getAiEnergy(q).catch(() => null),
          emsApi.getAiPowerFactor(q).catch(() => null),
          emsApi.getAnomalies({ limit: 50 }).catch(() => null),
          emsApi.getAiPredictions({ deviceId: summary.deviceId, variableName: 'PowerConsumption' }).catch(() => null),
        ])
        const powerSeries = energyRes?.data?.chartData ?? []
        const predictions = predRes?.data?.predictions ?? predRes?.data ?? []
        const anomalies = list(anomRes).map(mapAnomaly).filter((a) => !a.deviceId || a.deviceId === summary.deviceId)
        snap = {
          deviceId: summary.deviceId,
          monthlyKwh: energyRes?.data?.totalConsumption ?? summary.monthlyKwh,
          peakKw: powerSeries.reduce((max, p) => Math.max(max, Number(p.value) || 0), 0) || summary.peakKw,
          avgPf: pfRes?.data?.current ?? summary.avgPf,
          activeAnoms: anomalies.filter((a) => a.status === 'Active').length,
          predCount: Array.isArray(predictions) ? predictions.length : summary.predCount,
        }
      }
      setMessages((prev) => [...prev, { role: 'assistant', text: buildReply(msg, snap) }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Unable to fetch analytics right now.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const stats = summary?.stats ?? []

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">AI Analytics</h2>
            <p className="breadcrumb">User / AI Analytics</p>
          </div>
          <span className="badge badge-info flex items-center gap-1"><Bot size={11} /> AI Powered</span>
        </div>

        <DeviceSlaveSelector onChange={reload} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card flex flex-col" style={{ minHeight: '500px' }}>
            <div className="p-4 border-b border-surface-200 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary-600/20 flex items-center justify-center"><Bot size={14} className="text-primary-600" /></div>
              <div>
                <p className="text-sm font-medium text-surface-800">Energy AI Assistant</p>
                <p className="text-xs text-success-500">● Online</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: '350px', maxHeight: '420px' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'assistant' ? 'bg-primary-600/20' : 'bg-surface-700'}`}>
                    {msg.role === 'assistant' ? <Bot size={13} className="text-primary-600" /> : <User size={13} className="text-surface-700" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === 'assistant' ? 'bg-surface-200 dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-tl-sm' : 'bg-primary-500/10 text-surface-900 dark:text-surface-100 border border-primary-500/20 rounded-tr-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary-600/20 flex items-center justify-center"><Bot size={13} className="text-primary-600" /></div>
                  <div className="bg-surface-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="p-4 border-t border-surface-200">
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Ask about energy consumption, anomalies, or power factor..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} />
                <button type="button" className="btn-primary px-3" onClick={() => sendMessage()} disabled={!input.trim() || chatLoading}><Send size={15} /></button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-4">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Quick Stats</p>
              <div className="space-y-3">
                {stats.length === 0 ? (
                  <p className="text-xs text-surface-500 p-3 inset-panel">Select a device to load stats.</p>
                ) : stats.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-center justify-between p-3 inset-panel">
                    <div className="flex items-center gap-2"><Icon size={14} className={color} /><span className="text-xs text-surface-500">{label}</span></div>
                    <span className={`text-xs font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Quick Questions</p>
              <div className="space-y-2">
                {quickQuestions.map((q) => (
                  <button key={q} type="button" className="w-full text-left text-xs text-surface-700 inset-panel hover:bg-surface-200 dark:hover:bg-surface-700 px-3 py-2.5 transition-colors" onClick={() => sendMessage(q)}>{q}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageState>
  )
}
