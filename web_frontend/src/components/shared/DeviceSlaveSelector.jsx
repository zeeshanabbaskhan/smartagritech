import { useEffect, useMemo } from 'react'
import { useDevices } from '../../context/DeviceContext'
import { SearchableSelect } from '../ui/DataCenterFilterBar'

function sameId(a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

/**
 * Device + slave picker for chart/history sections.
 * Device/slave are required for dashboards — clear is disabled; empty
 * selection always falls back to the first available option.
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

  const deviceOptions = useMemo(
    () => devices.map((d) => ({ value: d.id, label: `${d.name} (${d.status})` })),
    [devices],
  )

  const slaveOptions = useMemo(
    () => slaves.map((s) => ({ value: s.id, label: s.name ?? s.slaveName ?? s.id })),
    [slaves],
  )

  // Keep selection valid when override list changes (e.g. org filter) or after clear
  useEffect(() => {
    if (!devices.length) return
    if (!selectedDeviceId || !devices.some((d) => sameId(d.id, selectedDeviceId))) {
      selectDevice(devices[0].id)
    }
  }, [devices, selectedDeviceId, selectDevice])

  useEffect(() => {
    if (!slaves.length) return
    if (!selectedSlaveId || !slaves.some((s) => sameId(s.id, selectedSlaveId))) {
      setSelectedSlaveId(slaves[0].id)
    }
  }, [slaves, selectedSlaveId, setSelectedSlaveId])

  const handleDeviceChange = async (v) => {
    const next = v || devices[0]?.id || null
    if (!next) return
    await selectDevice(next)
    // After React commits the new device/slave, notify parents (macrotask).
    setTimeout(() => onChange?.(), 0)
  }

  const handleSlaveChange = (v) => {
    const next = v || slaves[0]?.id || null
    if (!next) return
    setSelectedSlaveId(next)
    setTimeout(() => onChange?.(), 0)
  }

  const deviceValue =
    selectedDeviceId && devices.some((d) => sameId(d.id, selectedDeviceId))
      ? selectedDeviceId
      : ''

  const slaveValue =
    selectedSlaveId && slaves.some((s) => sameId(s.id, selectedSlaveId))
      ? selectedSlaveId
      : ''

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <SearchableSelect
        label="Device"
        className="min-w-[200px] flex-1"
        value={deviceValue}
        options={deviceOptions}
        placeholder={devices.length ? 'Select device' : 'No devices'}
        disabled={loading || !devices.length}
        clearable={false}
        onChange={handleDeviceChange}
      />
      <SearchableSelect
        label={slaveLabel}
        className="min-w-[160px] flex-1"
        value={slaveValue}
        options={slaveOptions}
        placeholder={slaves.length ? 'Select slave' : '—'}
        disabled={!slaves.length}
        clearable={false}
        onChange={handleSlaveChange}
      />
    </div>
  )
}
