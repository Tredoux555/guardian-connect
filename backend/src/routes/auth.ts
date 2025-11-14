import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User';
import { generateTokens, createSession, deleteSession, verifyToken } from '../services/jwt';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';
import { query } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Rate limiting
// TODO: RE-ENABLE RATE LIMITING BEFORE PRODUCTION DEPLOYMENT!
// Rate limiting is currently disabled for development. Must be re-enabled for production.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
});

// Disable rate limiting in development
const rateLimiter = process.env.NODE_ENV === 'production' ? authLimiter : (req: any, res: any, next: any) => next();

// Register
router.post(
  '/register',
  rateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((err: any) => {
          if (err.type === 'field') {
            const field = err.path === 'email' ? 'Email' : 'Password';
            return `${field}: ${err.msg}`;
          }
          return err.msg;
        }).join(', ');
        return res.status(400).json({ 
          error: errorMessages || 'Validation failed',
          errors: errors.array() // Keep detailed errors for debugging
        });
      }

      const { email, password } = req.body;

      // Check if user exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Create user
      const user = await User.create(email, password);

      // Generate verification token
      const verificationToken = uuidv4();
      await query(
        'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, verificationToken, new Date(Date.now() + 24 * 60 * 60 * 1000)] // 24 hours
      );

      // Send verification email (optional - don't fail if email service not configured)
      try {
        await sendVerificationEmail(email, verificationToken);
      } catch (emailError) {
        console.warn('Failed to send verification email (email service may not be configured):', emailError);
        // Continue anyway - user can be verified manually by admin
      }

      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: user.id,
          email: user.email,
          verified: user.verified,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Verify Email
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const result = await query(
      'SELECT user_id FROM email_verifications WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const userId = result.rows[0].user_id;
    await User.verifyEmail(userId);
    await query('DELETE FROM email_verifications WHERE token = $1', [token]);

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Login
router.post(
  '/login',
  rateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await User.findByEmail(email);
      if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await User.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.verified) {
        return res.status(403).json({ error: 'Please verify your email before logging in' });
      }

      const payload = {
        userId: user.id,
        email: user.email,
        role: 'user' as const,
      };

      const { accessToken, refreshToken } = generateTokens(payload);
      await createSession(user.id, refreshToken);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          verified: user.verified,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Refresh Token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify session exists
    const sessionResult = await query(
      'SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const decoded = verifyToken(refreshToken);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: 'user' as const,
    };

    const { accessToken } = generateTokens(payload);

    res.json({ accessToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Forgot Password
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findByEmail(email);

      // Don't reveal if user exists for security
      if (user) {
        const resetToken = uuidv4();
        await query(
          'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
          [user.id, resetToken, new Date(Date.now() + 60 * 60 * 1000)] // 1 hour
        );
        await sendPasswordResetEmail(email, resetToken);
      }

      res.json({ message: 'If an account exists, a password reset email has been sent' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Password reset request failed' });
    }
  }
);

// Reset Password
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;

      const result = await query(
        'SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()',
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const userId = result.rows[0].user_id;
      await User.updatePassword(userId, password);
      await query('DELETE FROM password_resets WHERE token = $1', [token]);
      
      // Invalidate all existing sessions
      await query('DELETE FROM sessions WHERE user_id = $1', [userId]);

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  }
);

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await deleteSession(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;

