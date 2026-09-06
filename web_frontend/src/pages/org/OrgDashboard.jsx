import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../components/ui/StatCard'
import PageState, { useFetch } from '../../components/ui/PageState'
import Modal from '../../components/ui/Modal'
import { TextInput } from '../../components/ui/FormFields'
import DashboardTelemetry from '../../components/dashboard/DashboardTelemetry'
import PowerFlowMindMap from '../../components/ui/PowerFlowMindMap'
import { Cpu, AlertTriangle, Zap, CheckCircle, Users } from 'lucide-react'
import { Skeleton } from 'boneyard-js/react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchOrgStats, fetchOrgEnergyOverview } from '../../utils/dashboardHelpers'
import { mapDevice, mapUser } from '../../utils/mappers'
import { readDeviceMetric, isOffline, isSwitchOff } from '../../utils/deviceMetrics'
import emsApi, { list, one } from '../../api/emsApi'

const GROUP_LINE_COLORS = ['#8B5CF6', '#F5A623', '#3B82F6', '#22C55E', '#EC4899', '#14B8A6', '#F97316', '#6366F1']
const SOURCE_TYPE_COLORS = {
  grid: '#3B82F6',
  solar: '#F5A623',
  generator: '#22C55E',
}
const TARIFF_PKR_PER_KWH = 28
const EMPTY_GROUP_FORM = { name: '', description: '', deviceIds: [], slaveIds: [], userIds: [] }

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
  const [editGroupId, setEditGroupId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_GROUP_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [energy, setEnergy] = useState(null)
  const [kpiScope, setKpiScope] = useState({ deviceId: null, device: null })
  const [slaveModalOpen, setSlaveModalOpen] = useState(false)
  const [slaveFilterTab, setSlaveFilterTab] = useState('all') // 'all' | 'online' | 'offline'
  const [slaveSearchQuery, setSlaveSearchQuery] = useState('')
  const isDeviceKpiScoped = Boolean(kpiScope.deviceId)

  function formatRelativeTime(dateStr) {
    if (!dateStr) return 'Never received'
    const ts = new Date(dateStr).getTime()
    if (!Number.isFinite(ts)) return 'Never received'
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
    if (diffSec < 10) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}h ${diffMin % 60}m ago`
    const diffDay = Math.floor(diffHour / 24)
    return `${diffDay}d ago`
  }

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
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  // Refresh power-flow sources/groups periodically (loads are also overlaid from liveDevices)
  useEffect(() => {
    const id = setInterval(() => { reloadPowerFlow() }, 15000)
    return () => clearInterval(id)
  }, [reloadPowerFlow])

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
        slaveIds: g.slaveIds ?? (g.slaves || []).map((s) => s.id ?? s.slaveId).filter(Boolean),
        slaves: g.slaves || [],
        userIds: g.userIds ?? [],
      }))))
      .catch(() => {})
  }

  useEffect(() => {
    refreshFallbackGroups()
  }, [powerFlow?.groups?.length])

  /** Always compute group kW from live metrics and backend power-flow aggregation. */
  const groupLoads = useMemo(() => {
    const base = powerFlow?.groups?.length
      ? powerFlow.groups
      : fallbackGroups.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description || '',
          deviceIds: g.deviceIds || [],
          slaveIds: g.slaveIds || [],
          slaves: g.slaves || [],
          userIds: g.userIds || [],
          deviceCount: g.deviceIds?.length || 0,
          slaveCount: g.slaveIds?.length || 0,
          load: 0,
          active: false,
        }))

    return base.map((g) => {
      const ids = g.deviceIds || []
      const groupDevices = liveDevices.filter((d) => ids.includes(d.id))
      const active = groupDevices.filter((d) => !isSwitchOff(d))
      let load = g.loadKw != null ? Number(g.loadKw) : (g.load != null ? Number(g.load) : 0)
      if (!g.loadKw && !g.slaveIds?.length) {
        load = active.reduce((s, d) => {
          const v = readDeviceMetric(d, 'power')
          return s + (Number.isFinite(v) ? v : 0)
        }, 0)
      }
      return {
        ...g,
        deviceIds: ids,
        slaveIds: g.slaveIds || [],
        deviceCount: groupDevices.length || g.deviceCount || ids.length,
        slaveCount: (g.slaveIds || []).length || g.slaveCount || 0,
        load: +load.toFixed(2),
        active: active.some((d) => !isOffline(d)) || (g.slaveIds?.length > 0 && load > 0),
      }
    })
  }, [powerFlow, fallbackGroups, liveDevices])

  /** Sum of all org devices' live ActivePower (kW) — true total load. */
  const liveFleetKw = useMemo(() => {
    const total = liveDevices
      .filter((d) => !isSwitchOff(d))
      .reduce((s, d) => {
        const v = readDeviceMetric(d, 'power')
        return s + (Number.isFinite(v) ? v : 0)
      }, 0)
    return +total.toFixed(2)
  }, [liveDevices])

  /**
   * Sources linked to real devices / slaves → live ActivePower (kW).
   * Sources with no linked devices stay at 0 kW (including Grid).
   */
  const liveSources = useMemo(() => {
    const builtins = [
      { id: 'grid', name: 'Grid', type: 'grid' },
      { id: 'solar', name: 'Solar', type: 'solar' },
      { id: 'generator', name: 'Generator', type: 'generator' },
    ]
    let sources = (powerFlow?.sources || []).map((s) => ({
      ...s,
      deviceIds: Array.isArray(s.deviceIds) ? s.deviceIds.filter(Boolean) : [],
      slaveIds: Array.isArray(s.slaveIds) ? s.slaveIds.filter(Boolean) : [],
    }))
    for (const b of builtins) {
      if (!sources.some((s) => s.type === b.type || s.id === b.id)) {
        sources.push({ ...b, deviceIds: [], slaveIds: [], valueKw: 0 })
      }
    }

    const powerOf = (ids) => {
      let sum = 0
      for (const id of ids) {
        const d = liveDevices.find((x) => x.id === id)
        if (!d || isSwitchOff(d)) continue
        const v = readDeviceMetric(d, 'power')
        if (Number.isFinite(v)) sum += v
      }
      return +sum.toFixed(2)
    }

    return sources.map((s) => {
      const ids = s.deviceIds || []
      const sIds = s.slaveIds || []
      if (!ids.length && !sIds.length) return { ...s, valueKw: 0, derived: false }
      // If backend calculated live kW with slave resolution, preserve s.valueKw
      const val = s.valueKw != null ? Number(s.valueKw) : (ids.length ? powerOf(ids) : 0)
      return { ...s, valueKw: +val.toFixed(2), derived: false }
    })
  }, [powerFlow, liveDevices])

  /** Total organization load: exact sum of active supply sources, or live fleet fallback. */
  const totalOrgLoadKw = useMemo(() => {
    const linkedSources = (liveSources || []).filter((s) => (s.deviceIds?.length || 0) + (s.slaveIds?.length || 0) > 0)
    if (linkedSources.length > 0) {
      const sum = linkedSources.reduce((s, src) => s + (Number(src.valueKw) || 0), 0)
      return +sum.toFixed(2)
    }
    return liveFleetKw
  }, [liveSources, liveFleetKw])

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
  }

  const closeEditGroup = () => {
    setEditOpen(false)
    setEditGroupId(null)
    setEditForm(EMPTY_GROUP_FORM)
  }

  const openEditGroupById = async (groupId) => {
    const targetId = groupId || openGroupId
    if (!targetId) return
    const fallback = groupLoads.find((g) => g.id === targetId)
    try {
      const res = await emsApi.getDeviceGroups({ limit: 100 })
      const full = list(res).find((g) => g.id === targetId)
      const deviceIds = full?.deviceIds
        ?? (full?.devices || []).map((d) => d.id ?? d.deviceId).filter(Boolean)
        ?? fallback?.deviceIds
        ?? []
      const slaveIds = full?.slaveIds
        ?? (full?.slaves || []).map((s) => s.id ?? s.slaveId).filter(Boolean)
        ?? fallback?.slaveIds
        ?? []
      const userIds = full?.userIds
        ?? (full?.users || []).map((u) => u.id ?? u.userId).filter(Boolean)
        ?? fallback?.userIds
        ?? []
      setEditGroupId(targetId)
      setEditForm({
        name: full?.name || fallback?.name || '',
        description: full?.description || fallback?.description || '',
        deviceIds: [...deviceIds],
        slaveIds: [...slaveIds],
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

  const toggleEditSlave = (id) => {
    setEditForm((prev) => ({
      ...prev,
      slaveIds: (prev.slaveIds || []).includes(id)
        ? prev.slaveIds.filter((x) => x !== id)
        : [...(prev.slaveIds || []), id],
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
    if (!editGroupId) return
    if (!editForm.name.trim()) {
      showToast('Group name is required', 'error')
      return
    }
    const hasMembers = (editForm.deviceIds?.length || 0) + (editForm.slaveIds?.length || 0) > 0
    if (!hasMembers) {
      showToast('Select at least one slave or device', 'error')
      return
    }
    setEditSaving(true)
    try {
      await emsApi.updateDeviceGroup(editGroupId, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        deviceIds: editForm.deviceIds || [],
        slaveIds: editForm.slaveIds || [],
        userIds: editForm.userIds || [],
      })
      showToast('Device group updated', 'success')
      closeEditGroup()
      reloadPowerFlow()
      refreshFallbackGroups()
      emsApi.getDevices({ limit: 100, withMetrics: true })
        .then((res) => setLiveDevices(list(res).map(mapDevice)))
        .catch(() => {})
    } catch (e) {
      showToast(e.message || 'Failed to update group', 'error')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await emsApi.deleteDeviceGroup(deleteTarget.id)
      showToast('Device group deleted', 'success')
      if (openGroupId === deleteTarget.id) setOpenGroupId(null)
      if (editGroupId === deleteTarget.id) closeEditGroup()
      setDeleteTarget(null)
      reloadPowerFlow()
      refreshFallbackGroups()
    } catch (e) {
      showToast(e.message || 'Failed to delete group', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const deviceIdKey = useMemo(() => {
    const ids = (stats?.devices ?? []).map((d) => d.id).filter(Boolean)
    return ids.length ? ids.join(',') : (liveDevices.map((d) => d.id).join(',') || '')
  }, [stats?.devices, liveDevices])

  const slaveIdKey = useMemo(() => {
    const sourceSlaves = (powerFlow?.sources || []).flatMap((s) => s.slaveIds || [])
    const groupSlaves = (powerFlow?.groups || []).flatMap((g) => g.slaveIds || [])
    const fallbackSlaves = fallbackGroups.flatMap((g) => g.slaveIds || [])
    return [...new Set([...sourceSlaves, ...groupSlaves, ...fallbackSlaves].filter(Boolean))].join(',')
  }, [powerFlow?.sources, powerFlow?.groups, fallbackGroups])

  useEffect(() => {
    const ids = deviceIdKey ? deviceIdKey.split(',') : []
    const slaveIds = slaveIdKey ? slaveIdKey.split(',') : []
    if (!ids.length && !slaveIds.length) { setEnergy(null); return }
    let cancelled = false
    fetchOrgEnergyOverview(ids, '24h', 40, slaveIds)
      .then((res) => { if (!cancelled) setEnergy(res) })
      .catch(() => { if (!cancelled) setEnergy(null) })
    return () => { cancelled = true }
  }, [deviceIdKey, slaveIdKey])

  const orgName = user?.organization?.name ?? 'your organization'
  const sourceSeries = energy?.series ?? []

  // Chart: only power sources that have linked devices or slaves (not fleet "Load")
  const powerSourceChart = useMemo(() => {
    const loadByDevice = energy?.loadByDevice ?? {}
    const timestamps = energy?.timestamps ?? []
    const linked = (liveSources || []).filter((s) => (s.deviceIds?.length || 0) + (s.slaveIds?.length || 0) > 0)
    if (!timestamps.length || !linked.length) return { rows: [], series: [] }

    const series = linked.map((s, i) => ({
      key: String(s.id || s.type || `src_${i}`),
      name: s.name || s.type || `Source ${i + 1}`,
      color: SOURCE_TYPE_COLORS[s.type] || GROUP_LINE_COLORS[i % GROUP_LINE_COLORS.length],
      deviceIds: s.deviceIds || [],
      slaveIds: s.slaveIds || [],
      type: s.type,
      valueKw: s.valueKw || 0,
    })).filter((s) => (
      s.deviceIds.some((id) => loadByDevice[id]) ||
      s.slaveIds.some((id) => loadByDevice[id]) ||
      (s.type === 'solar' && energy?.solarByTs?.size > 0) ||
      s.valueKw > 0
    ))

    if (!series.length) return { rows: [], series: [] }

    const rows = timestamps.map((ts, idx) => {
      const isLatest = idx === timestamps.length - 1
      const row = { time: sourceSeries.find((s) => s.ts === ts)?.time ?? '', ts }
      series.forEach((ser) => {
        let total = 0
        ser.deviceIds.forEach((id) => {
          total += (loadByDevice[id]?.get(ts) ?? 0)
        })
        ser.slaveIds.forEach((id) => {
          total += (loadByDevice[id]?.get(ts) ?? 0)
        })
        if (ser.type === 'solar' && total === 0 && energy?.solarByTs?.get(ts)) {
          total = energy.solarByTs.get(ts)
        }
        if (isLatest && total === 0 && ser.valueKw > 0) {
          total = ser.valueKw
        }
        row[ser.key] = +total.toFixed(2)
      })
      return row
    })
    return { rows, series }
  }, [energy, liveSources, sourceSeries])

  // One row per real bucket; a group gets a series when its devices or slaves reported data
  const groupSeriesData = useMemo(() => {
    const loadByDevice = energy?.loadByDevice ?? {}
    const timestamps = energy?.timestamps ?? []
    if (!timestamps.length) return { rows: [], groups: [] }
    const plotted = groupLoads.filter((g) => (
      (g.deviceIds || []).some((id) => loadByDevice[id]) ||
      (g.slaveIds || []).some((id) => loadByDevice[id]) ||
      (g.load > 0)
    ))
    const rows = timestamps.map((ts, idx) => {
      const isLatest = idx === timestamps.length - 1
      const row = { time: sourceSeries.find((s) => s.ts === ts)?.time ?? '' }
      plotted.forEach((g) => {
        let total = 0
        ;(g.deviceIds || []).forEach((id) => {
          total += (loadByDevice[id]?.get(ts) ?? 0)
        })
        ;(g.slaveIds || []).forEach((id) => {
          total += (loadByDevice[id]?.get(ts) ?? 0)
        })
        if (isLatest && total === 0 && g.load > 0) {
          total = g.load
        }
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
      // Persist linkage (deviceIds and slaveIds); live valueKw is recomputed on read
      const toSave = (sources || []).map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        deviceIds: Array.isArray(s.deviceIds) ? s.deviceIds : [],
        slaveIds: Array.isArray(s.slaveIds) ? s.slaveIds : [],
        from: s.from,
        to: s.to,
        iconIdx: s.iconIdx,
        valueKw: Number(s.valueKw) || 0,
      }))
      await emsApi.updatePowerFlow({ sources: toSave, savings: powerFlow?.savings })
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
              <span className="device-metric-value font-bold">{item.value} {item.unit || ''}</span>
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
                sources={liveSources}
                savings={savings}
                groups={groupLoads}
                devices={liveDevices}
                totalLoadKw={totalOrgLoadKw}
                orgName={orgName}
                onSourcesChange={handleSourcesChange}
                onGroupClick={setOpenGroupId}
                onGroupEdit={openEditGroupById}
                onGroupDelete={(id) => {
                  const g = groupLoads.find((x) => x.id === id)
                  if (g) setDeleteTarget(g)
                }}
                groupsPath="/org/device-groups"
                devicesPath="/org/devices"
              />
              <div className="flex items-center justify-center gap-5 mt-2 pt-3 border-t border-surface-100 dark:border-surface-800 flex-wrap">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 bg-primary-400 inline-block" /> Sources</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 bg-success-600 inline-block" /> Load</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-surface-400"><span className="w-3 h-0.5 inline-block" style={{ backgroundColor: '#8B5CF6' }} /> Groups</span>
              </div>
            </div>
          )}

          {/* 2. KPI filter + clickable KPI cards (device-scoped) */}
          <DashboardTelemetry
            sections="kpis"
            filterMode="device"
            allDevicesLabel="All Organization Devices"
            powerKpiLabel="Total Power Consumption"
            emptyGroupsHint="No devices found for this organization."
            onScopeChange={setKpiScope}
          />

          {/* 3. Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => { setSlaveFilterTab('all'); setSlaveModalOpen(true) }}
              className="cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
              title="Click to view all data nodes and slave statuses"
            >
              <StatCard
                label="Total Slaves"
                value={stats?.totalSlaves ?? 0}
                icon={Cpu}
                color="primary"
                sub="Click to view slave nodes"
              />
            </div>
            <div
              onClick={() => { setSlaveFilterTab(stats?.offlineSlaves > 0 ? 'offline' : 'all'); setSlaveModalOpen(true) }}
              className="cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
              title="Click to inspect online/offline slave breakdown"
            >
              <StatCard
                label="Online Slaves"
                value={`${stats?.onlineSlaves ?? 0} / ${stats?.totalSlaves ?? 0}`}
                icon={CheckCircle}
                color="success"
                sub={stats?.offlineSlaves > 0 ? `${stats.offlineSlaves} offline · Click to inspect` : 'All slaves online'}
              />
            </div>
            <StatCard label="Active Alarms" value={stats?.activeAlarms ?? 0} icon={AlertTriangle} color="warning" />
            <StatCard label="Monthly Energy" value={monthlyEnergy} icon={Zap} color="info" />
          </div>

          {/* 4–6. Org-wide history charts — hidden when a single device is selected in KPI filter */}
          {!isDeviceKpiScoped && (
          <>
          {/* 4. Power Sources — Last 24 Hours (linked sources only) */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-none">Power Sources — Last 24 Hours</h3>
            <p className="text-xs text-surface-400 mt-1 mb-4">
              Live history for each power source from its linked devices (ActivePower)
            </p>
            {!(liveSources || []).some((s) => (s.deviceIds?.length || 0) + (s.slaveIds?.length || 0) > 0) ? (
              <EmptyChart>Link devices or slaves to Grid, Solar, Generator, or a custom source above to see their 24h history here.</EmptyChart>
            ) : powerSourceChart.series.length === 0 ? (
              <EmptyChart>No logged readings for linked power sources in the last 24 hours yet.</EmptyChart>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={powerSourceChart.rows}>
                    <defs>
                      {powerSourceChart.series.map((s) => (
                        <linearGradient key={s.key} id={`srcGrad${s.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECEEE6" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <YAxis tick={{ fontSize: 10, fill: '#9AA09A' }} stroke="#D1D5C8" />
                    <Tooltip content={<CustomTooltip />} />
                    {powerSourceChart.series.map((s) => (
                      <Area
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        stroke={s.color}
                        fill={`url(#srcGrad${s.key})`}
                        strokeWidth={2}
                        name={s.name}
                        unit="kW"
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
                  {powerSourceChart.series.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5 text-[10px] font-bold text-surface-500">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                      {s.name}
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
          </>
          )}

          {/* 7. Device Telemetry (org-wide list + search; KPI device filter is separate) */}
          <DashboardTelemetry
            sections="telemetry"
            panelTitle="Device Telemetry"
            showAccessFilter={false}
            telemetrySubtitle={`Showing 5 latest devices. Use the search bar to find past devices for ${orgName}.`}
          />

          {/* 8. Slave Health & Diagnostic Inspector Modal */}
          <Modal
            open={slaveModalOpen}
            onClose={() => setSlaveModalOpen(false)}
            size="lg"
            title="Data Nodes & Slaves Status"
          >
            <div className="space-y-4">
              {/* Header summary & tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-surface-100 dark:border-surface-800 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSlaveFilterTab('all')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      slaveFilterTab === 'all'
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200'
                    }`}
                  >
                    All Slaves ({stats?.totalSlaves ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlaveFilterTab('online')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      slaveFilterTab === 'online'
                        ? 'bg-success-600 text-white shadow-sm'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200'
                    }`}
                  >
                    Online ({stats?.onlineSlaves ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlaveFilterTab('offline')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      slaveFilterTab === 'offline'
                        ? 'bg-danger-600 text-white shadow-sm'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200'
                    }`}
                  >
                    Offline ({stats?.offlineSlaves ?? 0})
                  </button>
                </div>

                <div className="relative w-full sm:w-56">
                  <input
                    type="text"
                    className="input pl-3 pr-3 py-1 text-xs bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 w-full"
                    placeholder="Search slave or device..."
                    value={slaveSearchQuery}
                    onChange={(e) => setSlaveSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Slaves List */}
              {(() => {
                const slaves = (stats?.slaves || []).filter((s) => {
                  const isOnline = s.status === 'Online' || s.statusRaw === 'ONLINE'
                  if (slaveFilterTab === 'online' && !isOnline) return false
                  if (slaveFilterTab === 'offline' && isOnline) return false
                  if (!slaveSearchQuery.trim()) return true
                  const q = slaveSearchQuery.toLowerCase()
                  return (
                    (s.name || '').toLowerCase().includes(q) ||
                    (s.deviceName || '').toLowerCase().includes(q)
                  )
                })

                if (!slaves.length) {
                  return (
                    <div className="p-8 text-center text-xs text-surface-500 font-bold bg-surface-50/30 dark:bg-surface-900/40 rounded-xl border border-dashed border-surface-200 dark:border-surface-800">
                      No slaves match the selected filter.
                    </div>
                  )
                }

                return (
                  <div className="divide-y divide-surface-100 dark:divide-surface-800 max-h-[60vh] overflow-y-auto pr-1">
                    {slaves.map((s) => {
                      const isOnline = s.status === 'Online' || s.statusRaw === 'ONLINE'
                      return (
                        <div
                          key={`${s.deviceId}-${s.id}`}
                          className="py-3 px-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-surface-50/60 dark:hover:bg-surface-800/40 rounded-xl transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                isOnline ? 'bg-success-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-danger-500'
                              }`}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-surface-900 dark:text-surface-100">
                                  {s.name}
                                </span>
                                {s.isDefault && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 rounded font-semibold">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-surface-400 font-medium mt-0.5">
                                Device: <strong className="text-surface-600 dark:text-surface-300">{s.deviceName}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 sm:text-right pl-5 sm:pl-0">
                            <div>
                              <p className="text-[10px] font-bold text-surface-400 uppercase">
                                {isOnline ? 'Last Reading' : 'Offline Since'}
                              </p>
                              <p className="text-xs font-semibold text-surface-700 dark:text-surface-200">
                                {formatRelativeTime(s.lastDataReceivedAt)}
                              </p>
                              {s.lastDataReceivedAt && (
                                <p className="text-[9px] text-surface-400 font-mono">
                                  {new Date(s.lastDataReceivedAt).toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                            <span
                              className={`badge text-[9px] font-black uppercase tracking-wider ${
                                isOnline ? 'badge-success' : 'badge-danger'
                              }`}
                            >
                              {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </Modal>

          <Modal
            open={openGroup !== null && !editOpen}
            onClose={closeGroupDetails}
            size="lg"
            title={openGroup ? `${openGroup.name} — Members` : 'Members'}
          >
            {openGroupDevices.length === 0 && (!openGroup?.slaves?.length && !openGroup?.slaveIds?.length) ? (
              <p className="text-xs text-surface-500 p-3 inset-panel">
                This group has no devices or slaves assigned yet.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Slaves section if present */}
                {(openGroup?.slaveIds?.length > 0 || openGroup?.slaves?.length > 0) && (
                  <div>
                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                      Linked Slaves ({openGroup.slaveIds?.length || openGroup.slaves?.length || 0})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(openGroup.slaves?.length ? openGroup.slaves : openGroup.slaveIds || []).map((item) => {
                        const sId = typeof item === 'string' ? item : item.id
                        const slaveObj = typeof item === 'object' ? item : openGroup.slaves?.find((s) => s.id === sId)
                        let foundSlave = slaveObj
                        let parentDev = liveDevices.find((d) => d.id === slaveObj?.deviceId)
                        if (!foundSlave || !parentDev) {
                          for (const d of liveDevices) {
                            const sl = (d.slaves || []).find((s) => s.id === sId)
                            if (sl) {
                              foundSlave = sl
                              parentDev = d
                              break
                            }
                          }
                        }
                        const name = foundSlave?.name || 'Slave'
                        const devName = parentDev?.name || foundSlave?.deviceName || 'Device'
                        const isOff = parentDev ? isOffline(parentDev) : false
                        return (
                          <div
                            key={sId}
                            className="p-2.5 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-surface-800 dark:text-surface-100">{name}</p>
                                <p className="text-[10px] text-surface-400">Device: {devName}</p>
                              </div>
                            </div>
                            <span className={`badge ${isOff ? 'badge-neutral' : 'badge-success'} text-[9px]`}>
                              {isOff ? 'Offline' : 'Online'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Devices section if present */}
                {openGroupDevices.length > 0 && (
                  <div>
                    {(openGroup?.slaveIds?.length > 0 || openGroup?.slaves?.length > 0) && (
                      <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                        Linked Devices ({openGroupDevices.length})
                      </p>
                    )}
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
                                  <p className="device-metric-value text-xs font-black">
                                    {liveTile(d, key)} <span className="text-[9px] text-surface-400 font-semibold">{unit}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Modal>

          <Modal
            open={editOpen && editGroupId !== null}
            onClose={closeEditGroup}
            size="md"
            title="Edit Device Group"
            footer={
              <>
                <button
                  type="button"
                  className="btn-danger mr-auto"
                  onClick={() => {
                    const g = groupLoads.find((x) => x.id === editGroupId)
                    if (g) {
                      closeEditGroup()
                      setDeleteTarget(g)
                    }
                  }}
                >
                  Delete Group
                </button>
                <button type="button" className="btn-secondary" onClick={closeEditGroup}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveGroupEdit}
                  disabled={editSaving || !editForm.name.trim() || (!editForm.deviceIds.length && !editForm.slaveIds?.length)}
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
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">
                    Add Slaves & Devices
                    <span className="text-danger-600 font-bold ml-0.5">*</span>
                  </label>
                  <span className="text-xs text-primary-600 font-bold">
                    {(editForm.slaveIds?.length || 0) + (editForm.deviceIds?.length || 0)} selected
                  </span>
                </div>
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
                  <div className="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800 max-h-64 overflow-y-auto">
                    {liveDevices.map((d) => {
                      const dSlaves = d.slaves || d.configSlaves || d._raw?.configSlaves || []
                      return (
                        <div key={d.id} className="bg-white dark:bg-surface-900 divide-y divide-surface-50 dark:divide-surface-800/60">
                          {/* Device header */}
                          <div className="flex items-center gap-3 px-3 py-2 bg-surface-50/80 dark:bg-surface-800/40">
                            <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded border-surface-300 text-primary-600"
                                checked={editForm.deviceIds.includes(d.id)}
                                onChange={() => toggleEditDevice(d.id)}
                              />
                              <Cpu size={13} className="text-primary-600 flex-shrink-0" />
                              <span className="text-xs font-bold text-surface-900 dark:text-surface-100">{d.name}</span>
                              <span className="text-[10px] text-surface-400">({dSlaves.length} slaves)</span>
                            </label>
                            <span className={`badge text-[9px] ${d.status === 'Online' ? 'badge-success' : 'badge-neutral'}`}>
                              {d.status}
                            </span>
                          </div>

                          {/* Slaves under device */}
                          {dSlaves.length > 0 && (
                            <div className="pl-6 pr-3 py-1 space-y-1 bg-surface-50/30 dark:bg-surface-950/20">
                              {dSlaves.map((slv) => (
                                <label
                                  key={slv.id}
                                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-surface-100/60 dark:hover:bg-surface-800/60 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    className="rounded border-surface-300 text-primary-600"
                                    checked={(editForm.slaveIds || []).includes(slv.id)}
                                    onChange={() => toggleEditSlave(slv.id)}
                                  />
                                  <span className="text-xs text-surface-700 dark:text-surface-200 flex-1">
                                    {slv.name}
                                    {slv.isDefault && (
                                      <span className="ml-1.5 text-[9px] text-surface-400 font-normal">(Default)</span>
                                    )}
                                  </span>
                                  <span className="badge badge-info text-[8px] py-0 px-1.5">Slave</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {liveDevices.length > 0 && editForm.deviceIds.length === 0 && (!editForm.slaveIds || editForm.slaveIds.length === 0) && (
                  <p className="text-[11px] text-danger-600 mt-1.5 font-semibold">Select at least one slave or device</p>
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

          <Modal
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            size="sm"
            variant="danger"
            title="Delete Device Group"
            footer={
              <>
                <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button type="button" className="btn-danger" onClick={handleDeleteGroup} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            }
          >
            <p className="text-sm text-surface-700 dark:text-surface-300">
              Delete <span className="font-bold">&quot;{deleteTarget?.name}&quot;</span>? This cannot be undone.
            </p>
          </Modal>
        </div>
      </Skeleton>
    </PageState>
  )
}
