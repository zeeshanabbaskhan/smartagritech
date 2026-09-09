import { useEffect, useMemo } from 'react'
import {
  Download,
  Zap,
  Activity,
  Heart,
  TrendingUp,
  AlertTriangle,
  Waves,
  Radio,
  Cpu,
  Layers,
  Image as ImageIcon,
} from 'lucide-react'
import MetricRangeCard from '../../components/ui/MetricRangeCard'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi, { list } from '../../api/emsApi'
import { mapAnomaly } from '../../utils/mappers'
import { onSocketEvent, subscribeDevice } from '../../services/socketService'

function fmt(v, digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return '0.00'
  return Number(v).toFixed(digits)
}

function toRangeSeries(points = []) {
  const mapped = (Array.isArray(points) ? points : []).map((p) => ({
    t: p.time ?? p.t ?? p.label ?? '',
    v: Number(p.value ?? p.v ?? 0) || 0,
  }))
  return { '1h': mapped, '24h': mapped, '7d': mapped, '30d': mapped }
}

function pickValue(block) {
  if (block == null) return null
  if (typeof block === 'number') return block
  return block.value ?? block.current ?? null
}

function norm(s) {
  return String(s || '').replace(/[\s_\-()]+/g, '').toLowerCase()
}

function pickMetric(metrics = {}, candidateNames = []) {
  if (!metrics || typeof metrics !== 'object') return null
  for (const name of candidateNames) {
    if (metrics[name]?.value != null && metrics[name]?.value !== '') {
      const num = Number(metrics[name].value)
      if (Number.isFinite(num)) return num
    }
  }
  const keys = Object.keys(metrics)
  for (const name of candidateNames) {
    const target = norm(name)
    const found = keys.find((k) => norm(k) === target)
    if (found && metrics[found]?.value != null && metrics[found]?.value !== '') {
      const num = Number(metrics[found].value)
      if (Number.isFinite(num)) return num
    }
  }
  return null
}

export default function UserDashboard() {
  const { devices, slaves, selectedDeviceId, selectedSlaveId, setSelectedSlaveId } = useDevices()

  const { data, loading, error, reload } = useFetch(async () => {
    if (!selectedDeviceId) {
      return { metrics: {}, anomalyCount: 0 }
    }
    const q = { deviceId: selectedDeviceId, slaveId: selectedSlaveId || undefined, timeRange: '24h' }
    const [summaryRes, voltRes, curRes, pfRes, energyRes, anomRes] = await Promise.all([
      emsApi.getDashboardSummary(q).catch(() => null),
      emsApi.getAiVoltage(q).catch(() => null),
      emsApi.getAiCurrent(q).catch(() => null),
      emsApi.getAiPowerFactor(q).catch(() => null),
      emsApi.getAiEnergy(q).catch(() => null),
      emsApi.getAnomalies({ limit: 50 }).catch(() => null),
    ])
    const s = summaryRes?.data ?? {}
    const anomalies = list(anomRes).map(mapAnomaly).filter((a) => !a.deviceId || a.deviceId === selectedDeviceId)
    return {
      metrics: {
        totalPower: pickValue(s.totalPowerConsumption) ?? energyRes?.data?.totalConsumption,
        exportPower: pickValue(s.totalExportPower) ?? energyRes?.data?.totalExport,
        voltageImbalance: voltRes?.data?.current ?? pickValue(s.voltageImbalance),
        currentImbalance: curRes?.data?.current ?? pickValue(s.currentImbalance),
        powerFactor: pfRes?.data?.current ?? pickValue(s.powerFactor),
        predicted: pickValue(s.predictedConsumption),
        thdV: pickValue(s.thdV),
        thdI: pickValue(s.thdI),
        frequency: pickValue(s.frequency),
        charts: {
          totalPower: toRangeSeries(s.totalPowerConsumption?.chartData ?? energyRes?.data?.chartData),
          exportPower: toRangeSeries(s.totalExportPower?.chartData),
          voltageImbalance: toRangeSeries(voltRes?.data?.chartData?.voltageImbalance ?? s.voltageImbalance?.chartData),
          currentImbalance: toRangeSeries(curRes?.data?.chartData?.currentImbalance ?? s.currentImbalance?.chartData),
          powerFactor: toRangeSeries(pfRes?.data?.chartData ?? s.powerFactor?.chartData),
          predicted: toRangeSeries(s.predictedConsumption?.chartData),
          thdV: toRangeSeries(s.thdV?.chartData),
          thdI: toRangeSeries(s.thdI?.chartData),
          frequency: toRangeSeries(s.frequency?.chartData),
        },
      },
      anomalyCount: anomalies.length,
    }
  }, [selectedDeviceId, selectedSlaveId])

  // Real-time device room subscription
  useEffect(() => {
    if (selectedDeviceId) {
      subscribeDevice(selectedDeviceId)
    }
  }, [selectedDeviceId])

  // Live telemetry streaming on socket event
  useEffect(() => {
    const unsub = onSocketEvent((event, payload) => {
      if (event === 'reading:new' && payload?.deviceId === selectedDeviceId) {
        reload({ silent: true })
      }
    })
    return () => unsub?.()
  }, [selectedDeviceId, reload])

  // 10s auto-refresh fallback
  useEffect(() => {
    if (!selectedDeviceId) return
    const interval = setInterval(() => {
      reload({ silent: true })
    }, 10000)
    return () => clearInterval(interval)
  }, [selectedDeviceId, reload])

  const m = data?.metrics ?? {}
  const charts = m.charts ?? {}
  const anomalyCount = data?.anomalyCount ?? 0

  const activeSlave = useMemo(() => {
    return slaves.find((s) => String(s.id) === String(selectedSlaveId)) || slaves[0] || null
  }, [slaves, selectedSlaveId])

  const handleDownload = () => {
    const lines = [
      'metric,value',
      `equipment_name,${activeSlave?.name ?? 'all'}`,
      `total_power_kwh,${fmt(m.totalPower)}`,
      `export_power_kwh,${fmt(m.exportPower)}`,
      `voltage_imbalance,${fmt(m.voltageImbalance)}`,
      `current_imbalance,${fmt(m.currentImbalance)}`,
      `power_factor,${fmt(m.powerFactor)}`,
      `frequency_hz,${fmt(m.frequency)}`,
      `anomalies,${anomalyCount}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user-dashboard-${activeSlave?.name || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageState loading={loading && !devices.length} error={error} onRetry={reload}>
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h2 className="page-title">User Dashboard</h2>
            <p className="text-xs text-surface-400 mt-1">
              Real-time monitoring and analytics for your assigned equipment and slaves.
            </p>
          </div>
        </div>

        {/* Assigned Equipment / Slaves Panel */}
        <div className="card p-5 bg-surface-800/40 border border-surface-700/60 rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-700/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/20">
                <Cpu size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-surface-100">My Assigned Equipment</h3>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30">
                    {slaves.length} {slaves.length === 1 ? 'Slave' : 'Slaves'}
                  </span>
                </div>
                <p className="text-xs text-surface-400 mt-0.5">
                  Click on any machine to switch live telemetry view and detailed historical analytics below.
                </p>
              </div>
            </div>
          </div>

          {slaves.length === 0 ? (
            <div className="text-center py-8 px-4 bg-surface-900/40 rounded-lg border border-surface-700/40">
              <AlertTriangle className="mx-auto text-amber-400 mb-2" size={28} />
              <p className="text-sm font-medium text-surface-200">No Equipment Assigned</p>
              <p className="text-xs text-surface-400 mt-1 max-w-md mx-auto">
                You do not have any devices or slaves assigned to your account yet. Please contact your organization administrator to allocate equipment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {slaves.map((slave) => {
                const isSelected = String(slave.id) === String(selectedSlaveId)
                const isOnline = slave.status === 'ONLINE'
                const metrics = slave.latestMetrics || {}

                const voltage = pickMetric(metrics, ['Voltage', 'Phase VoltageA', 'Phase Voltage A', 'Voltage A', 'PhaseVoltageA'])
                const current = pickMetric(metrics, ['Current A', 'Current', 'CurrentA', 'Total Current'])
                const power = pickMetric(metrics, ['Active Power', 'Power', 'Total Active Power', 'ActivePower', 'Total Active Power(kW)'])
                const energy = pickMetric(metrics, ['Active Energy', 'Energy', 'Total Energy', 'Active Energy(kWh)'])

                return (
                  <div
                    key={slave.id}
                    onClick={() => {
                      setSelectedSlaveId(slave.id)
                      setTimeout(() => reload(), 0)
                    }}
                    className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border text-left ${
                      isSelected
                        ? 'bg-primary-500/10 border-primary-500/70 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/40'
                        : 'bg-surface-900/60 border-surface-700/60 hover:border-surface-600 hover:bg-surface-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-md ${isSelected ? 'bg-primary-500/20 text-primary-400' : 'bg-surface-800 text-surface-300'}`}>
                          <Layers size={15} />
                        </div>
                        <span className="font-semibold text-sm text-surface-100 truncate" title={slave.name}>
                          {slave.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${
                            isOnline
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-surface-700 text-surface-400 border border-surface-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-surface-400'}`} />
                          {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary-500 text-white rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-700/40 text-xs">
                      <div className="bg-surface-800/50 p-2 rounded-lg border border-surface-700/30">
                        <span className="text-surface-400 block text-[10px] uppercase font-medium">Active Power</span>
                        <span className="font-semibold text-surface-100 text-sm">{power != null ? `${fmt(power)} kW` : '—'}</span>
                      </div>
                      <div className="bg-surface-800/50 p-2 rounded-lg border border-surface-700/30">
                        <span className="text-surface-400 block text-[10px] uppercase font-medium">Voltage</span>
                        <span className="font-semibold text-surface-100 text-sm">{voltage != null ? `${fmt(voltage, 1)} V` : '—'}</span>
                      </div>
                      <div className="bg-surface-800/50 p-2 rounded-lg border border-surface-700/30">
                        <span className="text-surface-400 block text-[10px] uppercase font-medium">Current</span>
                        <span className="font-semibold text-surface-100 text-sm">{current != null ? `${fmt(current, 1)} A` : '—'}</span>
                      </div>
                      <div className="bg-surface-800/50 p-2 rounded-lg border border-surface-700/30">
                        <span className="text-surface-400 block text-[10px] uppercase font-medium">Energy</span>
                        <span className="font-semibold text-surface-100 text-sm">{energy != null ? `${fmt(energy, 1)} kWh` : '—'}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detailed Analytics Section */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-surface-100">
                {activeSlave?.name ? `${activeSlave.name} Telemetry & Analytics` : 'Equipment Telemetry & Analytics'}
              </h3>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px]">
                <DeviceSlaveSelector onChange={reload} />
              </div>
              <button type="button" className="btn-primary" onClick={handleDownload}>
                <Download size={14} /> Download Data
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricRangeCard icon={Zap} title="Total Power Consumption" value={fmt(m.totalPower)} unit="kWh" data={charts.totalPower} />
            <MetricRangeCard icon={Zap} title="Total Export Power" value={fmt(m.exportPower)} unit="kWh" data={charts.exportPower} />
            <MetricRangeCard icon={Zap} title="Voltage Imbalance (%)" value={fmt(m.voltageImbalance)} data={charts.voltageImbalance} />
            <MetricRangeCard icon={Activity} title="Current Imbalance" value={fmt(m.currentImbalance)} data={charts.currentImbalance} />
            <MetricRangeCard icon={Heart} title="Real Time Power Factor (Avg & Trend)" value={fmt(m.powerFactor)} data={charts.powerFactor} />
            <MetricRangeCard icon={TrendingUp} title="Predicted Consumption" value={fmt(m.predicted)} data={charts.predicted} />
            <MetricRangeCard
              icon={AlertTriangle}
              title="Anomalies Detected (Count & Type)"
              emptyLabel={anomalyCount === 0 ? 'No anomalies detected' : undefined}
              value={String(anomalyCount)}
            />
            <MetricRangeCard icon={Waves} title="THD-V" value={fmt(m.thdV)} unit="%" data={charts.thdV} />
            <MetricRangeCard icon={Waves} title="THD-I" value={fmt(m.thdI)} unit="%" data={charts.thdI} />
            <MetricRangeCard icon={Radio} title="Frequency" value={fmt(m.frequency)} unit="Hz" data={charts.frequency} />

            {[1, 2].map((i) => (
              <div key={i} className="card p-4 flex flex-col items-center justify-center text-center min-h-[180px]">
                <ImageIcon size={28} className="text-surface-300 mb-2" />
                <p className="text-xs text-surface-400">No Additional Metrics</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageState>
  )
}
