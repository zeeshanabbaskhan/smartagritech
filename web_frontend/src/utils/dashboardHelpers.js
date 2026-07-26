import emsApi, { list } from '../api/emsApi'
import { mapDevice } from './mappers'
import { fetchDeviceDashboardCharts, formatChartTime } from './sensorReadings'

/** Aggregate list totals from paginated API responses */
export async function fetchListTotal(fetcher, params = {}) {
  const res = await fetcher({ ...params, limit: 1, page: 1 })
  return res?.total ?? list(res).length
}

export async function fetchAdminStats() {
  const [orgs, users, devicesRes, gateways, anomaliesRes] = await Promise.all([
    fetchListTotal(emsApi.getOrganizations).catch(() => 0),
    fetchListTotal(emsApi.getUsers).catch(() => 0),
    emsApi.getDevices({ limit: 100 }).catch(() => ({ data: [], total: 0 })),
    fetchListTotal(emsApi.getGateways).catch(() => 0),
    emsApi.getAnomalies({ limit: 100 }).catch(() => ({ data: [], total: 0 })),
  ])
  const devices = list(devicesRes).map(mapDevice)
  const anomalies = list(anomaliesRes)
  const online = devices.filter((d) => d.statusRaw === 'ONLINE').length
  const offline = devices.filter((d) => d.statusRaw === 'OFFLINE').length
  const activeAlarms = anomalies.filter((a) => a.alarmState === 'ACTIVE' || a.processState === 'PENDING').length
  return {
    totalOrgs: orgs,
    totalUsers: users,
    totalDevices: devicesRes?.total ?? devices.length,
    totalGateways: gateways,
    onlineDevices: online,
    offlineDevices: offline,
    activeAlarms,
    totalAlarms: anomaliesRes?.total ?? anomalies.length,
    devices,
    anomalies,
  }
}

export async function fetchOrgStats() {
  const [devicesRes, gatewaysRes, anomaliesRes] = await Promise.all([
    emsApi.getDevices({ limit: 100 }).catch(() => ({ data: [], total: 0 })),
    emsApi.getGateways({ limit: 100 }).catch(() => ({ data: [], total: 0 })),
    emsApi.getAnomalies({ limit: 50 }).catch(() => ({ data: [], total: 0 })),
  ])
  const devices = list(devicesRes).map(mapDevice)
  const online = devices.filter((d) => d.statusRaw === 'ONLINE').length
  return {
    totalDevices: devicesRes?.total ?? devices.length,
    totalGateways: gatewaysRes?.total ?? list(gatewaysRes).length,
    onlineDevices: online,
    offlineDevices: devices.length - online,
    devices,
    anomalies: list(anomaliesRes),
  }
}

export async function fetchUserStats(user) {
  // Soft-fail each call so one unauthorized endpoint cannot blank the whole dashboard.
  const [devicesRes, notifRes, anomaliesRes, subsRes] = await Promise.all([
    emsApi.getDevices({ limit: 100 }).catch(() => ({ data: [], total: 0 })),
    emsApi.getNotifications({ limit: 30 }).catch(() => ({ data: [], total: 0, unreadCount: 0 })),
    emsApi.getAnomalies({ limit: 50 }).catch(() => ({ data: [], total: 0 })),
    emsApi.getSubscriptions({ limit: 10 }).catch(() => ({ data: [] })),
  ])
  const devices = list(devicesRes)
  const notifications = list(notifRes)
  const anomalies = list(anomaliesRes)
  const subscription = list(subsRes).find((s) => s.email === user?.email) ?? list(subsRes)[0]
  return {
    assignedDevices: devicesRes?.total ?? devices.length,
    activeAlarms: anomalies.filter((a) => a.alarmState === 'ACTIVE').length,
    notifications: notifRes?.unreadCount ?? notifications.filter((n) => !n.read).length,
    subscription: subscription?.status ?? '—',
    devices,
    notificationList: notifications,
    anomalies,
  }
}

export async function fetchFirstDeviceId() {
  const res = await emsApi.getDevices({ limit: 1 })
  const devices = list(res)
  return devices[0]?.id ?? null
}

export async function fetchDashboardChart(deviceId, timeRange = '24h', slaveId = null) {
  return fetchDeviceDashboardCharts(deviceId, timeRange, slaveId)
}

/**
 * Org-wide energy history built by summing each device's real bucketed readings.
 * grid is the unmet remainder (load − export), matching the backend power-flow math.
 * Returns empty series when no telemetry exists — callers must render an empty state.
 */
export async function fetchOrgEnergyOverview(deviceIds = [], timeRange = '24h', maxDevices = 12) {
  const ids = deviceIds.filter(Boolean).slice(0, maxDevices)
  const empty = { series: [], timestamps: [], loadByDevice: {}, monthlyEnergyKwh: null, bucketHours: 0 }
  if (!ids.length) return empty

  const summaries = await Promise.all(ids.map((id) => (
    emsApi.getDashboardSummary({ deviceId: id, timeRange })
      .then((res) => ({ id, data: res?.data ?? null }))
      .catch(() => ({ id, data: null }))
  )))

  const loadByTs = new Map()
  const solarByTs = new Map()
  const loadByDevice = {}
  let monthlyEnergyKwh = null

  const addPoints = (points, target, perDevice) => {
    for (const p of points ?? []) {
      const ts = new Date(p.timestamp).getTime()
      const value = Number(p.value)
      if (!Number.isFinite(ts) || !Number.isFinite(value)) continue
      target.set(ts, (target.get(ts) ?? 0) + value)
      if (perDevice) perDevice.set(ts, (perDevice.get(ts) ?? 0) + value)
    }
  }

  for (const { id, data } of summaries) {
    if (!data) continue
    const deviceLoad = new Map()
    addPoints(data.totalPowerConsumption?.chartData, loadByTs, deviceLoad)
    addPoints(data.totalExportPower?.chartData, solarByTs, null)
    if (deviceLoad.size) loadByDevice[id] = deviceLoad
    const monthly = Number(data.energySavingsComparison?.monthly?.current)
    if (Number.isFinite(monthly)) monthlyEnergyKwh = (monthlyEnergyKwh ?? 0) + monthly
  }

  const timestamps = [...new Set([...loadByTs.keys(), ...solarByTs.keys()])].sort((a, b) => a - b)
  const series = timestamps.map((ts) => {
    const load = +(loadByTs.get(ts) ?? 0).toFixed(2)
    const solar = +(solarByTs.get(ts) ?? 0).toFixed(2)
    return { ts, time: formatChartTime(ts), load, solar, grid: +Math.max(0, load - solar).toFixed(2) }
  })
  const bucketHours = timestamps.length > 1 ? (timestamps[1] - timestamps[0]) / 3_600_000 : 0

  return { series, timestamps, loadByDevice, monthlyEnergyKwh, bucketHours }
}
