import { useState } from 'react'
import AnalyticsDetailPage from '../../components/ui/AnalyticsDetailPage'
import { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi, { list } from '../../api/emsApi'
import { mapAnomaly } from '../../utils/mappers'
import { formatTs } from '../../utils/analyticsHelpers'

function toPoints(series = []) {
  return (Array.isArray(series) ? series : []).map((p) => ({
    t: p.time ?? p.t ?? '',
    v: Number(p.value ?? p.v ?? 0) || 0,
  }))
}

export default function UserVoltageImbalance() {
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [timeRange, setTimeRange] = useState('24h')

  const { data, loading, reload } = useFetch(async () => {
    if (!selectedDeviceId) {
      return { value: '—', predictedData: [], overTimeData: [], anomalyRows: [] }
    }
    const q = { deviceId: selectedDeviceId, slaveId: selectedSlaveId || undefined, timeRange }
    const [res, anomRes, predRes] = await Promise.all([
      emsApi.getAiVoltage(q).catch(() => null),
      emsApi.getAnomalies({ limit: 100, deviceId: selectedDeviceId }).catch(() => null),
      emsApi.getAiPredictions({ deviceId: selectedDeviceId, variableName: 'VoltageA' }).catch(() => null),
    ])
    const imbalance = res?.data?.chartData?.voltageImbalance ?? []
    const overTime = res?.data?.chartData?.voltageA ?? res?.data?.chartData?.avgVoltage ?? imbalance
    const predictions = predRes?.data?.predictions ?? predRes?.data ?? []
    const anomalies = list(anomRes).map(mapAnomaly)
      .filter((a) => !a.deviceId || a.deviceId === selectedDeviceId)
      .filter((a) => /volt/i.test(String(a.type)) || /volt/i.test(String(a.variable)) || /overvolt/i.test(String(a.desc)))
      .map((a) => ({ time: a.time ?? formatTs(a._raw?.alarmTime), type: a.type || 'Overvoltage' }))
    const current = res?.data?.current
    const value = current != null
      ? Number(current).toFixed(2)
      : (imbalance.length ? Number(imbalance[imbalance.length - 1].value).toFixed(2) : '—')
    return {
      value,
      predictedData: toPoints(Array.isArray(predictions) ? predictions : []),
      overTimeData: toPoints(overTime),
      anomalyRows: anomalies,
    }
  }, [selectedDeviceId, selectedSlaveId, timeRange])

  return (
    <AnalyticsDetailPage
      title="Voltage Imbalance Details"
      valueLabel="Voltage Imbalance"
      value={data?.value ?? '—'}
      anomalyType="Overvoltage"
      anomalyRows={data?.anomalyRows ?? []}
      predictedTitle="Predicted Voltage"
      predictedType="bar"
      predictedData={data?.predictedData ?? []}
      predictedColor="#3B82F6"
      overTimeTitle="Voltage Over Time"
      overTimeType="bar"
      overTimeData={data?.overTimeData ?? []}
      overTimeColor="#3B82F6"
      backTo="/user"
      onDeviceChange={reload}
      timeRange={timeRange}
      onRangeChange={setTimeRange}
      loading={loading}
    />
  )
}
