import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { connectSocket, disconnectSocket, isSocketEnabled, onSocketEvent } from '../services/socketService'
import { useDevices } from '../context/DeviceContext'

export default function SocketBridge({ onAlarm }) {
  const { user } = useAuth()
  const { loadDevices, selectedDeviceId, selectDevice } = useDevices()

  useEffect(() => {
    if (!user || !isSocketEnabled()) {
      disconnectSocket()
      return undefined
    }
    connectSocket()
    const unsub = onSocketEvent((event, data) => {
      if (event === 'reading:new' || event === 'device:switch') {
        loadDevices()
      }
      if (event === 'alarm:new') onAlarm?.(data)
    })
    return () => {
      unsub()
      disconnectSocket()
    }
  }, [user?.id, loadDevices, onAlarm])

  useEffect(() => {
    if (selectedDeviceId) selectDevice(selectedDeviceId)
  }, [selectedDeviceId, selectDevice])

  return null
}
