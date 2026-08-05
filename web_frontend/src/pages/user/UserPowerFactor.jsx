import { useState } from 'react'
import AnalyticsDetailPage from '../../components/ui/AnalyticsDetailPage'
import { useFetch } from '../../components/ui/PageState'
import { useDevices } from '../../context/DeviceContext'
import emsApi, { list } from '../../api/emsApi'
import { mapAnomaly } from '../../utils/mappers'
import { formatTs } from '../../utils/analyticsHelpers'
import { userPowerFactorDummy, withUserDetailFallback } from '../../data/analyticsDummy'

function toPoints(series = []) {
  return (Array.isArray(series) ? series : []).map((p) => ({
    t: p.time ?? p.t ?? '',
    v: Number(p.value ?? p.v ?? 0) || 0,
  }))
}

export default function UserPowerFactor() {
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [timeRange, setTimeRange] = useState('24h')

  const { data, loading, reload } = useFetch(async () => {
    if (!selectedDeviceId) {
      return withUserDetailFallback(null, userPowerFactorDummy)
    }
    const q = { deviceId: selectedDeviceId, slaveId: selectedSlaveId || undefined, timeRange }
    const [res, anomRes, predRes] = await Promise.all([
      emsApi.getAiPowerFactor(q).catch(() => null),
      emsApi.getAnomalies({ limit: 100, deviceId: selectedDeviceId }).catch(() => null),
      emsApi.getAiPredictions({ deviceId: selectedDeviceId, variableName: 'PowerFactor' }).catch(() => null),
    ])
    const overTime = res?.data?.chartData ?? []
    const predictions = predRes?.data?.predictions ?? predRes?.data ?? []
    const anomalies = list(anomRes).map(mapAnomaly)
      .filter((a) => !a.deviceId || a.deviceId === selectedDeviceId)
      .filter((a) => /power\s*factor|pf/i.test(String(a.type)) || /power\s*factor|pf/i.test(String(a.variable)))
      .map((a) => ({ time: a.time ?? formatTs(a._raw?.alarmTime), type: a.type || 'Low Power Factor' }))
    const current = res?.data?.current
    const value = current != null
      ? Number(current).toFixed(2)
      : (overTime.length ? Number(overTime[overTime.length - 1].value).toFixed(2) : '—')
    return withUserDetailFallback({
      value,
      predictedData: toPoints(Array.isArray(predictions) ? predictions : []),
      overTimeData: toPoints(overTime),
      anomalyRows: anomalies,
    }, userPowerFactorDummy)
  }, [selectedDeviceId, selectedSlaveId, timeRange])

  return (
    <AnalyticsDetailPage
      title="Power Factor Details"
      valueLabel="Power Factor"
      value={data?.value ?? userPowerFactorDummy.value}
      anomalyType="Low Power Factor"
      anomalyRows={data?.anomalyRows ?? userPowerFactorDummy.anomalyRows}
      predictedTitle="Predicted Power Factor"
      predictedType="line"
      predictedData={data?.predictedData ?? userPowerFactorDummy.predictedData}
      predictedColor="#3B82F6"
      overTimeTitle="Power Factor Over Time"
      overTimeType="bar"
      overTimeData={data?.overTimeData ?? userPowerFactorDummy.overTimeData}
      overTimeColor="#3B82F6"
      backTo="/user"
      onDeviceChange={reload}
      timeRange={timeRange}
      onRangeChange={setTimeRange}
      loading={loading}
    />
  )
}
