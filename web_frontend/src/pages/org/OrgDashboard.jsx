import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import PageState, { useFetch } from '../../components/ui/PageState'
import Modal from '../../components/ui/Modal'
import DeviceSlaveSelector from '../../components/shared/DeviceSlaveSelector'
import DashboardTelemetry from '../../components/dashboard/DashboardTelemetry'
import PowerFlowMindMap from '../../components/ui/PowerFlowMindMap'
import { useDevices } from '../../context/DeviceContext'
import { Cpu, AlertTriangle, Zap, CheckCircle, Smartphone } from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchOrgStats, fetchDashboardChart } from '../../utils/dashboardHelpers'
import { mapDevice } from '../../utils/mappers'
import { readDeviceMetric, isOffline } from '../../utils/deviceMetrics'
import emsApi, { list, one } from '../../api/emsApi'

const GROUP_COLORS = ['#8B5CF6', '#F5A623', '#3B82F6', '#22C55E', '#EC4899', '#14B8A6', '#F97316', '#6366F1']

export default function OrgDashboard() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { selectedDeviceId, selectedSlaveId } = useDevices()
  const [chartBundle, setChartBundle] = useState({ power: [], multi: [], lines: [] })

  const { data: stats, loading, error, reload } = useFetch(async () => {
    const orgStats = await fetchOrgStats()
    let monthlyEnergy = '—'
    const deviceId = selectedDeviceId
    if (deviceId) {
      try {
        const summary = await emsApi.getDashboardSummary({ deviceId, timeRange: '30d' })
        const val = summary?.data?.energySavingsComparison?.monthly?.current
          ?? summary?.data?.totalPowerConsumption?.value
        if (val != null) monthlyEnergy = `${Number(val).toLocaleString()} kWh`
      } catch (_) {}
    }
    const activeAlarms = orgStats.anomalies.filter(
      (a) => a.alarmState === 'ACTIVE' || a.processState === 'UNPROCESSED'
    ).length
    return { ...orgStats, activeAlarms, monthlyEnergy }
  }, [selectedDeviceId])

  const { data: powerFlow, reload: reloadPowerFlow } = useFetch(async () => {
    const res = await emsApi.getPowerFlow()
    const payload = one(res) || {}
    const sources = Array.isArray(payload.sources) ? payload.sources : []
    return { sources, savings: payload.savings || null }
  }, [])

  // Device groups + live device metrics — drives Asset Group Load chart + group modal + power-flow leaves
  const [liveDevices, setLiveDevices] = useState([])
  const [deviceGroups, setDeviceGroups] = useState([])
  const [openGroupId, setOpenGroupId] = useState(null)

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

  useEffect(() => {
    emsApi.getDeviceGroups({ limit: 100 })
      .then((res) => setDeviceGroups(list(res).map((g) => ({
        id: g.id,
        name: g.name,
        deviceIds: g.deviceIds ?? (g.devices || []).map((d) => d.id ?? d.deviceId).filter(Boolean),
      }))))
      .catch(() => {})
  }, [])

  // Live current load (kW) per device group, from device latestMetrics
  const groupLoads = useMemo(() => deviceGroups.map((g) => {
    const groupDevices = liveDevices.filter((d) => g.deviceIds.includes(d.id))
    const online = groupDevices.filter((d) => !isOffline(d))
    const load = online.reduce((s, d) => {
      const v = readDeviceMetric(d, 'power')
      return s + (Number.isFinite(v) ? v : 0)
    }, 0)
    return { id: g.id, name: g.name, deviceCount: groupDevices.length, load: +load.toFixed(2), active: online.length > 0 }
  }), [deviceGroups, liveDevices])

  const openGroup = useMemo(() => deviceGroups.find((g) => g.id === openGroupId) || null, [deviceGroups, openGroupId])
  const openGroupDevices = useMemo(
    () => (openGroup ? liveDevices.filter((d) => openGroup.deviceIds.includes(d.id)) : []),
    [openGroup, liveDevices]
  )

  useEffect(() => {
    if (!selectedDeviceId) { setChartBundle({ power: [], multi: [], lines: [] }); return }
    fetchDashboardChart(selectedDeviceId, '24h', selectedSlaveId).then(setChartBundle)
  }, [selectedDeviceId, selectedSlaveId])

  const orgName = user?.organization?.name ?? 'your organization'
  const devices = stats?.devices ?? []

  // Power Sources — Last 24 Hours: real load curve (chartBundle.power) split across the
  // current source mix (getPowerFlow) so Solar + Generator + Grid ≈ Load at each point.
  const sourceSeries = useMemo(() => {
    const pts = chartBundle.power ?? []
    if (!pts.length) return []
    const sources = powerFlow?.sources ?? []
    const val = (type) => Number(sources.find((s) => (s.type || s.id) === type)?.valueKw) || 0
    const solarCur = val('solar'), genCur = val('generator'), gridCur = val('grid')
    const totalCur = solarCur + genCur + gridCur
    return pts.map((p) => {
      const loadVal = Number(p.power) || 0
      if (totalCur <= 0) return { time: p.time, load: +loadVal.toFixed(2), solar: 0, generator: 0, grid: +loadVal.toFixed(2) }
      return {
        time: p.time,
        load: +loadVal.toFixed(2),
        solar: +(loadVal * (solarCur / totalCur)).toFixed(2),
        generator: +(loadVal * (genCur / totalCur)).toFixed(2),
        grid: +(loadVal * (gridCur / totalCur)).toFixed(2),
      }
    })
  }, [chartBundle.power, powerFlow])

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
        <div className="bg-white border border-surface-200 p-3 rounded-lg shadow-floating text-xs font-semibold text-surface-800">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="My Devices" value={stats?.totalDevices ?? 0} icon={Cpu} color="primary" />
            <StatCard label="Online Devices" value={stats?.onlineDevices ?? 0} icon={CheckCircle} color="success" />
            <StatCard label="Active Alarms" value={stats?.activeAlarms ?? 0} icon={AlertTriangle} color="warning" />
            <StatCard label="Monthly Energy" value={stats?.monthlyEnergy ?? '—'} icon={Zap} color="info" />
          </div>

          <DashboardTelemetry panelTitle="Organization Device Control" />

          <DeviceSlaveSelector onChange={reload} />

          {powerFlow && (
            <div className="card p-5">
              <h3 className="text-2xl font-extrabold tracking-tight text-center mb-3 bg-gradient-to-r from-primary-500 via-purple-500 to-success-500 bg-clip-text text-transparent">
                Energy Flow Overview
              </h3>
              <PowerFlowMindMap
                sources={powerFlow.sources}
                savings={powerFlow.savings}
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

          <div className="card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-surface-900 leading-none">Power Consumption — Last 24 Hours</h3>
              <p className="text-xs text-surface-400 mt-1 mb-4">Real-time load in kW logged at {orgName}</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartBundle.power}>
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

          {sourceSeries.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Power Sources — Last 24 Hours</h3>
              <p className="text-xs text-surface-400 mt-1 mb-4">Real load curve split across the current Solar / Generator / Grid source mix</p>
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
          )}

          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Asset Group Load — Live</h3>
            <p className="text-xs text-surface-400 mt-1 mb-4">Current load (kW) per device group at {orgName} — click a bar or chip to view its devices</p>
            {groupLoads.length === 0 ? (
              <div className="p-8 text-center text-xs text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-900/40 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
                No device groups yet. Create one in "Device Groups" to see the comparison here.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={groupLoads}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="load" radius={[4, 4, 0, 0]} name="Load" unit="kW" onClick={(d) => d?.id && setOpenGroupId(d.id)} cursor="pointer" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  {groupLoads.map((g, i) => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => setOpenGroupId(g.id)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 px-2 py-1 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full inline-block ${g.active ? 'bg-success-500' : 'bg-surface-400'}`} />
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                      {g.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-surface-200">
              <div>
                <h3 className="text-sm font-bold text-surface-900">My Devices</h3>
                <p className="text-xs text-surface-400 mt-0.5">Active equipment assigned to {orgName}</p>
              </div>
              <span className="badge badge-neutral flex items-center gap-1"><Smartphone size={11} /> {devices.length} Total</span>
            </div>
            <div className="divide-y divide-surface-100 flex-1">
              {devices.length === 0 ? (
                <div className="p-8 text-center text-surface-500 text-xs">No devices found.</div>
              ) : (
                devices.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors duration-100">
                    <span className={`badge ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>{d.status}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-surface-800 leading-tight">{d.name}</p>
                      <p className="text-xs text-surface-400 mt-0.5 truncate">{d.template}</p>
                    </div>
                    <span className="text-xs text-surface-500 font-semibold flex-shrink-0">{d.gateway}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <Modal
            open={openGroup !== null}
            onClose={() => setOpenGroupId(null)}
            size="lg"
            title={openGroup ? `${openGroup.name} — Devices` : 'Devices'}
          >
            {openGroupDevices.length === 0 ? (
              <p className="text-xs text-surface-400 p-3 bg-surface-50 dark:bg-surface-900/40 rounded-lg">
                This group has no devices assigned yet.
              </p>
            ) : (
              <div className="space-y-3">
                {openGroupDevices.map((d) => {
                  const off = isOffline(d)
                  return (
                    <div key={d.id} className="p-3 bg-surface-50/60 dark:bg-surface-900/40 rounded-xl border border-surface-200 dark:border-surface-800">
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
