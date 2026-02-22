import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) {
    return socket
  }

  // Get API base URL
  const getApiBaseUrl = (): string => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL
    }
    return 'http://localhost:3001/api'
  }
  
  const socketUrl = getApiBaseUrl().replace('/api', '')

  // Create socket with POLLING FIRST (more reliable through proxies)
  // Socket.io will auto-upgrade to websocket after initial connection
  socket = io(socketUrl, {
    auth: { token },
    transports: ['polling', 'websocket'], // Polling first!
    path: '/socket.io/',
    upgrade: true,
    rememberUpgrade: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    timeout: 20000,
  })

  socket.on('connect', () => {
    console.log('✅ Socket connected')
  })

  socket.on('disconnect', (reason) => {
    console.log('⚠️ Socket disconnected:', reason)
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log(`✅ Socket reconnected (attempt ${attemptNumber})`)
  })

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message)
  })

  return socket
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}

export const joinEmergency = (emergencyId: string) => {
  if (!socket) return

  const doJoin = () => {
    if (socket?.connected) {
      socket.emit('join_emergency', emergencyId)
      console.log(`📍 Joined emergency: ${emergencyId}`)
    }
  }

  if (socket.connected) {
    doJoin()
  } else {
    socket.once('connect', doJoin)
  }
}

export const leaveEmergency = (emergencyId: string) => {
  if (socket?.connected) {
    socket.emit('leave_emergency', emergencyId)
  }
}

export const onLocationUpdate = (callback: (data: any) => void) => {
  socket?.on('location_update', callback)
}

export const onParticipantAccepted = (callback: (data: any) => void) => {
  socket?.on('participant_accepted', callback)
}

export const onEmergencyCreated = (callback: (data: any) => void) => {
  socket?.on('emergency_created', callback)
}

export const onEmergencyEnded = (callback: (data: any) => void) => {
  socket?.once('emergency_ended', callback)
}

export const onEmergencyCancelled = (callback: (data: any) => void) => {
  socket?.once('emergency_cancelled', callback)
}

export const onNewMessage = (callback: (data: any) => void) => {
  socket?.on('new_message', callback)
}

export const removeListener = (event: string, callback?: (...args: any[]) => void) => {
  if (socket && callback) {
    socket.off(event, callback)
  }
}

export const removeMessageListener = (callback?: (...args: any[]) => void) => {
  if (socket && callback) {
    socket.off('new_message', callback)
  }
}

export const getSocket = (): Socket | null => socket
