import { useCallback, useEffect, useMemo, useState } from 'react'
import emsApi, { list } from '../../api/emsApi'
import { latestToReadings } from '../../utils/sensorReadings'
import { formatTileValue } from './dashboardFormatters'
import { onSocketEvent, subscribeDevice, isSocketEnabled } from '../../services/socketService'

function pickDefaultSlaveId(slaveList) {
  if (!slaveList?.length) return null
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
  return row.registerAddress || n || '—'
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

/**
 * Per-slave metrics — legacy-style Data Nodes tabs (Fico Furnace | Furnace Control | Main).
 */
export default function DeviceSlaveMetricsPanel({
  deviceId,
  switchOn = true,
  compact = false,
  className = '',
}) {
  const [slaves, setSlaves] = useState([])
  const [activeSlaveId, setActiveSlaveId] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSlaveData = useCallback(async (slaveId) => {
    if (!deviceId || !slaveId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const [varsRes, latestRes] = await Promise.all([
        emsApi.getDeviceVariables(deviceId, slaveId),
        emsApi.getLatestReadings({ deviceId, slaveId }).catch(() => null),
      ])
      const vars = list(varsRes)
      const latestMap = Object.fromEntries(
        latestToReadings(latestRes ?? {}).map((r) => [r.variableName, r]),
      )
      const merged = vars.map((v) => {
        const key = v.name ?? v.variableName
        const live = latestMap[key]
        const reg = v.templateVariable?.registerAddress ?? v.registerAddress ?? ''
        return {
          id: v.id ?? key,
          name: key,
          displayName: v.displayName ?? '',
          registerAddress: reg,
          unit: live?.unit ?? v.unit ?? '',
          value: live?.value ?? v.currentValue ?? null,
          lastUpdatedAt: live?.lastUpdatedAt ?? v.lastUpdatedAt ?? null,
        }
      })
      merged.sort(sortLegacy)
      setRows(merged)
    } catch {
      setRows([])
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
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const slaveList = list(await emsApi.getDeviceConfig(deviceId))
        if (cancelled) return
        setSlaves(slaveList)
        setActiveSlaveId(pickDefaultSlaveId(slaveList))
      } catch {
        if (!cancelled) {
          setSlaves([])
          setActiveSlaveId(null)
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [deviceId])

  useEffect(() => {
    if (activeSlaveId) loadSlaveData(activeSlaveId)
  }, [activeSlaveId, loadSlaveData])

  useEffect(() => {
    if (!deviceId) return undefined
    subscribeDevice(deviceId)
    if (!isSocketEnabled()) return undefined
    return onSocketEvent((event, data) => {
      if (event === 'reading:new' && data?.deviceId === deviceId && activeSlaveId) {
        loadSlaveData(activeSlaveId)
      }
    })
  }, [deviceId, activeSlaveId, loadSlaveData])

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
      {/* Slave tabs — always visible when device has slaves (legacy Data Nodes Overview) */}
      {slaves.length > 0 && (
        <div>
          <p className="text-xs font-bold text-surface-500 mb-2">Data Nodes Overview</p>
          <div className="flex flex-wrap gap-0 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden w-fit">
            {slaves.map((s) => {
              const active = s.id === activeSlaveId
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSlaveId(s.id)}
                  className={`px-4 py-2 text-sm font-semibold border-r last:border-r-0 border-surface-200 dark:border-surface-700 transition-colors ${
                    active
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-50 dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  {s.name ?? s.displayName ?? 'Slave'}
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
              {r.registerAddress ? (
                <p className="text-[10px] text-surface-400 font-mono mt-0.5">Reg {r.registerAddress}</p>
              ) : null}
              <p className="text-lg font-bold mt-1">
                  {formatTileValue(parseFloat(r.value), r.name, r.unit)}
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
                <th className="text-left px-4 py-3 font-semibold">Register</th>
                <th className="text-left px-4 py-3 font-semibold">Variable Name</th>
                <th className="text-left px-4 py-3 font-semibold">Current Value</th>
                <th className="text-left px-4 py-3 font-semibold">Unit</th>
                <th className="text-left px-4 py-3 font-semibold">Update Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="px-4 py-2.5 font-mono text-xs text-surface-500">{r.registerAddress || '—'}</td>
                  <td className="px-4 py-2.5 font-medium text-surface-800 dark:text-surface-100">
                    {labelFor(r)}
                  </td>
                  <td className="px-4 py-2.5 font-bold">
                    {r.value != null && r.value !== '' ? formatTileValue(parseFloat(r.value), r.name) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-surface-500">{r.unit || '—'}</td>
                  <td className="px-4 py-2.5 text-surface-500 text-xs">
                    {r.lastUpdatedAt ? new Date(r.lastUpdatedAt).toLocaleString() : '—'}
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
