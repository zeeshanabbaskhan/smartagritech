import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import PageState, { useFetch } from '../../components/ui/PageState'
import Modal from '../../components/ui/Modal'
import DashboardTelemetry from '../../components/dashboard/DashboardTelemetry'
import PowerFlowMindMap from '../../components/ui/PowerFlowMindMap'
import { Cpu, AlertTriangle, Zap, CheckCircle } from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchOrgStats, fetchDashboardChart } from '../../utils/dashboardHelpers'
import { mapDevice } from '../../utils/mappers'
import { readDeviceMetric, isOffline } from '../../utils/deviceMetrics'
import emsApi, { list, one } from '../../api/emsApi'

const GROUP_LINE_COLORS = ['#8B5CF6', '#F5A623', '#3B82F6', '#22C55E', '#EC4899', '#14B8A6', '#F97316', '#6366F1']
const TARIFF_PKR_PER_KWH = 28
const SAMPLE_INTERVAL_HOURS = 2

function seedNum(str = '') {
  return String(str).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

function sourceKw(sources, type) {
  return Number(sources?.find((s) => (s.type || s.id) === type)?.valueKw) || 0
}

/** CF-style 24h multi-source series shaped around live org load + source mix. */
function buildSourceSeries(orgName, totalLoadKw = 0, sources = []) {
  const codeSum = seedNum(orgName)
  const solarCap = Math.max(sourceKw(sources, 'solar'), 6 + (codeSum % 5))
  const genCap = sourceKw(sources, 'generator')
  const loadBase = Math.max(totalLoadKw, solarCap + genCap, 1)

  return Array.from({ length: 12 }, (_, i) => {
    const hour = i * 2
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
    const dayCurve = 0.55 + 0.45 * Math.sin(((hour - 6) / 12) * Math.PI + (codeSum % 6) * 0.05)
    const load = +(loadBase * dayCurve).toFixed(2)
    const solar = +(daylight * solarCap * (0.85 + 0.3 * Math.sin(codeSum + i))).toFixed(2)
    const generator = i % 5 === 0
      ? +(genCap > 0 ? genCap * (0.6 + 0.4 * Math.sin(codeSum + i)) : (codeSum % 3) * 0.4).toFixed(2)
      : 0
    const grid = +Math.max(0, load - solar - generator).toFixed(2)
    const label = new Date()
    label.setHours(hour, 0, 0, 0)
    return {
      time: label.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      solar: Math.max(0, solar),
      generator,
      grid,
      load,
    }
  })
}

/** CF-style 24h multi-line series keyed by group id, shaped around live load. */
function buildDeviceGroupSeries(groupsWithLoad) {
  return Array.from({ length: 12 }, (_, i) => {
    const hour = i * 2
    const label = new Date()
    label.setHours(hour, 0, 0, 0)
    const entry = { time: label.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    groupsWithLoad.forEach((g) => {
      const seed = seedNum(g.name)
      const dayCurve = 0.55 + 0.45 * Math.sin(((hour - 6) / 12) * Math.PI + (seed % 6))
      const base = Math.max(0.4, g.load || 0.4)
      entry[g.id] = +Math.max(0, base * (0.35 + dayCurve * 0.9)).toFixed(2)
    })
    return entry
  })
}

export default function OrgDashboard() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [chartBundle, setChartBundle] = useState({ power: [], multi: [], lines: [] })
  const [liveDevices, setLiveDevices] = useState([])
  const [openGroupId, setOpenGroupId] = useState(null)

  const { data: stats, loading, error, reload } = useFetch(async () => {
    const orgStats = await fetchOrgStats()
    let monthlyEnergy = '—'
    const deviceId = orgStats.devices?.[0]?.id
    if (deviceId) {
      try {
        const summary = await emsApi.getDashboardSummary({ deviceId, timeRange: '30d' })
        const val = summary?.data?.energySavingsComparison?.monthly?.current
          ?? summary?.data?.totalPowerConsumption?.value
        if (val != null) monthlyEnergy = `${Number(val).toLocaleString()} kWh`
      } catch (_) { /* soft-fail */ }
    }
    const activeAlarms = orgStats.anomalies.filter(
      (a) => a.alarmState === 'ACTIVE' || a.processState === 'UNPROCESSED'
    ).length
    return { ...orgStats, activeAlarms, monthlyEnergy }
  }, [])

  const { data: powerFlow, reload: reloadPowerFlow } = useFetch(async () => {
    const res = await emsApi.getPowerFlow()
    const payload = one(res) || {}
    const sources = Array.isArray(payload.sources) ? payload.sources : []
    const groups = Array.isArray(payload.groups)
      ? payload.groups.map((g) => ({
          id: g.id,
          name: g.name,
          deviceIds: g.deviceIds ?? (g.devices || []).map((d) => d.id ?? d.deviceId).filter(Boolean),
          deviceCount: g.deviceCount ?? (g.deviceIds?.length ?? 0),
          load: Number(g.loadKw ?? g.load) || 0,
          active: (Number(g.loadKw ?? g.load) || 0) > 0,
        }))
      : []
    return {
      sources,
      savings: payload.savings || null,
      groups,
      totalLoadKw: Number(payload.totalLoadKw) || 0,
      solarKw: Number(payload.solarKw) || 0,
      gridKw: Number(payload.gridKw) || 0,
    }
  }, [])

  useEffect(() => {
    const load = () => {
      emsApi.getDevices({ limit: 100, withMetrics: true })
        .then((res) => setLiveDevices(list(res).map(mapDevice)))
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  // Prefer API groups; fall back to client aggregation from device groups + live metrics
  const [fallbackGroups, setFallbackGroups] = useState([])

  useEffect(() => {
    if (powerFlow?.groups?.length) return
    emsApi.getDeviceGroups({ limit: 100 })
      .then((res) => setFallbackGroups(list(res).map((g) => ({
        id: g.id,
        name: g.name,
        deviceIds: g.deviceIds ?? (g.devices || []).map((d) => d.id ?? d.deviceId).filter(Boolean),
      }))))
      .catch(() => {})
  }, [powerFlow?.groups?.length])

  const groupLoads = useMemo(() => {
    if (powerFlow?.groups?.length) return powerFlow.groups
    return fallbackGroups.map((g) => {
      const groupDevices = liveDevices.filter((d) => g.deviceIds.includes(d.id))
      const online = groupDevices.filter((d) => !isOffline(d))
      const load = online.reduce((s, d) => {
        const v = readDeviceMetric(d, 'power')
        return s + (Number.isFinite(v) ? v : 0)
      }, 0)
      return {
        id: g.id,
        name: g.name,
        deviceIds: g.deviceIds,
        deviceCount: groupDevices.length,
        load: +load.toFixed(2),
        active: online.length > 0,
      }
    })
  }, [powerFlow, fallbackGroups, liveDevices])

  const openGroup = useMemo(
    () => groupLoads.find((g) => g.id === openGroupId) || null,
    [groupLoads, openGroupId]
  )
  const openGroupDevices = useMemo(
    () => (openGroup ? liveDevices.filter((d) => (openGroup.deviceIds || []).includes(d.id)) : []),
    [openGroup, liveDevices]
  )

  const chartDeviceId = stats?.devices?.[0]?.id ?? liveDevices[0]?.id ?? null

  useEffect(() => {
    if (!chartDeviceId) {
      setChartBundle({ power: [], multi: [], lines: [] })
      return
    }
    fetchDashboardChart(chartDeviceId, '24h').then(setChartBundle).catch(() => {})
  }, [chartDeviceId])

  const orgName = user?.organization?.name ?? 'your organization'

  const sourceSeries = useMemo(
    () => buildSourceSeries(orgName, powerFlow?.totalLoadKw || 0, powerFlow?.sources || []),
    [orgName, powerFlow]
  )

  const deviceGroupSeries = useMemo(
    () => buildDeviceGroupSeries(groupLoads),
    [groupLoads]
  )

  const consumptionSeries = useMemo(() => {
    if (chartBundle.power?.length) return chartBundle.power
    return sourceSeries.map((r) => ({ time: r.time, power: r.load }))
  }, [chartBundle.power, sourceSeries])

  // CF: derive savings from Solar + Generator offset across the 24h series
  const savings = useMemo(() => {
    const stored = powerFlow?.savings
    const dailyOffsetKWh = sourceSeries.reduce(
      (sum, row) => sum + (row.solar + row.generator) * SAMPLE_INTERVAL_HOURS,
      0
    )
    const derived = {
      dailyKWh: +dailyOffsetKWh.toFixed(1),
      daily: Math.round(dailyOffsetKWh * TARIFF_PKR_PER_KWH),
      weekly: Math.round(dailyOffsetKWh * 7 * TARIFF_PKR_PER_KWH),
      monthly: Math.round(dailyOffsetKWh * 30 * TARIFF_PKR_PER_KWH),
      unit: 'PKR',
    }
    const storedTotal = (Number(stored?.daily) || 0) + (Number(stored?.weekly) || 0) + (Number(stored?.monthly) || 0)
    return storedTotal > 0 ? { ...derived, ...stored, unit: stored.unit || 'PKR' } : derived
  }, [sourceSeries, powerFlow])

  const liveTile = (d, key) => {
    if (isOffline(d)) return '—'
    const v = readDeviceMetric(d, key)
    return Number.isFinite(v) ? (key === 'pf' ? v.toFixed(2) : v.toFixed(1)) : '—'
  }

  async function handleSourcesChange(sources) {
    try {
      await emsApi.updatePowerFlow({ sources, savings: powerFlow?.savings })
      reloadPowerFlow()
    } catch (e) {
      showToast(e.message || 'Failed to update power flow', 'error')
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-3 rounded-lg shadow-floating text-xs font-semibold text-surface-800 dark:text-surface-100">
          {label && <p className="text-surface-400 mb-1 font-bold">{label}</p>}
          {payload.map((item, i) => (
            <div key={i} className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
              <span>{item.name}:</span>
              <span className="text-surface-900 font-bold">{item.value} {item.unit || ''}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      <Skeleton name="org-dashboard" loading={loading} transition={300}>
        <div className="space-y-6">
          {/* 1. Energy Flow Overview (CF hero) */}
          {powerFlow && (
            <div className="card p-5">
              <h3 className="text-2xl font-extrabold tracking-tight text-center mb-3 bg-gradient-to-r from-primary-500 via-purple-500 to-success-500 bg-clip-text text-transparent">
                Energy Flow Overview
              </h3>
              <PowerFlowMindMap
                sources={powerFlow.sources}
                savings={savings}
                groups={groupLoads}
                orgName={orgName}
                onSourcesChange={handleSourcesChange}
                onGroupClick={setOpenGroupId}
                groupsPath="/org/device-groups"
              />
              <div className="flex items-center justify-center gap-5 mt-2 pt-3 border-t border-surface-100 dark:border-surface-800 flex-wrap">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 bg-primary-400 inline-block" /> Sources</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 bg-success-600 inline-block" /> Load</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: '#8B5CF6' }} /> Groups</span>
              </div>
            </div>
          )}

          {/* 2. KPI filter + clickable KPI cards */}
          <DashboardTelemetry
            sections="kpis"
            allDevicesLabel="All Organization Devices"
            powerKpiLabel="Total Power Consumption"
            emptyGroupsHint='No groups created yet. Go to "Access Groups" to create one.'
          />

          {/* 3. Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="My Devices" value={stats?.totalDevices ?? 0} icon={Cpu} color="primary" />
            <StatCard label="Online Devices" value={stats?.onlineDevices ?? 0} icon={CheckCircle} color="success" />
            <StatCard label="Active Alarms" value={stats?.activeAlarms ?? 0} icon={AlertTriangle} color="warning" />
            <StatCard label="Monthly Energy" value={stats?.monthlyEnergy ?? '—'} icon={Zap} color="info" />
          </div>

          {/* 4. Power Sources — Last 24 Hours */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Power Sources — Last 24 Hours</h3>
            <p className="text-xs text-surface-400 mt-1 mb-4">Solar, Generator, Grid and total Load over the last 24 hours — hover to compare all four at once</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={sourceSeries}>
                <defs>
                  <linearGradient id="srcSolar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} /><stop offset="95%" stopColor="#F5A623" stopOpacity={0} /></linearGradient>
                  <linearGradient id="srcGrid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="srcGen" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} /><stop offset="95%" stopColor="#22C55E" stopOpacity={0} /></linearGradient>
                  <linearGradient id="srcLoad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} /><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="load" stroke="#8B5CF6" fill="url(#srcLoad)" strokeWidth={2} name="Load" unit="kW" />
                <Area type="monotone" dataKey="solar" stroke="#F5A623" fill="url(#srcSolar)" strokeWidth={2} name="Solar" unit="kW" />
                <Area type="monotone" dataKey="generator" stroke="#22C55E" fill="url(#srcGen)" strokeWidth={2} name="Generator" unit="kW" />
                <Area type="monotone" dataKey="grid" stroke="#3B82F6" fill="url(#srcGrid)" strokeWidth={2} name="Grid" unit="kW" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
              {[{ label: 'Load', color: '#8B5CF6' }, { label: 'Solar', color: '#F5A623' }, { label: 'Generator', color: '#22C55E' }, { label: 'Grid', color: '#3B82F6' }].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-surface-500">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: l.color }} />{l.label}
                </span>
              ))}
            </div>
          </div>

          {/* 5. Asset Group Load — Last 24 Hours */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Asset Group Load — Last 24 Hours</h3>
            <p className="text-xs text-surface-400 mt-1 mb-4">Every device group at {orgName} plotted together — hover any point to see each group&apos;s detailed value, or click a group below to view its devices</p>
            {groupLoads.length === 0 ? (
              <div className="p-8 text-center text-xs text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-900/40 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
                No device groups yet. Create one in &quot;Device Groups&quot; to see the comparison here.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={deviceGroupSeries}>
                    <defs>
                      {groupLoads.map((g, i) => (
                        <linearGradient key={g.id} id={`groupGrad${g.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length]} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <Tooltip content={<CustomTooltip />} />
                    {groupLoads.map((g, i) => (
                      <Area
                        key={g.id}
                        type="monotone"
                        dataKey={g.id}
                        stroke={GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length]}
                        fill={`url(#groupGrad${g.id})`}
                        strokeWidth={2}
                        name={g.name}
                        unit="kW"
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  {groupLoads.map((g, i) => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => setOpenGroupId(g.id)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 px-2 py-1 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length] }} />
                      {g.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 6. Power Consumption — Last 24 Hours */}
          <div className="card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-surface-900 leading-none">Power Consumption — Last 24 Hours</h3>
              <p className="text-xs text-surface-400 mt-1 mb-4">Real-time load in kW logged at {orgName}</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={consumptionSeries}>
                <defs>
                  <linearGradient id="orgPowerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5A623" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <YAxis tick={{ fontSize: 11, fill: '#9AA09A' }} stroke="#D1D5C8" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="power" stroke="#F5A623" fill="url(#orgPowerGrad)" strokeWidth={2} name="Load" unit="kW" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* 7. Device Telemetry at bottom (CF order) */}
          <DashboardTelemetry
            sections="telemetry"
            panelTitle="Device Telemetry"
            showAccessFilter={false}
          />

          <Modal
            open={openGroup !== null}
            onClose={() => setOpenGroupId(null)}
            size="lg"
            title={openGroup ? `${openGroup.name} — Devices` : 'Devices'}
          >
            {openGroupDevices.length === 0 ? (
              <p className="text-xs text-surface-500 p-3 inset-panel">
                This group has no devices assigned yet.
              </p>
            ) : (
              <div className="space-y-3">
                {openGroupDevices.map((d) => {
                  const off = isOffline(d)
                  return (
                    <div key={d.id} className="p-3 inset-panel">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Cpu size={13} className="text-surface-400" />
                          <span className="text-xs font-black text-surface-800 dark:text-surface-100">{d.name}</span>
                        </div>
                        <span className={`badge ${off ? 'badge-neutral' : 'badge-success'} text-[9px]`}>{off ? 'Offline' : 'Online'}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[{ key: 'power', label: 'Power', unit: 'kW' }, { key: 'current', label: 'Current', unit: 'A' }, { key: 'voltage', label: 'Voltage', unit: 'V' }, { key: 'pf', label: 'PF', unit: '' }].map(({ key, label, unit }) => (
                          <div key={key} className="p-2 bg-white dark:bg-surface-900 rounded-lg border border-surface-100 dark:border-surface-800">
                            <p className="text-[9px] text-surface-400 font-bold uppercase">{label}</p>
                            <p className="text-xs font-black text-surface-900 dark:text-surface-100">
                              {liveTile(d, key)} <span className="text-[9px] text-surface-400 font-semibold">{unit}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Modal>
        </div>
      </Skeleton>
    </PageState>
  )
}
