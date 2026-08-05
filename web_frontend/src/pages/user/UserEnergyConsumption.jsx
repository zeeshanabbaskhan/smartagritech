import { useState } from 'react'
import AnalyticsDetailPage from '../../components/ui/AnalyticsDetailPage'
import { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi from '../../api/emsApi'
import { userEnergyDummy, withUserDetailFallback } from '../../data/analyticsDummy'

const UNIT_OPTIONS = ['Power Consumption (kWh)', 'Export Power (kWh)', 'Cost (PKR)']

function toPoints(series = []) {
  return (Array.isArray(series) ? series : []).map((p) => ({
    t: p.time ?? p.t ?? '',
    v: Number(p.value ?? p.v ?? 0) || 0,
  }))
}

export default function UserEnergyConsumption() {
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [unit, setUnit] = useState(UNIT_OPTIONS[0])
  const [timeRange, setTimeRange] = useState('24h')

  const { data, loading, reload } = useFetch(async () => {
    if (!selectedDeviceId) {
      return withUserDetailFallback(null, userEnergyDummy)
    }
    const q = { deviceId: selectedDeviceId, slaveId: selectedSlaveId || undefined, timeRange }
    const [res, predRes] = await Promise.all([
      emsApi.getAiEnergy(q).catch(() => null),
      emsApi.getAiPredictions({ deviceId: selectedDeviceId, variableName: 'PowerConsumption' }).catch(() => null),
    ])
    const overTime = res?.data?.chartData ?? []
    const predictions = predRes?.data?.predictions ?? predRes?.data ?? []
    let raw = res?.data?.totalConsumption
    if (unit.startsWith('Export')) raw = res?.data?.totalExport
    if (unit.startsWith('Cost')) raw = res?.data?.totalCost
    const value = raw != null
      ? `${Number(raw).toFixed(2)}${unit.startsWith('Cost') ? ' PKR' : ' kWh'}`
      : '—'
    return withUserDetailFallback({
      value,
      predictedData: toPoints(Array.isArray(predictions) ? predictions : []),
      overTimeData: toPoints(overTime),
      anomalyRows: [],
    }, userEnergyDummy)
  }, [selectedDeviceId, selectedSlaveId, unit, timeRange])

  return (
    <AnalyticsDetailPage
      title="Total Power Consumption"
      valueLabel="Total Power Consumption"
      value={data?.value ?? userEnergyDummy.value}
      noAnomalies
      extraAnomalyColumn="Consumption"
      predictedTitle="Predicted Power Consumption"
      predictedType="line"
      predictedData={data?.predictedData ?? userEnergyDummy.predictedData}
      predictedColor="#3B82F6"
      overTimeTitle="Power Consumption Imbalance Over Time"
      overTimeType="bar"
      overTimeData={data?.overTimeData ?? userEnergyDummy.overTimeData}
      overTimeColor="#3B82F6"
      backTo="/user"
      onDeviceChange={reload}
      timeRange={timeRange}
      onRangeChange={setTimeRange}
      loading={loading}
      extraFilter={
        <div className="w-56">
          <label className="label">Unit (kWh)</label>
          <select className="select" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNIT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      }
    />
  )
}
