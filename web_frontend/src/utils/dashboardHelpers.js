import emsApi, { list } from '../api/emsApi'
import { mapDevice } from './mappers'

/** Aggregate list totals from paginated API responses */
export async function fetchListTotal(fetcher, params = {}) {
  const res = await fetcher({ ...params, limit: 1, page: 1 })
  return res?.total ?? list(res).length
}

export async function fetchAdminStats() {
  const [orgs, users, devicesRes, gateways, anomaliesRes] = await Promise.all([
    fetchListTotal(emsApi.getOrganizations),
    fetchListTotal(emsApi.getUsers),
    emsApi.getDevices({ limit: 100 }),
    fetchListTotal(emsApi.getGateways),
    emsApi.getAnomalies({ limit: 100 }),
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
    emsApi.getDevices({ limit: 100 }),
    emsApi.getGateways({ limit: 100 }),
    emsApi.getAnomalies({ limit: 50 }),
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
  const [devicesRes, notifRes, anomaliesRes, subsRes] = await Promise.all([
    emsApi.getDevices({ limit: 100 }),
    emsApi.getNotifications({ limit: 30 }),
    emsApi.getAnomalies({ limit: 50 }),
    emsApi.getSubscriptions({ limit: 10 }),
  ])
  const devices = list(devicesRes)
  const notifications = list(notifRes)
  const anomalies = list(anomaliesRes)
  const subscription = list(subsRes).find((s) => s.email === user?.email)
  return {
    assignedDevices: devicesRes?.total ?? devices.length,
    activeAlarms: anomalies.filter((a) => a.alarmState === 'ACTIVE').length,
    notifications: notifRes?.total ?? notifications.filter((n) => !n.read).length,
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

export async function fetchDashboardChart(deviceId, timeRange = '24h') {
  if (!deviceId) return []
  try {
    const res = await emsApi.getDashboardSummary({ deviceId, timeRange })
    const chart = res?.data?.totalPowerConsumption?.chartData ?? []
    return chart.map((p) => ({
      time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      power: p.value,
      voltageA: p.value,
      voltageB: p.value * 0.98,
      voltageC: p.value * 1.02,
    }))
  } catch {
    return []
  }
}
