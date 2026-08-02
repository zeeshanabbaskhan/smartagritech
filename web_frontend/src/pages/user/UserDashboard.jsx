import { Download, Zap, Activity, Heart, TrendingUp, AlertTriangle, Waves, Radio, Image as ImageIcon } from 'lucide-react'
import MetricRangeCard from '../../components/ui/MetricRangeCard'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi, { list } from '../../api/emsApi'
import { mapAnomaly } from '../../utils/mappers'

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

export default function UserDashboard() {
  const { selectedDeviceId, selectedSlaveId } = useDevices()

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

  const m = data?.metrics ?? {}
  const charts = m.charts ?? {}
  const anomalyCount = data?.anomalyCount ?? 0

  const handleDownload = () => {
    const lines = [
      'metric,value',
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
    a.download = 'dashboard.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h2 className="page-title">Dashboard</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[280px]">
            <DeviceSlaveSelector onChange={reload} />
          </div>
          <button type="button" className="btn-primary" onClick={handleDownload}>
            <Download size={14} /> Download Data
          </button>
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
    </PageState>
  )
}
