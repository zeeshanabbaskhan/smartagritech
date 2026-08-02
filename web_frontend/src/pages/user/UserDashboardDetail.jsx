import {
  AlertTriangle, Gauge, Activity, Zap, PieChart, Package,
  Waves, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import PageState, { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi from '../../api/emsApi'
import { latestToReadings } from '../../utils/sensorReadings'

const READOUT_DEFS = [
  { key: 'VoltageA',      label: 'VoltageA',        unit: 'V' },
  { key: 'VoltageB',      label: 'VoltageB',        unit: 'V' },
  { key: 'VoltageC',      label: 'VoltageC',        unit: 'V' },
  { key: 'PhaseVoltageA', label: 'Phase VoltageA',  unit: 'V' },
  { key: 'PhaseVoltageB', label: 'Phase VoltageB',  unit: 'V' },
  { key: 'PhaseVoltageC', label: 'Phase VoltageC',  unit: 'V' },
  { key: 'CurrentA',      label: 'CurrentA',        unit: 'A' },
  { key: 'CurrentB',      label: 'CurrentB',        unit: 'A' },
  { key: 'CurrentC',      label: 'CurrentC',        unit: 'A' },
  { key: 'ActivePower',   label: 'Active Power',    unit: 'kW' },
  { key: 'ReactivePower', label: 'Reactive Power',  unit: 'kVar' },
  { key: 'ApparentPower', label: 'Apparent Power',  unit: 'kVA' },
  { key: 'PowerConsumption', label: 'Power Consumption', unit: 'kWh' },
  { key: 'ExportPower',   label: 'Export Power',    unit: 'kWh' },
  { key: 'PowerFactor',   label: 'Power Factor',    unit: '', icon: PieChart },
  { key: 'Frequency',     label: 'Frequency',       unit: 'Hz' },
  { key: 'THDUa',         label: 'THDUa',           unit: '%' },
  { key: 'THDUb',         label: 'THDUb',           unit: '%' },
  { key: 'THDUc',         label: 'THDUc',           unit: '%' },
  { key: 'THDIa',         label: 'THDIa',           unit: '%' },
  { key: 'THDIb',         label: 'THDIb',           unit: '%' },
  { key: 'THDIc',         label: 'THDIc',           unit: '%' },
  { key: 'TotalCost',     label: 'Total cost pertif', unit: 'PKR', icon: Package },
]

function readoutIcon(row) {
  if (row.icon) return row.icon
  if (row.key.startsWith('Voltage') || row.key.startsWith('PhaseVoltage')) return AlertTriangle
  if (row.key.startsWith('Current')) return Gauge
  if (row.key.includes('Power')) return Activity
  if (row.key.startsWith('THD')) return Waves
  if (row.key === 'Frequency') return Zap
  return Activity
}

function findReading(readings, key) {
  const aliases = [key, key.toLowerCase(), key.replace(/([a-z])([A-Z])/g, '$1 $2')]
  const hit = readings.find((r) => aliases.some((a) => String(r.variableName).toLowerCase() === String(a).toLowerCase()
    || String(r.variableName).replace(/\s+/g, '').toLowerCase() === key.toLowerCase()))
  return hit
}

function fmtNum(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export default function UserDashboardDetail() {
  const { selectedDeviceId, selectedSlaveId } = useDevices()

  const { data, loading, error, reload } = useFetch(async () => {
    if (!selectedDeviceId) return { readouts: READOUT_DEFS.map((d) => ({ ...d, value: '—' })), savings: [] }
    const q = { deviceId: selectedDeviceId, slaveId: selectedSlaveId || undefined, timeRange: '24h' }
    const [latestRes, summaryRes, energyRes] = await Promise.all([
      emsApi.getLatestReadings(q).catch(() => null),
      emsApi.getDashboardSummary(q).catch(() => null),
      emsApi.getAiEnergy(q).catch(() => null),
    ])
    const readings = latestToReadings(latestRes)
    const readouts = READOUT_DEFS.map((def) => {
      const hit = findReading(readings, def.key)
      let value = hit?.value
      if (value == null && def.key === 'PowerConsumption') value = summaryRes?.data?.totalPowerConsumption?.value ?? energyRes?.data?.totalConsumption
      if (value == null && def.key === 'ExportPower') value = summaryRes?.data?.totalExportPower?.value ?? energyRes?.data?.totalExport
      if (value == null && def.key === 'PowerFactor') value = summaryRes?.data?.powerFactor?.value
      if (value == null && def.key === 'Frequency') value = summaryRes?.data?.frequency?.value
      return { ...def, value: fmtNum(value), unit: hit?.unit || def.unit }
    })

    const daily = energyRes?.data?.dailyComparison
    const weekly = energyRes?.data?.weeklyComparison
    const monthly = energyRes?.data?.monthlyComparison
    const toSaving = (label, block) => {
      if (!block) return { label, pct: 0, sub: '0 vs 0 kWh', trend: 'flat' }
      const pct = Number(block.percentChange ?? block.pct ?? 0)
      const cur = block.current ?? block.currentKwh ?? 0
      const prev = block.previous ?? block.previousKwh ?? 0
      return {
        label,
        pct,
        sub: `${Number(cur).toLocaleString()} vs ${Number(prev).toLocaleString()} kWh`,
        trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
      }
    }

    return {
      readouts,
      savings: [
        toSaving('Daily', daily),
        toSaving('Weekly', weekly),
        toSaving('Monthly', monthly),
      ],
    }
  }, [selectedDeviceId, selectedSlaveId])

  const readouts = data?.readouts ?? READOUT_DEFS.map((d) => ({ ...d, value: '—' }))
  const savings = data?.savings?.length ? data.savings : [
    { label: 'Daily', pct: 0, sub: '0 vs 0 kWh', trend: 'flat' },
    { label: 'Weekly', pct: 0, sub: '0 vs 0 kWh', trend: 'flat' },
    { label: 'Monthly', pct: 0, sub: '0 vs 0 kWh', trend: 'flat' },
  ]

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h2 className="page-title">Dashboard</h2>
          </div>
        </div>

        <DeviceSlaveSelector onChange={reload} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {readouts.map((row) => {
            const Icon = readoutIcon(row)
            return (
              <div key={row.key} className="card p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-700 dark:text-surface-300 mb-2">
                  <Icon size={13} className="text-primary-600 flex-shrink-0" />
                  <span>{row.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-surface-900 dark:text-surface-100">{row.value}</span>
                  {row.unit && <span className="text-xs font-semibold text-surface-400">{row.unit}</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-3">Energy Savings Comparison</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {savings.map((s) => {
              const TrendIcon = s.trend === 'up' ? TrendingUp : s.trend === 'down' ? TrendingDown : Minus
              const barColor  = s.trend === 'up' ? 'bg-success-600' : s.trend === 'down' ? 'bg-danger-600' : 'bg-surface-300'
              const textColor = s.trend === 'up' ? 'text-success-600' : s.trend === 'down' ? 'text-danger-600' : 'text-surface-400'
              const bg        = s.trend === 'up' ? 'bg-success-100/50 text-success-700' : s.trend === 'down' ? 'bg-danger-100/50 text-danger-700' : 'bg-surface-100 text-surface-500'
              return (
                <div key={s.label} className="card p-4 text-center relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 ${barColor}`} />
                  <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center mb-2 ${bg}`}>
                    <TrendIcon size={15} />
                  </div>
                  <p className="text-xs text-surface-400 font-semibold">{s.label}</p>
                  <p className={`text-lg font-bold mt-1 ${textColor}`}>{s.pct > 0 ? '+' : ''}{Number(s.pct).toFixed(1)}%</p>
                  <p className="text-[10px] text-surface-400 mt-1">{s.sub}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PageState>
  )
}
