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
import { authenticate, AuthRequest } from './middleware/auth';
import { query } from './database/db';
import { Response } from 'express';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001; // Default to 3001 to match mobile app

// Initialize Socket.io
initializeSocket(httpServer);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS preflight handler - must be before CORS middleware
app.options('*', cors());

// CORS configuration - allow specific origins for Railway deployment
app.use(cors({
  origin: [
    'https://web-user-production.up.railway.app',
    'https://back-end-production-4a69.up.railway.app',
    'https://guardian-connect-production.up.railway.app',
    'https://guardian-connect.up.railway.app',
    /\.railway\.app$/,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images, videos, and audio with CORS headers
app.use('/uploads', (req, res, next) => {
  // Set CORS headers for static files
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    // Set appropriate content type based on file extension
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
    } else if (filePath.endsWith('.mov')) {
      res.setHeader('Content-Type', 'video/quicktime');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.wav')) {
      res.setHeader('Content-Type', 'audio/wav');
    } else if (filePath.endsWith('.m4a')) {
      res.setHeader('Content-Type', 'audio/mp4');
    }
  },
}));

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
app.get('/api/user/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    console.log(`📡 GET /api/user/me - userId: ${userId}`);
    
    const result = await query(
      'SELECT id, email, verified, display_name, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    console.log(`📡 User query result: ${result.rows.length} rows`);
    
    if (result.rows.length === 0) {
      console.log(`❌ User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const responseData = {
      id: user.id,
      email: user.email,
      verified: user.verified || false,
      displayName: user.display_name,
      created_at: user.created_at,
    };
    
    console.log(`✅ Returning user data: ${JSON.stringify(responseData)}`);
    // Ensure id is returned (not user_id) and include all necessary fields
    res.json(responseData);
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// FCM Token registration endpoint - for push notifications
app.post('/api/user/fcm-token', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { token } = req.body;
    
    console.log(`📱 POST /api/user/fcm-token - userId: ${userId}`);
    console.log(`   Token: ${token ? token.substring(0, 20) + '... (' + token.length + ' chars)' : 'null (unregistering)'}`);
    
    // Check if user exists
    const userCheck = await query('SELECT email, display_name FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      console.error(`❌ User ${userId} not found`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userEmail = userCheck.rows[0].email;
    console.log(`   User: ${userEmail}`);
    
    // Update or clear the FCM token
    await query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [token || null, userId]
    );
    
    if (token) {
      console.log(`✅ FCM token registered for user ${userId} (${userEmail})`);
      console.log(`   Token length: ${token.length} characters`);
      
      // Verify it was saved
      const verifyResult = await query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
      if (verifyResult.rows[0].fcm_token === token) {
        console.log(`   ✅ Token verified in database`);
      } else {
        console.error(`   ❌ Token verification failed - token may not have been saved correctly`);
      }
    } else {
      console.log(`✅ FCM token cleared for user ${userId} (${userEmail})`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ FCM token registration error:', error);
    res.status(500).json({ error: 'Failed to register FCM token' });
  }
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
httpServer.listen(Number(PORT), '0.0.0.0', () => {
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

