import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import PageState, { useFetch } from '../../components/ui/PageState'
import Modal from '../../components/ui/Modal'
import { TextInput } from '../../components/ui/FormFields'
import DashboardTelemetry from '../../components/dashboard/DashboardTelemetry'
import PowerFlowMindMap from '../../components/ui/PowerFlowMindMap'
import { Cpu, AlertTriangle, Zap, CheckCircle, Pencil, Users } from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchOrgStats, fetchOrgEnergyOverview } from '../../utils/dashboardHelpers'
import { mapDevice, mapUser } from '../../utils/mappers'
import { readDeviceMetric, isOffline, isSwitchOff } from '../../utils/deviceMetrics'
import emsApi, { list, one } from '../../api/emsApi'

const GROUP_LINE_COLORS = ['#8B5CF6', '#F5A623', '#3B82F6', '#22C55E', '#EC4899', '#14B8A6', '#F97316', '#6366F1']
const TARIFF_PKR_PER_KWH = 28
const EMPTY_GROUP_FORM = { name: '', description: '', deviceIds: [], userIds: [] }

function EmptyChart({ children }) {
  return (
    <div className="p-8 text-center text-xs text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-900/40 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
      {children}
    </div>
  )
}

export default function OrgDashboard() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [liveDevices, setLiveDevices] = useState([])
  const [orgUsers, setOrgUsers] = useState([])
  const [openGroupId, setOpenGroupId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_GROUP_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [energy, setEnergy] = useState(null)

  const { data: stats, loading, error, reload } = useFetch(async () => {
    const orgStats = await fetchOrgStats()
    const activeAlarms = orgStats.anomalies.filter(
      (a) => a.alarmState === 'ACTIVE' || a.processState === 'UNPROCESSED'
    ).length
    return { ...orgStats, activeAlarms }
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

  useEffect(() => {
    emsApi.getUsers({ limit: 200 })
      .then((res) => setOrgUsers(list(res).map((u) => mapUser(u))))
      .catch(() => setOrgUsers([]))
  }, [])

  const [fallbackGroups, setFallbackGroups] = useState([])

  const refreshFallbackGroups = () => {
    emsApi.getDeviceGroups({ limit: 100 })
      .then((res) => setFallbackGroups(list(res).map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description || '',
        deviceIds: g.deviceIds ?? (g.devices || []).map((d) => d.id ?? d.deviceId).filter(Boolean),
        userIds: g.userIds ?? [],
      }))))
      .catch(() => {})
  }

  useEffect(() => {
    if (powerFlow?.groups?.length) return
    refreshFallbackGroups()
  }, [powerFlow?.groups?.length])

  const groupLoads = useMemo(() => {
    if (powerFlow?.groups?.length) return powerFlow.groups
    return fallbackGroups.map((g) => {
      const groupDevices = liveDevices.filter((d) => g.deviceIds.includes(d.id))
      const active = groupDevices.filter((d) => !isSwitchOff(d))
      const load = active.reduce((s, d) => {
        const v = readDeviceMetric(d, 'power')
        return s + (Number.isFinite(v) ? v : 0)
      }, 0)
      return {
        id: g.id,
        name: g.name,
        description: g.description || '',
        deviceIds: g.deviceIds,
        userIds: g.userIds || [],
        deviceCount: groupDevices.length,
        load: +load.toFixed(2),
        active: active.some((d) => !isOffline(d)),
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

  const closeGroupDetails = () => {
    setOpenGroupId(null)
    setEditOpen(false)
    setEditForm(EMPTY_GROUP_FORM)
  }

  const openEditGroup = async () => {
    if (!openGroup) return
    try {
      const res = await emsApi.getDeviceGroups({ limit: 100 })
      const full = list(res).find((g) => g.id === openGroup.id)
      const deviceIds = full?.deviceIds
        ?? (full?.devices || []).map((d) => d.id ?? d.deviceId).filter(Boolean)
        ?? openGroup.deviceIds
        ?? []
      const userIds = full?.userIds
        ?? (full?.users || []).map((u) => u.id ?? u.userId).filter(Boolean)
        ?? openGroup.userIds
        ?? []
      setEditForm({
        name: full?.name || openGroup.name || '',
        description: full?.description || openGroup.description || '',
        deviceIds: [...deviceIds],
        userIds: [...userIds],
      })
      setEditOpen(true)
    } catch (e) {
      showToast(e.message || 'Failed to load group', 'error')
    }
  }

  const toggleEditDevice = (id) => {
    setEditForm((prev) => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(id)
        ? prev.deviceIds.filter((x) => x !== id)
        : [...prev.deviceIds, id],
    }))
  }

  const toggleEditUser = (id) => {
    setEditForm((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(id)
        ? prev.userIds.filter((x) => x !== id)
        : [...prev.userIds, id],
    }))
  }

  const handleSaveGroupEdit = async () => {
    if (!openGroup) return
    if (!editForm.name.trim()) {
      showToast('Group name is required', 'error')
      return
    }
    if (!editForm.deviceIds.length) {
      showToast('Select at least one device', 'error')
      return
    }
    setEditSaving(true)
    try {
      await emsApi.updateDeviceGroup(openGroup.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        deviceIds: editForm.deviceIds,
        userIds: editForm.userIds,
      })
      showToast('Device group updated', 'success')
      setEditOpen(false)
      reloadPowerFlow()
      refreshFallbackGroups()
      // Refresh live devices so membership tiles update
      emsApi.getDevices({ limit: 100, withMetrics: true })
        .then((res) => setLiveDevices(list(res).map(mapDevice)))
        .catch(() => {})
    } catch (e) {
      showToast(e.message || 'Failed to update group', 'error')
    } finally {
      setEditSaving(false)
    }
  }

  const deviceIdKey = useMemo(() => {
    const ids = (stats?.devices ?? []).map((d) => d.id).filter(Boolean)
    return ids.length ? ids.join(',') : (liveDevices.map((d) => d.id).join(',') || '')
  }, [stats?.devices, liveDevices])

  useEffect(() => {
    const ids = deviceIdKey ? deviceIdKey.split(',') : []
    if (!ids.length) { setEnergy(null); return }
    let cancelled = false
    fetchOrgEnergyOverview(ids, '24h')
      .then((res) => { if (!cancelled) setEnergy(res) })
      .catch(() => { if (!cancelled) setEnergy(null) })
    return () => { cancelled = true }
  }, [deviceIdKey])

  const orgName = user?.organization?.name ?? 'your organization'
  const sourceSeries = energy?.series ?? []

  // One row per real bucket; a group only gets a series when its devices reported data
  const groupSeriesData = useMemo(() => {
    const loadByDevice = energy?.loadByDevice ?? {}
    const timestamps = energy?.timestamps ?? []
    if (!timestamps.length) return { rows: [], groups: [] }
    const plotted = groupLoads.filter((g) => (g.deviceIds || []).some((id) => loadByDevice[id]))
    const rows = timestamps.map((ts) => {
      const row = { time: sourceSeries.find((s) => s.ts === ts)?.time ?? '' }
      plotted.forEach((g) => {
        const total = (g.deviceIds || []).reduce((sum, id) => sum + (loadByDevice[id]?.get(ts) ?? 0), 0)
        row[g.id] = +total.toFixed(2)
      })
      return row
    })
    return { rows, groups: plotted }
  }, [energy, groupLoads, sourceSeries])

  const monthlyEnergy = Number.isFinite(energy?.monthlyEnergyKwh)
    ? `${Math.round(energy.monthlyEnergyKwh).toLocaleString()} kWh`
    : '—'

  // Savings: stored config → solar export history → live solarKw estimate (always an object so the card shows)
  const savings = useMemo(() => {
    const stored = powerFlow?.savings
    const storedTotal = (Number(stored?.daily) || 0) + (Number(stored?.weekly) || 0) + (Number(stored?.monthly) || 0)
    if (storedTotal > 0) {
      return { dailyKWh: Number(stored.dailyKWh) || 0, ...stored, unit: stored.unit || 'PKR' }
    }
    const bucketHours = energy?.bucketHours || 0
    if (bucketHours && sourceSeries.length) {
      const offsetKWh = sourceSeries.reduce((sum, row) => sum + (Number(row.solar) || 0) * bucketHours, 0)
      if (offsetKWh > 0) {
        return {
          dailyKWh: +offsetKWh.toFixed(1),
          daily: Math.round(offsetKWh * TARIFF_PKR_PER_KWH),
          weekly: Math.round(offsetKWh * 7 * TARIFF_PKR_PER_KWH),
          monthly: Math.round(offsetKWh * 30 * TARIFF_PKR_PER_KWH),
          unit: 'PKR',
        }
      }
    }
    const solarKw = Number(powerFlow?.solarKw)
      || Number((powerFlow?.sources || []).find((s) => s.type === 'solar' || s.id === 'solar')?.valueKw)
      || 0
    const dailyKWh = +(solarKw * 24).toFixed(1)
    return {
      dailyKWh,
      daily: Math.round(dailyKWh * TARIFF_PKR_PER_KWH),
      weekly: Math.round(dailyKWh * 7 * TARIFF_PKR_PER_KWH),
      monthly: Math.round(dailyKWh * 30 * TARIFF_PKR_PER_KWH),
      unit: 'PKR',
    }
  }, [powerFlow, energy, sourceSeries])

  const liveTile = (d, key) => {
    if (isSwitchOff(d)) return '—'
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
          {/* 1. Energy Flow Overview */}
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
            <StatCard label="Monthly Energy" value={monthlyEnergy} icon={Zap} color="info" />
          </div>

          {/* 4. Power Sources — Last 24 Hours */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Power Sources — Last 24 Hours</h3>
            <p className="text-xs text-surface-400 mt-1 mb-4">
              Fleet load from device power variables (ActivePower / PowerConsumption), plus export when available; Grid is load − export
            </p>
            {sourceSeries.length === 0 ? (
              <EmptyChart>No logged readings in the last 24 hours yet.</EmptyChart>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={sourceSeries}>
                    <defs>
                      <linearGradient id="srcSolar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} /><stop offset="95%" stopColor="#F5A623" stopOpacity={0} /></linearGradient>
                      <linearGradient id="srcGrid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                      <linearGradient id="srcLoad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} /><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="load" stroke="#8B5CF6" fill="url(#srcLoad)" strokeWidth={2} name="Load" unit="kW" />
                    <Area type="monotone" dataKey="solar" stroke="#F5A623" fill="url(#srcSolar)" strokeWidth={2} name="Solar" unit="kW" />
                    <Area type="monotone" dataKey="grid" stroke="#3B82F6" fill="url(#srcGrid)" strokeWidth={2} name="Grid" unit="kW" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
                  {[{ label: 'Load', color: '#8B5CF6' }, { label: 'Solar', color: '#F5A623' }, { label: 'Grid', color: '#3B82F6' }].map((l) => (
                    <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-surface-500">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: l.color }} />{l.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 5. Asset Group Load — Last 24 Hours */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Asset Group Load — Last 24 Hours</h3>
            <p className="text-xs text-surface-400 mt-1 mb-4">
              Sum of each group&apos;s device load (kW) at {orgName} — hover for values, or click a group to open its devices
            </p>
            {groupLoads.length === 0 ? (
              <EmptyChart>No device groups yet. Create one in &quot;Device Groups&quot; to see the comparison here.</EmptyChart>
            ) : groupSeriesData.groups.length === 0 ? (
              <EmptyChart>No logged readings for these groups in the last 24 hours yet.</EmptyChart>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={groupSeriesData.rows}>
                    <defs>
                      {groupSeriesData.groups.map((g, i) => (
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
                    {groupSeriesData.groups.map((g, i) => (
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
                  {groupSeriesData.groups.map((g, i) => (
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
              <p className="text-xs text-surface-400 mt-1 mb-4">Total fleet load (kW) across all devices at {orgName}</p>
            </div>
            {sourceSeries.length === 0 ? (
              <EmptyChart>No logged readings in the last 24 hours yet.</EmptyChart>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={sourceSeries}>
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
                  <Area type="monotone" dataKey="load" stroke="#F5A623" fill="url(#orgPowerGrad)" strokeWidth={2} name="Load" unit="kW" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 7. Device Telemetry */}
          <DashboardTelemetry
            sections="telemetry"
            panelTitle="Device Telemetry"
            showAccessFilter={false}
          />

          <Modal
            open={openGroup !== null && !editOpen}
            onClose={closeGroupDetails}
            size="lg"
            title={openGroup ? `${openGroup.name} — Devices` : 'Devices'}
            footer={
              <>
                <button type="button" className="btn-secondary" onClick={closeGroupDetails}>Close</button>
                <button type="button" className="btn-primary" onClick={openEditGroup}>
                  <Pencil size={14} /> Edit Group
                </button>
              </>
            }
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

          <Modal
            open={editOpen && openGroup !== null}
            onClose={() => setEditOpen(false)}
            size="md"
            title="Edit Device Group"
            footer={
              <>
                <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveGroupEdit}
                  disabled={editSaving || !editForm.name.trim() || !editForm.deviceIds.length}
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <TextInput
                label="Group Name"
                required
                placeholder="e.g. Washing Area, Boilers, G1..."
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
              <TextInput
                label="Description"
                placeholder="e.g. All washing machines on ground floor"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />

              <div>
                <label className="label">
                  Add Devices
                  <span className="text-danger-600 font-bold ml-0.5">*</span>
                  <span className="ml-1 text-surface-400 font-normal">({editForm.deviceIds.length})</span>
                </label>
                {liveDevices.length === 0 ? (
                  <div className="p-3 inset-panel space-y-3">
                    <p className="text-xs text-surface-500">
                      No devices available. Add a device first, then come back to edit this group.
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setEditOpen(false)
                        closeGroupDetails()
                        navigate('/org/devices')
                      }}
                    >
                      <Cpu size={14} /> Go to Devices
                    </button>
                  </div>
                ) : (
                  <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-56 overflow-y-auto">
                    {liveDevices.map((d) => (
                      <label key={d.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800">
                        <input
                          type="checkbox"
                          className="rounded border-surface-300 text-primary-600"
                          checked={editForm.deviceIds.includes(d.id)}
                          onChange={() => toggleEditDevice(d.id)}
                        />
                        <Cpu size={13} className="text-surface-400 flex-shrink-0" />
                        <span className="text-sm text-surface-800 dark:text-surface-100 flex-1">{d.name}</span>
                        <span className={`badge text-[9px] ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                          {d.status}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {liveDevices.length > 0 && editForm.deviceIds.length === 0 && (
                  <p className="text-[11px] text-danger-600 mt-1.5 font-semibold">Select at least one device</p>
                )}
              </div>

              <div>
                <label className="label">
                  Add Users
                  <span className="ml-1 text-surface-400 font-normal">({editForm.userIds.length})</span>
                </label>
                {orgUsers.length === 0 ? (
                  <p className="text-xs text-surface-500 p-3 inset-panel">No users found.</p>
                ) : (
                  <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-48 overflow-y-auto">
                    {orgUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800">
                        <input
                          type="checkbox"
                          className="rounded border-surface-300 text-primary-600"
                          checked={editForm.userIds.includes(u.id)}
                          onChange={() => toggleEditUser(u.id)}
                        />
                        <Users size={13} className="text-surface-400 flex-shrink-0" />
                        <span className="text-sm text-surface-800 dark:text-surface-100 flex-1">{u.name}</span>
                        <span className="text-[10px] text-surface-400">{u.role}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Modal>
        </div>
      </Skeleton>
    </PageState>
  )
}
