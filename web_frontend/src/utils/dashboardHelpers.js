import emsApi, { list } from '../api/emsApi'
import { mapDevice } from './mappers'
import { fetchDeviceDashboardCharts, formatChartTime } from './sensorReadings'
import { ALIASES, powerReadingToKw, readDeviceMetric } from './deviceMetrics'

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
    emsApi.getDevices({ limit: 100, withMetrics: true }).catch(() => ({ data: [], total: 0 })),
    emsApi.getGateways({ limit: 100 }).catch(() => ({ data: [], total: 0 })),
    emsApi.getAnomalies({ limit: 50 }).catch(() => ({ data: [], total: 0 })),
  ])
  const devices = list(devicesRes).map(mapDevice)
  const online = devices.filter((d) => d.statusRaw === 'ONLINE').length
  
  // Aggregate all slaves across all devices
  const allSlaves = devices.flatMap((d) => (d.slaves || []).map((s) => ({
    ...s,
    deviceOrg: d.org,
    deviceGateway: d.gateway,
  })))
  const onlineSlaves = allSlaves.filter((s) => s.statusRaw === 'ONLINE' || s.status === 'Online').length
  const totalSlaves = allSlaves.length

  return {
    totalDevices: devicesRes?.total ?? devices.length,
    totalGateways: gatewaysRes?.total ?? list(gatewaysRes).length,
    onlineDevices: online,
    offlineDevices: devices.length - online,
    totalSlaves,
    onlineSlaves,
    offlineSlaves: totalSlaves - onlineSlaves,
    slaves: allSlaves,
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

const LOAD_VARS = ALIASES.power
const EXPORT_VARS = ['ExportPower', 'SolarPower', 'Export', 'Solar', 'ExportActivePower']
const ENERGY_VARS = ALIASES.consumption

/** First variable that exists on the device metrics map (or a safe MQTT/EMS default). */
function resolveDeviceVariable(device, candidates, fallback = null) {
  const metrics = device?.latestMetrics
  if (metrics && typeof metrics === 'object') {
    for (const name of candidates) {
      if (Object.prototype.hasOwnProperty.call(metrics, name)) return name
    }
  }
  return fallback
}

/**
 * Org-wide power history from each device's real sensor aggregates.
 * Uses ActivePower / PowerConsumption / etc. (not hardcoded dashboard-summary only).
 * grid = max(0, load − export), matching power-flow math. Values are kW.
 */
export async function fetchOrgEnergyOverview(deviceIds = [], timeRange = '24h', maxDevices = 40, extraSlaveIds = []) {
  const ids = deviceIds.filter(Boolean).slice(0, maxDevices)
  const slaveIds = (extraSlaveIds || []).filter(Boolean)
  const empty = {
    series: [],
    timestamps: [],
    loadByDevice: {},
    solarByTs: new Map(),
    monthlyEnergyKwh: null,
    bucketHours: 0,
    loadVariableHint: null,
  }
  if (!ids.length && !slaveIds.length) return empty

  const devicesRes = await emsApi.getDevices({ limit: 100, withMetrics: true }).catch(() => null)
  const devices = list(devicesRes).map(mapDevice)
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]))

  // Map each slave to its parent device
  const allSlaves = devices.flatMap((d) => (d.slaves || []).map((s) => ({ ...s, parentDeviceId: d.id })))
  const slaveById = Object.fromEntries(allSlaves.map((s) => [s.id, s]))

  const loadByTs = new Map()
  const solarByTs = new Map()
  const loadByDevice = {}
  let loadVariableHint = null
  let energyDeltaSum = 0
  let energyDeltaCount = 0

  const addPoints = (points, target, perDevice, variableName) => {
    for (const p of points ?? []) {
      const ts = new Date(p.timestamp).getTime()
      const value = powerReadingToKw(variableName, p.value)
      if (!Number.isFinite(ts) || !Number.isFinite(value)) continue
      if (target) target.set(ts, (target.get(ts) ?? 0) + value)
      if (perDevice) perDevice.set(ts, (perDevice.get(ts) ?? 0) + value)
    }
  }

  // 1. Fetch aggregates for all device IDs
  await Promise.all(ids.map(async (id) => {
    const device = byId[id]
    const loadVar = resolveDeviceVariable(device, LOAD_VARS, 'ActivePower')
    const exportVar = resolveDeviceVariable(device, EXPORT_VARS, null)
    const energyVar = resolveDeviceVariable(device, ENERGY_VARS, null)
    if (loadVar && !loadVariableHint) loadVariableHint = loadVar

    const tasks = [
      emsApi.getSensorAggregate({ deviceId: id, variableName: loadVar, timeRange })
        .then((res) => ({ kind: 'load', varName: loadVar, points: res?.data ?? [] }))
        .catch(() => ({ kind: 'load', varName: loadVar, points: [] })),
    ]
    if (exportVar) {
      tasks.push(
        emsApi.getSensorAggregate({ deviceId: id, variableName: exportVar, timeRange })
          .then((res) => ({ kind: 'export', varName: exportVar, points: res?.data ?? [] }))
          .catch(() => ({ kind: 'export', varName: exportVar, points: [] })),
      )
    }
    if (energyVar) {
      tasks.push(
        emsApi.getSensorAggregate({ deviceId: id, variableName: energyVar, timeRange: '30d' })
          .then((res) => ({ kind: 'energy', varName: energyVar, points: res?.data ?? [] }))
          .catch(() => ({ kind: 'energy', varName: energyVar, points: [] })),
      )
    }

    const results = await Promise.all(tasks)
    const deviceLoad = new Map()
    for (const r of results) {
      if (r.kind === 'load') addPoints(r.points, loadByTs, deviceLoad, r.varName)
      if (r.kind === 'export') addPoints(r.points, solarByTs, null, r.varName)
      if (r.kind === 'energy' && r.points?.length >= 2) {
        const first = Number(r.points[0].value)
        const last = Number(r.points[r.points.length - 1].value)
        if (Number.isFinite(first) && Number.isFinite(last) && last >= first) {
          energyDeltaSum += last - first
          energyDeltaCount += 1
        }
      }
    }
    if (deviceLoad.size) loadByDevice[id] = deviceLoad
  }))

  // 2. Fetch aggregates for explicitly linked slave IDs (e.g. Solar, Generator, Grid, custom groups)
  await Promise.all(slaveIds.map(async (sId) => {
    const slave = slaveById[sId]
    const devId = slave?.parentDeviceId || ids[0]
    if (!devId) return

    const slaveLoad = new Map()
    const res = await emsApi.getSensorAggregate({ deviceId: devId, slaveId: sId, variableName: 'ActivePower', timeRange })
      .catch(() => null)
    
    let points = res?.data ?? []
    if (!points.length) {
      const resTp = await emsApi.getSensorAggregate({ deviceId: devId, slaveId: sId, variableName: 'Total Power', timeRange })
        .catch(() => null)
      points = resTp?.data ?? []
    }

    const isSolar = slave?.name && /solar/i.test(slave.name)
    addPoints(points, isSolar ? solarByTs : null, slaveLoad, 'ActivePower')
    if (slaveLoad.size) {
      loadByDevice[sId] = slaveLoad
    }
  }))

  // Legacy EMS fallback when aggregates returned nothing (PowerConsumption naming)
  const missing = ids.filter((id) => !loadByDevice[id])
  if (missing.length) {
    const summaries = await Promise.all(missing.map((id) => (
      emsApi.getDashboardSummary({ deviceId: id, timeRange })
        .then((res) => ({ id, data: res?.data ?? null }))
        .catch(() => ({ id, data: null }))
    )))
    for (const { id, data } of summaries) {
      if (!data) continue
      const deviceLoad = new Map()
      addPoints(data.totalPowerConsumption?.chartData, loadByTs, deviceLoad, 'PowerConsumption')
      addPoints(data.totalExportPower?.chartData, solarByTs, null, 'ExportPower')
      if (deviceLoad.size) loadByDevice[id] = deviceLoad
      const monthly = Number(data.energySavingsComparison?.monthly?.current)
      if (Number.isFinite(monthly) && energyDeltaCount === 0) {
        energyDeltaSum += monthly
        energyDeltaCount += 1
      }
    }
  }

  const timestamps = [...new Set([...loadByTs.keys(), ...solarByTs.keys(), ...Object.values(loadByDevice).flatMap(m => [...m.keys()])])].sort((a, b) => a - b)
  const series = timestamps.map((ts) => {
    const load = +(loadByTs.get(ts) ?? 0).toFixed(2)
    const solar = +(solarByTs.get(ts) ?? 0).toFixed(2)
    return { ts, time: formatChartTime(ts), load, solar, grid: +Math.max(0, load - solar).toFixed(2) }
  })
  const bucketHours = timestamps.length > 1 ? (timestamps[1] - timestamps[0]) / 3_600_000 : 0

  let monthlyEnergyKwh = null
  if (energyDeltaCount > 0) {
    monthlyEnergyKwh = energyDeltaSum
  } else if (series.length && bucketHours > 0) {
    const avgLoad = series.reduce((s, r) => s + r.load, 0) / series.length
    if (avgLoad > 0) monthlyEnergyKwh = avgLoad * 24 * 30
  } else {
    // Live meter reading sum as last resort (not a true monthly delta)
    let meter = 0
    let n = 0
    for (const id of ids) {
      const d = byId[id]
      const eVar = resolveDeviceVariable(d, ENERGY_VARS, null)
      if (!eVar) continue
      const e = readDeviceMetric(d, eVar)
      if (Number.isFinite(e)) { meter += e; n += 1 }
    }
    if (n) monthlyEnergyKwh = meter
  }

  return {
    series,
    timestamps,
    loadByDevice,
    solarByTs,
    monthlyEnergyKwh: monthlyEnergyKwh != null ? +Number(monthlyEnergyKwh).toFixed(1) : null,
    bucketHours,
    loadVariableHint,
  }
}
