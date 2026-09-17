import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import emsApi, { list } from '../../api/emsApi'
import { latestToReadings } from '../../utils/sensorReadings'
import { formatMetricValue } from './dashboardFormatters'
import { onSocketEvent, subscribeDevice, isSocketEnabled } from '../../services/socketService'

/** Legacy cfsmartems.com default slave tab (not first-created slave). */
const LEGACY_DEFAULT_SLAVE_NAMES = [
  'Main',
  'FicoInverter',
  'MainIncomingCF',
  'MainIncoming',
  'Smart',
  'MainBreaker',
  'SupraFurnace',
  'ACBreaker',
  'EMS PANEL',
]

function pickDefaultSlaveId(slaveList) {
  if (!slaveList?.length) return null
  for (const preferred of LEGACY_DEFAULT_SLAVE_NAMES) {
    const hit = slaveList.find((s) => (s.name ?? s.displayName) === preferred)
    if (hit?.id) return hit.id
  }
  return slaveList[0]?.id ?? null
}

/** Human label: prefer displayName from legacy template. */
function labelFor(row) {
  const dn = row.displayName?.trim()
  if (dn) return dn
  const n = String(row.name || '')
  const spaced = n
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  if (spaced !== n && !/^R[0-9]+$/i.test(n)) return spaced
  return n || '—'
}

/** Legacy cfsmartems.com display order per slave. */
const LEGACY_SORT = [
  'Voltage A', 'Voltage B', 'Voltage C',
  'Phase Voltage A', 'Phase Voltage B', 'Phase Voltage C',
  'Current A', 'Current B', 'Current C',
  'Operating Power', 'Active Power', 'Reactive Power', 'Apparent Power',
  'Power Consumption', 'Units', 'Export Power',
  'Power Factor', 'Frequency', 'Temperature',
  'THD Ua', 'THD Ub', 'THD Uc', 'THD Ia', 'THD Ib', 'THD Ic',
  'Control Status',
]

function sortLegacy(a, b) {
  const la = labelFor(a)
  const lb = labelFor(b)
  const ia = LEGACY_SORT.indexOf(la)
  const ib = LEGACY_SORT.indexOf(lb)
  if (ia >= 0 && ib >= 0) return ia - ib
  if (ia >= 0) return -1
  if (ib >= 0) return 1
  return la.localeCompare(lb)
}

const ORG_TIMEZONE = 'Asia/Karachi'

export function formatFullDateTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ORG_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d)
}

// In-memory caches for instantaneous (0ms) slave variable rendering
const varDefinitionsCache = new Map()
const slaveRowsCache = new Map()

/**
 * Per-slave metrics — legacy-style Data Nodes tabs (Fico Furnace | Furnace Control | Main).
 */
export default function DeviceSlaveMetricsPanel({
  deviceId,
  slaveId = null,
  showTabs = true,
  switchOn = true,
  compact = false,
  className = '',
  /** When false, parent drives refresh via refreshToken (avoids N socket listeners in fleet view). */
  liveRefresh = true,
  refreshToken = 0,
}) {
  const [slaves, setSlaves] = useState([])
  const [activeSlaveId, setActiveSlaveId] = useState(slaveId)
  const [rows, setRows] = useState(() => {
    if (slaveId && slaveRowsCache.has(slaveId)) {
      return slaveRowsCache.get(slaveId)
    }
    return []
  })
  const [loading, setLoading] = useState(() => {
    if (slaveId && slaveRowsCache.has(slaveId)) return false
    return true
  })
  const socketTimerRef = useRef(null)

  const loadSlaveData = useCallback(async (targetSlaveId, { silent = false } = {}) => {
    if (!deviceId || !targetSlaveId) {
      setRows([])
      return
    }
    const hasCache = slaveRowsCache.has(targetSlaveId)
    if (!silent && !hasCache) {
      setLoading(true)
    }

    try {
      // 1. Fetch variable metadata (or use cached definitions)
      const varsPromise = varDefinitionsCache.has(targetSlaveId)
        ? Promise.resolve(varDefinitionsCache.get(targetSlaveId))
        : emsApi.getDeviceVariables(deviceId, targetSlaveId, { limit: 200 })
            .then((res) => {
              const listVars = list(res)
              varDefinitionsCache.set(targetSlaveId, listVars)
              return listVars
            })
            .catch(() => [])

      // 2. Fetch latest live readings in parallel
      const latestPromise = emsApi.getLatestReadings({ deviceId, slaveId: targetSlaveId }).catch(() => null)

      const [vars, latestRes] = await Promise.all([varsPromise, latestPromise])

      const latestReadings = latestToReadings(latestRes ?? {})
      const hasLiveBatch = latestReadings.length > 0
      const latestMap = Object.fromEntries(
        latestReadings.map((r) => [r.variableName, r]),
      )
      const merged = (vars || []).map((v) => {
        const key = v.name ?? v.variableName
        const live = latestMap[key]
        const reg = v.templateVariable?.registerAddress ?? v.registerAddress ?? ''
        return {
          id: v.id ?? key,
          name: key,
          displayName: v.displayName ?? '',
          registerAddress: reg,
          unit: live?.unit ?? v.unit ?? '',
          value: live?.displayValue ?? live?.value ?? (hasLiveBatch ? null : v.displayValue ?? v.currentValue ?? null),
          rawValue: live?.value ?? (hasLiveBatch ? null : v.currentValue ?? null),
          lastUpdatedAt: live?.lastUpdatedAt ?? v.lastUpdatedAt ?? null,
        }
      })
      merged.sort(sortLegacy)
      slaveRowsCache.set(targetSlaveId, merged)
      setRows(merged)
    } catch {
      if (!silent && !hasCache) setRows([])
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    if (!deviceId) {
      setSlaves([])
      setActiveSlaveId(null)
      setRows([])
      setLoading(false)
      return
    }

    // If tabs are disabled and slaveId is already provided, skip querying all device config slaves
    if (!showTabs && slaveId) {
      setActiveSlaveId(slaveId)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const slaveList = list(await emsApi.getDeviceConfig(deviceId, { limit: 100 }))
        if (cancelled) return
        setSlaves(slaveList)
        const targetId = slaveId || pickDefaultSlaveId(slaveList)
        setActiveSlaveId(targetId)
      } catch {
        if (!cancelled) {
          setSlaves([])
          setActiveSlaveId(null)
          setRows([])
        }
      }
    })()
    return () => { cancelled = true }
  }, [deviceId, slaveId, showTabs])

  useEffect(() => {
    if (slaveId) {
      setActiveSlaveId(slaveId)
    }
  }, [slaveId])

  useEffect(() => {
    if (activeSlaveId) {
      if (slaveRowsCache.has(activeSlaveId)) {
        setRows(slaveRowsCache.get(activeSlaveId))
        setLoading(false)
        loadSlaveData(activeSlaveId, { silent: true })
      } else {
        loadSlaveData(activeSlaveId, { silent: false })
      }
    }
  }, [activeSlaveId, loadSlaveData])

  useEffect(() => {
    if (!liveRefresh && activeSlaveId && refreshToken > 0) {
      loadSlaveData(activeSlaveId, { silent: true })
    }
  }, [refreshToken, liveRefresh, activeSlaveId, loadSlaveData])

  useEffect(() => {
    if (!liveRefresh || !deviceId) return undefined
    subscribeDevice(deviceId)
    if (!isSocketEnabled()) return undefined
    return onSocketEvent((event, data) => {
      if (event !== 'reading:new' || data?.deviceId !== deviceId || !activeSlaveId) return
      if (socketTimerRef.current) clearTimeout(socketTimerRef.current)
      socketTimerRef.current = setTimeout(() => {
        loadSlaveData(activeSlaveId, { silent: true })
      }, 1500)
    })
  }, [deviceId, activeSlaveId, loadSlaveData, liveRefresh])

  useEffect(() => () => {
    if (socketTimerRef.current) clearTimeout(socketTimerRef.current)
  }, [])

  const activeSlave = useMemo(
    () => slaves.find((s) => s.id === activeSlaveId),
    [slaves, activeSlaveId],
  )

  if (!switchOn) {
    return (
      <p className="text-sm text-surface-500 py-4 text-center">
        Switch is off — live telemetry hidden for this device.
      </p>
    )
  }

  if (!slaves.length && !loading) {
    return (
      <p className="text-sm text-surface-500 py-4 text-center">
        No data nodes configured for this device.
      </p>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Slave tabs — visible when device has slaves and showTabs is true (legacy Data Nodes Overview) */}
      {showTabs && slaves.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-surface-500">Data Nodes Overview</p>
            {activeSlave && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeSlave.status === 'ONLINE' || activeSlave.status === 'Online'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}>
                {activeSlave.status === 'ONLINE' || activeSlave.status === 'Online' ? '● Live Streaming' : '○ Offline / Stale'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-0 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden w-fit max-w-full">
            {slaves.map((s) => {
              const active = s.id === activeSlaveId
              const isOnline = s.status === 'ONLINE' || s.status === 'Online'
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSlaveId(s.id)}
                  className={`px-3 py-1.5 text-xs font-bold border-r last:border-r-0 border-surface-200 dark:border-surface-700 transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-50 dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-surface-400'}`} />
                  <span>{s.name ?? s.displayName ?? 'Slave'}</span>
                  {s.isDefault && <span className="text-[9px] opacity-75 font-normal">(Default)</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-surface-500 py-6 text-center">Loading readings for {activeSlave?.name ?? '…'}…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-surface-500 py-6 text-center">
          No variables for <strong>{activeSlave?.name}</strong> yet.
        </p>
      ) : compact ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="p-3 bg-surface-50 dark:bg-surface-950 rounded-lg border border-surface-200 dark:border-surface-800"
            >
              <p className="text-sm font-semibold text-surface-700 dark:text-surface-200 truncate" title={labelFor(r)}>
                {labelFor(r)}
              </p>
              <p className="text-lg font-bold mt-1">
                  {formatMetricValue(r.rawValue, r.value, r.name, r.unit)}
                {r.unit ? <span className="text-xs font-normal text-surface-400 ml-1">{r.unit}</span> : null}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-800">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-950 text-surface-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Variable Name</th>
                <th className="text-left px-4 py-3 font-semibold">Current Value</th>
                <th className="text-left px-4 py-3 font-semibold">Unit</th>
                <th className="text-left px-4 py-3 font-semibold">Update Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="px-4 py-2.5 font-medium text-surface-800 dark:text-surface-100">
                    {labelFor(r)}
                  </td>
                  <td className="px-4 py-2.5 font-bold">
                    {r.value != null && r.value !== ''
                      ? formatMetricValue(r.rawValue, r.value, r.name, r.unit)
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-surface-500">{r.unit || '—'}</td>
                  <td className="px-4 py-2.5 text-surface-500 text-xs font-mono">
                    {r.lastUpdatedAt ? formatFullDateTime(r.lastUpdatedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
