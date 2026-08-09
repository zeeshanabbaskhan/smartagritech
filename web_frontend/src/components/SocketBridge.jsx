import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { connectSocket, disconnectSocket, isSocketEnabled, onSocketEvent } from '../services/socketService'
import { useDevices } from '../context/DeviceContext'

export default function SocketBridge({ onAlarm }) {
  const { user } = useAuth()
  const { loadDevices } = useDevices()

  useEffect(() => {
    if (!user || !isSocketEnabled()) {
      disconnectSocket()
      return undefined
    }
    connectSocket()
    const unsub = onSocketEvent((event, data) => {
      // Silent refresh — never toggle DeviceContext.loading (that blinks the DEVICE select).
      if (event === 'reading:new' || event === 'device:switch' || event === 'device:status') {
        loadDevices({ silent: true })
      }
      if (event === 'alarm:new') onAlarm?.(data)
    })
    return () => {
      unsub()
      disconnectSocket()
    }
  }, [user?.id, loadDevices, onAlarm])

  return null
}
