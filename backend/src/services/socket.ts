import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

export let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token (simplified - in production, use proper JWT verification)
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('JWT_SECRET not configured'));
      }

      const decoded = jwt.verify(token, secret);
      (socket as any).userId = decoded.userId;
      (socket as any).userEmail = decoded.email;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    console.log(`User ${userId} connected to Socket.io`);

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






