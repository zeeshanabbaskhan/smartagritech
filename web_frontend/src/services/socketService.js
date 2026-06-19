import { io } from 'socket.io-client'
import { tokenStore } from '../api/client'

export function isSocketEnabled() {
  if (import.meta.env.VITE_ENABLE_SOCKET === 'false') return false
  const configured = import.meta.env.VITE_SOCKET_URL
  if (configured === 'false' || configured === '') return false
  return true
}

const socketUrl = () => {
  const configured = import.meta.env.VITE_SOCKET_URL
  if (configured && configured !== 'false') return configured
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

let socket = null
const listeners = new Set()

function emitLocal(event, data) {
  listeners.forEach((fn) => fn(event, data))
}

export function onSocketEvent(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export function connectSocket() {
  if (!isSocketEnabled()) return

  const url = socketUrl()
  const token = tokenStore.get()
  if (!url || !token) return

  if (socket?.connected) return

  socket?.disconnect()
  socket = io(url, {
    transports: ['websocket'],
    autoConnect: true,
    auth: { token },
  })

  socket.on('connect', () => {
    socket.emit('join:org')
  })

  socket.on('reading:new', (data) => emitLocal('reading:new', data))
  socket.on('alarm:new', (data) => emitLocal('alarm:new', data))
  socket.on('device:switch', (data) => emitLocal('device:switch', data))
  socket.on('device:command', (data) => emitLocal('device:command', data))
}

export function subscribeDevice(deviceId) {
  if (socket?.connected && deviceId) socket.emit('join:device', deviceId)
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
