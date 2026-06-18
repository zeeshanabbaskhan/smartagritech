// ─── Socket.IO initialisation ─────────────────────────────────────────────────
const jwt       = require('jsonwebtoken')
const prisma    = require('../config/database')
const userCache = require('../utils/userCache')

let io

const initSocket = (server, app) => {
  const { Server } = require('socket.io')

  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || true,
      credentials: true,
    },
  })

  if (app) app.set('io', io)

  // P-27: Redis adapter for multi-server when REDIS_URL is set
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter')
      const { createClient }  = require('redis')
      const pub = createClient({ url: process.env.REDIS_URL })
      const sub = pub.duplicate()
      Promise.all([pub.connect(), sub.connect()])
        .then(() => {
          io.adapter(createAdapter(pub, sub))
          console.log('Socket.IO Redis adapter enabled')
        })
        .catch((err) => console.warn('Socket.IO Redis adapter failed:', err.message))
    } catch (err) {
      console.warn('Socket.IO Redis adapter not loaded:', err.message)
    }
  }

  io.on('connection', async (socket) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) { socket.disconnect(true); return }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      // P-18: cache socket auth user lookup
      let user = await userCache.get(decoded.id)
      if (!user) {
        user = await prisma.user.findUnique({
          where:  { id: decoded.id },
          select: { id: true, organizationId: true, status: true },
        })
        if (user) await userCache.set(decoded.id, user)
      }

      if (!user || user.status === 'DELETED' || user.status === 'INACTIVE') {
        socket.disconnect(true)
        return
      }

      if (user.organizationId) socket.join(`org_${user.organizationId}`)
      socket.join(`user_${user.id}`)

      socket.on('join:device', (deviceId) => {
        if (deviceId) socket.join(`device_${deviceId}`)
      })
    } catch (_) {
      socket.disconnect(true)
    }

    socket.on('disconnect', () => {})
  })

  return io
}

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialised')
  return io
}

module.exports = { initSocket, getIO }
