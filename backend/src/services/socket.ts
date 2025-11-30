import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

export let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps)
        if (!origin) {
          console.log('✅ Socket.io CORS: Allowing request with no origin');
          return callback(null, true);
        }
        
        // In development, allow ALL origins for easier testing
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Socket.io CORS: Allowing origin in development:', origin);
          return callback(null, true);
        }
        
        // In production, check allowed origins OR allow all (for mobile apps)
        // Mobile apps don't send origin headers, so we need to be permissive
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
        if (allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) {
          console.log('✅ Socket.io CORS: Allowing origin:', origin || 'no origin');
          callback(null, true);
        } else {
          console.warn('❌ Socket.io CORS: Blocked origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    transports: ['polling', 'websocket'], // Explicitly allow both transports
    allowEIO3: true, // Allow older Engine.IO clients
    pingTimeout: 60000, // Increase timeout for Railway (60 seconds)
    pingInterval: 25000, // Send heartbeat every 25 seconds
    connectTimeout: 45000, // Connection timeout (45 seconds)
  });

  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      console.log('🔐 Socket auth attempt');
      console.log('   Token provided:', !!token);
      console.log('   Token in auth:', !!socket.handshake.auth?.token);
      console.log('   Token in query:', !!socket.handshake.query?.token);
      console.log('   Origin:', socket.handshake.headers.origin || 'no origin');
      console.log('   Transport:', socket.conn.transport?.name || 'unknown');
      
      if (!token) {
        console.log('❌ Socket auth: No token provided');
        console.log('   Auth object:', JSON.stringify(socket.handshake.auth));
        console.log('   Query object:', JSON.stringify(socket.handshake.query));
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token (simplified - in production, use proper JWT verification)
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.log('❌ Socket auth: JWT_SECRET not configured');
        return next(new Error('JWT_SECRET not configured'));
      }

      try {
        const decoded = jwt.verify(token, secret);
        console.log('✅ Socket auth: Token verified for user:', decoded.userId);
        (socket as any).userId = decoded.userId;
        (socket as any).userEmail = decoded.email;
        next();
      } catch (jwtError: any) {
        console.log('❌ Socket auth: Token verification failed');
        console.log('   Error:', jwtError.message || jwtError);
        console.log('   Token length:', token.length);
        console.log('   Token preview:', token.substring(0, 20) + '...');
        return next(new Error('Authentication error: Invalid token'));
      }
    } catch (error: any) {
      console.log('❌ Socket auth: Unexpected error:', error.message || error);
      console.log('   Error stack:', error.stack);
      next(new Error('Authentication error'));
    }
  });

  // Handle connection errors
  io.engine.on('connection_error', (err) => {
    console.log('❌ Socket.io connection error:', err.req?.url, err.message);
    console.log('   Error code:', err.code);
    console.log('   Error context:', err.context);
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    console.log(`✅ User ${userId} connected to Socket.io`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Transport: ${socket.conn.transport.name}`);

    // Handle socket errors
    socket.on('error', (error) => {
      console.log(`❌ Socket error for user ${userId}:`, error);
    });

    // Join user-specific room for direct messaging
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their user room`);
    }

    // Join emergency room
    socket.on('join_emergency', (emergencyId: string) => {
      socket.join(`emergency:${emergencyId}`);
      console.log(`User ${userId} joined emergency:${emergencyId}`);
    });

    // Leave emergency room
    socket.on('leave_emergency', (emergencyId: string) => {
      socket.leave(`emergency:${emergencyId}`);
      console.log(`User ${userId} left emergency:${emergencyId}`);
    });

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected from Socket.io`);
    });
  });

  console.log('✅ Socket.io initialized');
};

export const emitToEmergency = (
  emergencyId: string,
  event: string,
  data: any
) => {
  io.to(`emergency:${emergencyId}`).emit(event, data);
};

// Emit to a specific user by userId
export const emitToUser = (
  userId: string,
  event: string,
  data: any
) => {
  io.to(`user:${userId}`).emit(event, data);
};






