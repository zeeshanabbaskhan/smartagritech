import { useEffect, useMemo } from 'react'
import { useDevices } from '../../context/DeviceContext'

/**
 * Device + slave picker for chart/history sections.
 * @param {Array} [devicesOverride] — when set (e.g. org-scoped admin filter), options come from this list
 */
export default function DeviceSlaveSelector({
  onChange,
  className = '',
  slaveLabel = 'Slave',
  devicesOverride,
}) {
  const {
    devices: contextDevices,
    slaves,
    selectedDeviceId,
    selectedSlaveId,
    setSelectedSlaveId,
    selectDevice,
    loading,
  } = useDevices()

  const devices = useMemo(() => {
    if (Array.isArray(devicesOverride)) return devicesOverride
    return contextDevices
  }, [devicesOverride, contextDevices])

  // Keep selection valid when override list changes (e.g. org filter)
  useEffect(() => {
    if (!devices.length) return
    if (!selectedDeviceId || !devices.some((d) => d.id === selectedDeviceId)) {
      selectDevice(devices[0].id)
    }
  }, [devices, selectedDeviceId, selectDevice])

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <div className="min-w-[200px] flex-1">
        <label className="label text-[10px] uppercase tracking-wider">Device</label>
        <select
          className="input py-2 text-xs w-full"
          value={selectedDeviceId && devices.some((d) => d.id === selectedDeviceId) ? selectedDeviceId : ''}
          disabled={loading || !devices.length}
          onChange={async (e) => {
            await selectDevice(e.target.value || null)
            onChange?.()
          }}
        >
          {!devices.length && <option value="">No devices</option>}
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
          ))}
        </select>
      </div>
      <div className="min-w-[160px] flex-1">
        <label className="label text-[10px] uppercase tracking-wider">{slaveLabel}</label>
        <select
          className="input py-2 text-xs w-full"
          value={selectedSlaveId ?? ''}
          disabled={!slaves.length}
          onChange={(e) => {
            setSelectedSlaveId(e.target.value || null)
            onChange?.()
          }}
        >
          {!slaves.length && <option value="">—</option>}
          {slaves.map((s) => (
            <option key={s.id} value={s.id}>{s.name ?? s.slaveName ?? s.id}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
