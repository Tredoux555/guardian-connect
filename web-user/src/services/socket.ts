import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) {
    return socket
  }

  // Auto-detect API URL (same logic as api.ts)
  const getApiBaseUrl = (): string => {
    // Use explicit VITE_API_URL if set (and not localhost)
    if (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) {
      return import.meta.env.VITE_API_URL;
    }
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const networkIP = '192.168.1.3'; // Server's network IP
    
    // If accessed via ngrok (HTTPS), backend is still on network IP (HTTP)
    if (hostname.includes('.ngrok.io') || hostname.includes('.ngrok-free.app') || hostname.includes('.ngrok.app')) {
      // Frontend is HTTPS via ngrok, but backend is still HTTP on network
      return `http://${networkIP}:3001/api`;
    }
    
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      // If accessing from phone's IP, use server's IP for backend
      if (hostname === '192.168.1.14') {
        return `${protocol}//${networkIP}:3001/api`;
      }
      return `${protocol}//${hostname}:3001/api`;
    }
    return 'http://localhost:3001/api';
  };
  const API_BASE_URL = getApiBaseUrl();
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
    // Only log in development
    if (import.meta.env.DEV) {
      console.log('✅ Socket.io connected successfully')
    }
  })

  socket.on('disconnect', (reason) => {
    // Only log in development
    if (import.meta.env.DEV) {
      console.log('❌ Socket.io disconnected:', reason)
    }
  })

  socket.on('reconnect', (attemptNumber) => {
    // Only log in development
    if (import.meta.env.DEV) {
      console.log(`🔄 Socket.io reconnected after ${attemptNumber} attempts`)
    }
  })

  socket.on('reconnect_attempt', () => {
    // Don't log reconnect attempts - too noisy
  })

  socket.on('reconnect_error', (error) => {
    // Only log in development
    if (import.meta.env.DEV) {
      console.error('❌ Socket reconnection error:', error)
    }
  })

  socket.on('reconnect_failed', () => {
    // Always log critical failures
    console.error('❌ Socket reconnection failed - manual intervention may be required')
  })

  socket.on('connect_error', (error) => {
    // Only log if it's a real error, not just connection retry, and only in development
    if (import.meta.env.DEV && error.message && !error.message.includes('xhr poll error')) {
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
    if (import.meta.env.DEV) {
      console.warn('Socket not initialized. Cannot join emergency room.')
    }
    return
  }

  const doJoin = () => {
    if (socket?.connected) {
      socket.emit('join_emergency', emergencyId)
      // Only log in development
      if (import.meta.env.DEV) {
        console.log(`Joined emergency room: ${emergencyId}`)
      }
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

export const onEmergencyCreated = (callback: (data: any) => void) => {
  if (socket) {
    socket.on('emergency_created', callback)
  }
}

export const onEmergencyEnded = (callback: (data: any) => void) => {
  if (socket) {
    socket.once('emergency_ended', callback)
  }
}

export const onEmergencyCancelled = (callback: (data: any) => void) => {
  if (socket) {
    socket.once('emergency_cancelled', callback)
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

