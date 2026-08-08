import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import emsApi, { list } from '../api/emsApi'
import { mapDevice } from '../utils/mappers'
import { useAuth } from './AuthContext'

const DeviceContext = createContext(null)

function sameId(a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
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
  devicesRef.current = devices
  slavesRef.current = slaves

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
        return slaveList[0]?.id ?? null
      })
    } catch {
      setSlaves([])
      setSelectedSlaveId(null)
    }
  }, [])

  const loadDevices = useCallback(async () => {
    if (!user) return []
    setLoading(true)
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
      setLoading(false)
    }
  }, [user])

  /** Select a device; empty/null falls back to the first available device. */
  const selectDevice = useCallback(async (deviceId) => {
    const next = deviceId || devicesRef.current[0]?.id || null
    // Clear slave immediately so consumers never fetch new device + old slave.
    setSelectedDeviceId(next)
    setSelectedSlaveId(null)
    setSlaves([])
    await loadSlavesForDevice(next)
  }, [loadSlavesForDevice])

  /** Set slave; empty/null falls back to the first available slave. */
  const setSelectedSlaveIdSafe = useCallback((slaveIdOrUpdater) => {
    if (typeof slaveIdOrUpdater === 'function') {
      setSelectedSlaveId((prev) => {
        const next = slaveIdOrUpdater(prev)
        return next || slavesRef.current[0]?.id || null
      })
      return
    }
    setSelectedSlaveId(slaveIdOrUpdater || slavesRef.current[0]?.id || null)
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
