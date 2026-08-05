import { useState } from 'react'
import AnalyticsDetailPage from '../../components/ui/AnalyticsDetailPage'
import { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi from '../../api/emsApi'
import { userCurrentDummy, withUserDetailFallback } from '../../data/analyticsDummy'

function toPoints(series = []) {
  return (Array.isArray(series) ? series : []).map((p) => ({
    t: p.time ?? p.t ?? '',
    v: Number(p.value ?? p.v ?? 0) || 0,
  }))
}

export default function UserCurrentImbalance() {
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [timeRange, setTimeRange] = useState('24h')

  const { data, loading, reload } = useFetch(async () => {
    if (!selectedDeviceId) {
      return withUserDetailFallback(null, userCurrentDummy)
    }
    const q = { deviceId: selectedDeviceId, slaveId: selectedSlaveId || undefined, timeRange }
    const [res, predRes] = await Promise.all([
      emsApi.getAiCurrent(q).catch(() => null),
      emsApi.getAiPredictions({ deviceId: selectedDeviceId, variableName: 'CurrentA' }).catch(() => null),
    ])
    const imbalance = res?.data?.chartData?.currentImbalance ?? []
    const overTime = res?.data?.chartData?.currentA ?? res?.data?.chartData?.avgCurrent ?? imbalance
    const predictions = predRes?.data?.predictions ?? predRes?.data ?? []
    const current = res?.data?.current
    const value = current != null
      ? Number(current).toFixed(2)
      : (imbalance.length ? Number(imbalance[imbalance.length - 1].value).toFixed(2) : '—')
    return withUserDetailFallback({
      value,
      predictedData: toPoints(Array.isArray(predictions) ? predictions : []),
      overTimeData: toPoints(overTime),
      anomalyRows: [],
    }, userCurrentDummy)
  }, [selectedDeviceId, selectedSlaveId, timeRange])

  return (
    <AnalyticsDetailPage
      title="Current Imbalance Details"
      valueLabel="Current Imbalance"
      value={data?.value ?? userCurrentDummy.value}
      noAnomalies
      predictedTitle="Predicted Current"
      predictedType="bar"
      predictedData={data?.predictedData ?? userCurrentDummy.predictedData}
      predictedColor="#3B82F6"
      overTimeTitle="Current Over Time"
      overTimeType="bar"
      overTimeData={data?.overTimeData ?? userCurrentDummy.overTimeData}
      overTimeColor="#3B82F6"
      backTo="/user"
      onDeviceChange={reload}
      timeRange={timeRange}
      onRangeChange={setTimeRange}
      loading={loading}
    />
  )
}
