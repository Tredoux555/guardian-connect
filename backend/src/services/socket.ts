import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

export let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer) => {
  // Build allowed origins list (same as HTTP CORS)
  const socketOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim())
    : ['https://web-user-production.up.railway.app', 'https://back-end-production-4a69.up.railway.app'];

  if (process.env.NODE_ENV !== 'production') {
    socketOrigins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173');
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: socketOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    // WebSocket first for instant real-time communication, polling as fallback
    transports: ['websocket', 'polling'],
    allowUpgrades: true, // Allow fallback to polling if websocket fails
    upgradeTimeout: 10000, // 10 seconds for upgrade
    pingTimeout: 60000, // 60 seconds ping timeout
    pingInterval: 25000, // Ping every 25 seconds
    connectTimeout: 15000, // 15 seconds to connect
    allowEIO3: true, // Support older clients
    // Path must match what client uses
    path: '/socket.io/',
  });

  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      
      if (!token) {
        console.log('❌ Socket auth failed: No token');
        return next(new Error('Authentication required'));
      }

      // Verify token
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET;
      
      if (!secret) {
        console.log('❌ Socket auth failed: JWT_SECRET not configured');
        return next(new Error('Server configuration error'));
      }

      try {
        const decoded = jwt.verify(token, secret);
        (socket as any).userId = decoded.userId;
        (socket as any).userEmail = decoded.email;
        console.log(`✅ Socket auth: User ${decoded.userId} authenticated`);
        next();
      } catch (jwtError: any) {
        console.log('❌ Socket auth failed: Invalid token -', jwtError.message);
        return next(new Error('Invalid token'));
      }
    } catch (error: any) {
      console.log('❌ Socket auth error:', error.message);
      next(new Error('Authentication error'));
    }
  });

  // Log ALL engine events for debugging
  io.engine.on('initial_headers', (headers: any, req: any) => {
    console.log('🔌 Socket: Initial request from', req.headers?.['user-agent']?.substring(0, 50) || 'unknown');
  });

  io.engine.on('connection_error', (err) => {
    console.log('⚠️ Socket connection error:', err.code, '-', err.message);
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    const transport = socket.conn.transport.name;
    console.log(`✅ User ${userId} connected via ${transport}`);

    // Log transport upgrades
    socket.conn.on('upgrade', (transport) => {
      console.log(`🔄 User ${userId} upgraded to ${transport.name}`);
    });

    // Handle socket errors
    socket.on('error', (error) => {
      console.log(`❌ Socket error for ${userId}:`, error);
    });

    // Join user-specific room
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Join emergency room
    socket.on('join_emergency', (emergencyId: string) => {
      socket.join(`emergency:${emergencyId}`);
      console.log(`📍 User ${userId} joined emergency:${emergencyId}`);
    });

    // Leave emergency room
    socket.on('leave_emergency', (emergencyId: string) => {
      socket.leave(`emergency:${emergencyId}`);
      console.log(`📍 User ${userId} left emergency:${emergencyId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`👋 User ${userId} disconnected: ${reason}`);
    });
  });

  console.log('✅ Socket.io initialized (websocket → polling fallback)');
};

export const emitToEmergency = (
  emergencyId: string,
  event: string,
  data: any
) => {
  io.to(`emergency:${emergencyId}`).emit(event, data);
};

export const emitToUser = (
  userId: string,
  event: string,
  data: any
) => {
  io.to(`user:${userId}`).emit(event, data);
};
