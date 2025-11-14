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
    transports: ['websocket', 'polling'],
  })

  socket.on('connect', () => {
    // Socket connected successfully
  })

  socket.on('disconnect', () => {
    // Socket disconnected
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
  if (socket?.connected) {
    socket.emit('join_emergency', emergencyId)
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

export const removeListener = (event: string, callback?: Function) => {
  if (socket) {
    socket.off(event, callback)
  }
}

export const getSocket = (): Socket | null => {
  return socket
}

