import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import emergencyRoutes from './routes/emergencies';
import contactRoutes from './routes/contacts';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';
import donationRoutes from './routes/donations';
import subscriptionRoutes from './routes/subscriptions';
import { initializeSocket } from './services/socket';
import { authenticate } from './middleware/auth';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);

// Initialize Socket.io
initializeSocket(httpServer);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// CORS configuration - allow all localhost ports for development
// Also allow network IP addresses for phone access
// Get current network IP dynamically
const getNetworkIP = (): string => {
  // Try to get from environment variable first
  if (process.env.NETWORK_IP) {
    return process.env.NETWORK_IP;
  }
  // Default to common network IP (update if needed)
  return '192.168.1.3';
};
const networkIP = getNetworkIP(); // Your local network IP
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  'http://localhost:3002', // Admin panel (default)
  'http://localhost:3003', // Web user interface (default)
  'http://localhost:3004', // Admin panel (alternative port)
  'http://localhost:3005', // Web user interface (alternative port)
  'http://localhost:3000', // Mobile app (if using web)
  `http://${networkIP}:3002`, // Admin panel (network)
  `http://${networkIP}:3003`, // Web user interface (network)
  `http://${networkIP}:3004`, // Admin panel (network alternative)
  `http://${networkIP}:3005`, // Web user interface (network alternative)
];

app.use(cors({
  origin: (origin, callback) => {
    try {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        console.log('✅ CORS: Allowing request with no origin');
        return callback(null, true);
      }
      
      // In development, allow ALL origins for easier testing
      // This prevents CORS issues when frontend and backend are on different IPs/ports
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ CORS: Allowing origin in development:', origin);
        return callback(null, true);
      }
      
      // In production, check allowed origins
      // If ALLOWED_ORIGINS is not set, allow all (for initial setup)
      if (!process.env.ALLOWED_ORIGINS || allowedOrigins.length === 0) {
        console.warn('⚠️ CORS: ALLOWED_ORIGINS not set, allowing all origins (not recommended for production)');
        return callback(null, true);
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        console.log('✅ CORS: Allowing origin from allowed list:', origin);
        return callback(null, true);
      } else {
        console.warn('❌ CORS: Blocked origin:', origin);
        console.warn('❌ CORS: Allowed origins:', allowedOrigins);
        return callback(new Error('Not allowed by CORS'));
      }
    } catch (error) {
      console.error('❌ CORS: Error in origin callback:', error);
      // On error, allow the request to prevent complete failure
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Guardian Connect API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      emergencies: '/api/emergencies',
      contacts: '/api/contacts',
      admin: '/api/admin',
    },
    documentation: 'See README.md for API documentation',
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Protected routes
app.get('/api/user/me', authenticate, (req, res) => {
  res.json({ message: 'User endpoint - to be implemented' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Listen on all interfaces (0.0.0.0) to allow network access
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Accessible on all network interfaces (0.0.0.0:${PORT})`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;

