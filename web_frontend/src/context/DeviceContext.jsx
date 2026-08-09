import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import emsApi, { list } from '../api/emsApi'
import { mapDevice } from '../utils/mappers'
import { useAuth } from './AuthContext'

const DeviceContext = createContext(null)

function sameId(a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

/** Prefer isDefault slave when auto-selecting; else first in list. */
function pickDefaultSlaveId(slaveList) {
  if (!slaveList?.length) return null
  const def = slaveList.find((s) => s.isDefault)
  return def?.id ?? slaveList[0]?.id ?? null
}

export function DeviceProvider({ children }) {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [slaves, setSlaves] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [selectedSlaveId, setSelectedSlaveId] = useState(null)
  const [loading, setLoading] = useState(false)
  const devicesRef = useRef(devices)
  const slavesRef = useRef(slaves)
  const selectedDeviceIdRef = useRef(selectedDeviceId)
  devicesRef.current = devices
  slavesRef.current = slaves
  selectedDeviceIdRef.current = selectedDeviceId

  const loadSlavesForDevice = useCallback(async (deviceId) => {
    if (!deviceId) {
      setSlaves([])
      setSelectedSlaveId(null)
      return
    }
    try {
      const res = await emsApi.getDeviceConfig(deviceId)
      const slaveList = list(res)
      setSlaves(slaveList)
      setSelectedSlaveId((prev) => {
        if (prev && slaveList.some((s) => sameId(s.id, prev))) return prev
        return pickDefaultSlaveId(slaveList)
      })
    } catch {
      setSlaves([])
      setSelectedSlaveId(null)
    }
  }, [])

  const loadDevices = useCallback(async (opts = {}) => {
    if (!user) return []
    const silent = Boolean(opts?.silent)
    // Silent refresh (socket/poll) must not flip `loading` — that disables the
    // device selector and causes a visible opacity blink on every reading.
    if (!silent) setLoading(true)
    try {
      const res = await emsApi.getDevices({ limit: 100 })
      const mapped = list(res).map(mapDevice)
      setDevices(mapped)
      setSelectedDeviceId((prev) => {
        if (prev && mapped.some((d) => sameId(d.id, prev))) return prev
        return mapped[0]?.id ?? null
      })
      return mapped
    } catch {
      setDevices([])
      return []
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user])

  /** Select a device; empty/null falls back to the first available device. */
  const selectDevice = useCallback(async (deviceId) => {
    const next = deviceId || devicesRef.current[0]?.id || null
    // No-op when already on this device with slaves loaded — avoids clear→reload flicker.
    if (sameId(next, selectedDeviceIdRef.current) && slavesRef.current.length > 0) {
      return
    }
    // Clear slave immediately so consumers never fetch new device + old slave.
    setSelectedDeviceId(next)
    setSelectedSlaveId(null)
    setSlaves([])
    await loadSlavesForDevice(next)
  }, [loadSlavesForDevice])

  /** Set slave; empty/null falls back to the default (or first) available slave. */
  const setSelectedSlaveIdSafe = useCallback((slaveIdOrUpdater) => {
    if (typeof slaveIdOrUpdater === 'function') {
      setSelectedSlaveId((prev) => {
        const next = slaveIdOrUpdater(prev)
        return next || pickDefaultSlaveId(slavesRef.current)
      })
      return
    }
    setSelectedSlaveId(slaveIdOrUpdater || pickDefaultSlaveId(slavesRef.current))
  }, [])

  useEffect(() => {
    if (!user) {
      setDevices([])
      setSlaves([])
      setSelectedDeviceId(null)
      setSelectedSlaveId(null)
      return
    }
    loadDevices().then((mapped) => {
      const id = mapped[0]?.id
      if (id) loadSlavesForDevice(id)
    })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedDeviceId) loadSlavesForDevice(selectedDeviceId)
  }, [selectedDeviceId, loadSlavesForDevice])

  const deviceSlaves = selectedDeviceId
    ? slaves.filter((s) => !s.deviceId || sameId(s.deviceId, selectedDeviceId))
    : slaves

  return (
    <DeviceContext.Provider value={{
      devices,
      slaves: deviceSlaves.length ? deviceSlaves : slaves,
      selectedDeviceId,
      selectedSlaveId,
      setSelectedSlaveId: setSelectedSlaveIdSafe,
      loading,
      loadDevices,
      selectDevice,
      selectedDevice: devices.find((d) => sameId(d.id, selectedDeviceId)) ?? null,
    }}>
      {children}
    </DeviceContext.Provider>
  )
}

export const useDevices = () => useContext(DeviceContext)
