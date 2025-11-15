import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) {
    return socket
  }

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
  const socketUrl = API_BASE_URL.replace('/api', '')

  socket = io(socketUrl, {
    auth: {
      token: token,
    },
    transports: ['websocket', 'polling'], // Prefer websocket for instant delivery
    upgrade: true, // Allow transport upgrades
    rememberUpgrade: true, // Remember websocket preference
    reconnection: true, // Auto-reconnect
    reconnectionDelay: 1000, // Start reconnecting after 1s
    reconnectionDelayMax: 5000, // Max delay between reconnection attempts
    reconnectionAttempts: 5, // Try to reconnect 5 times
    timeout: 20000, // Connection timeout
  })

  socket.on('connect', () => {
    console.log('✅ Socket.io connected successfully')
  })

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.io disconnected:', reason)
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Socket.io reconnected after ${attemptNumber} attempts`)
  })

  socket.on('reconnect_attempt', () => {
    console.log('🔄 Attempting to reconnect socket...')
  })

  socket.on('reconnect_error', (error) => {
    console.error('❌ Socket reconnection error:', error)
  })

  socket.on('reconnect_failed', () => {
    console.error('❌ Socket reconnection failed - manual intervention may be required')
  })

  socket.on('connect_error', (error) => {
    // Only log if it's a real error, not just connection retry
    if (error.message && !error.message.includes('xhr poll error')) {
      console.error('Socket connection error:', error)
    }
  })

  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const joinEmergency = (emergencyId: string) => {
  if (!socket) {
    console.warn('Socket not initialized. Cannot join emergency room.')
    return
  }

  const doJoin = () => {
    if (socket?.connected) {
      socket.emit('join_emergency', emergencyId)
      console.log(`Joined emergency room: ${emergencyId}`)
    }
  }

  if (socket.connected) {
    doJoin()
  } else {
    // Wait for connection, then join
    socket.once('connect', doJoin)
    // Also try immediately in case it connects between check and listener
    if (socket.connected) {
      doJoin()
    }
  }
}

export const leaveEmergency = (emergencyId: string) => {
  if (socket?.connected) {
    socket.emit('leave_emergency', emergencyId)
  }
}

export const onLocationUpdate = (callback: (data: any) => void) => {
  if (socket) {
    socket.on('location_update', callback)
  }
}

export const onParticipantAccepted = (callback: (data: any) => void) => {
  if (socket) {
    socket.on('participant_accepted', callback)
  }
}

export const onEmergencyEnded = (callback: (data: any) => void) => {
  if (socket) {
    socket.on('emergency_ended', callback)
  }
}

export const onEmergencyCancelled = (callback: (data: any) => void) => {
  if (socket) {
    socket.on('emergency_cancelled', callback)
  }
}

export const onNewMessage = (callback: (data: any) => void) => {
  if (socket) {
    socket.on('new_message', callback)
  }
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

export const getSocket = (): Socket | null => {
  return socket
}

