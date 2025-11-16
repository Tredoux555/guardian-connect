import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/db';
import { sendBroadcastNotification } from '../services/push';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth';
import { User } from '../models/User';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Admin login
router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  async (req: express.Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const result = await query(
        'SELECT id, email, password_hash FROM admins WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const admin = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, admin.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: admin.id, email: admin.email, role: 'admin' },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '24h' }
      );

      res.json({ token, admin: { id: admin.id, email: admin.email } });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Get all users
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, email, display_name, verified, created_at FROM users ORDER BY created_at DESC LIMIT 1000',
      []
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user details including contacts
router.get('/users/:userId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Get user info
    const userResult = await query(
      'SELECT id, email, display_name, verified, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get user's contacts
    const contactsResult = await query(
      `SELECT ec.id, ec.contact_user_id, ec.contact_email, ec.contact_phone, 
              ec.contact_name, ec.status, ec.created_at,
              u.email as contact_user_email
       FROM emergency_contacts ec
       LEFT JOIN users u ON ec.contact_user_id = u.id
       WHERE ec.user_id = $1
       ORDER BY ec.created_at DESC`,
      [userId]
    );
    
    res.json({
      ...user,
      contacts: contactsResult.rows,
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

// Delete user contact (admin can remove any contact)
router.delete('/users/:userId/contacts/:contactId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, contactId } = req.params;
    
    // Get contact info to check if it's bidirectional
    const contactResult = await query(
      'SELECT contact_user_id FROM emergency_contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );
    
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const contactUserId = contactResult.rows[0].contact_user_id;
    
    // Delete the contact
    await query(
      'DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );
    
    // If bidirectional, remove reverse contact too
    if (contactUserId) {
      await query(
        'DELETE FROM emergency_contacts WHERE user_id = $1 AND contact_user_id = $2',
        [contactUserId, userId]
      );
    }
    
    res.json({ message: 'Contact removed successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Send message to individual user
router.post(
  '/users/:userId/message',
  authenticate,
  requireAdmin,
  [body('message').notEmpty()],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { message } = req.body;
      const adminId = req.userId!;

      // Save message
      await query(
        'INSERT INTO admin_messages (admin_id, user_id, message, is_broadcast) VALUES ($1, $2, $3, $4)',
        [adminId, userId, message, false]
      );

      // Send push notification
      await sendBroadcastNotification(
        [userId],
        'Admin Message',
        message,
        { type: 'admin_message' }
      );

      res.json({ message: 'Message sent' });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// Send broadcast message to all users
router.post(
  '/messages/broadcast',
  authenticate,
  requireAdmin,
  [body('message').notEmpty()],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { message } = req.body;
      const adminId = req.userId!;

      // Get all user IDs
      const usersResult = await query('SELECT id FROM users', []);
      const userIds = usersResult.rows.map((row: any) => row.id);

      // Save broadcast message
      await query(
        'INSERT INTO admin_messages (admin_id, message, is_broadcast) VALUES ($1, $2, $3)',
        [adminId, message, true]
      );

      // Send push notifications
      await sendBroadcastNotification(
        userIds,
        'Important Announcement',
        message,
        { type: 'broadcast' }
      );

      res.json({ message: `Broadcast sent to ${userIds.length} users` });
    } catch (error) {
      console.error('Broadcast error:', error);
      res.status(500).json({ error: 'Failed to send broadcast' });
    }
  }
);

// Send group message
router.post(
  '/messages/group',
  authenticate,
  requireAdmin,
  [
    body('userIds').isArray(),
    body('message').notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userIds, message } = req.body;
      const adminId = req.userId!;

      // Save messages for each user
      for (const userId of userIds) {
        await query(
          'INSERT INTO admin_messages (admin_id, user_id, message, is_broadcast) VALUES ($1, $2, $3, $4)',
          [adminId, userId, message, false]
        );
      }

      // Send push notifications
      await sendBroadcastNotification(
        userIds,
        'Group Message',
        message,
        { type: 'group_message' }
      );

      res.json({ message: `Message sent to ${userIds.length} users` });
    } catch (error) {
      console.error('Group message error:', error);
      res.status(500).json({ error: 'Failed to send group message' });
    }
  }
);

// Verify user (for testing/admin purposes)
router.post(
  '/users/:userId/verify',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      await User.verifyEmail(userId);
      res.json({ message: 'User verified successfully' });
    } catch (error) {
      console.error('Verify user error:', error);
      res.status(500).json({ error: 'Failed to verify user' });
    }
  }
);

// Delete user
router.delete('/users/:userId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user (cascade will handle related records)
    await query('DELETE FROM users WHERE id = $1', [userId]);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get analytics
router.get('/analytics', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const usersResult = await query('SELECT COUNT(*) as count FROM users', []);
    const emergenciesResult = await query(
      "SELECT COUNT(*) as count FROM emergencies WHERE status = 'active'",
      []
    );
    const participantsResult = await query(
      "SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted FROM emergency_participants",
      []
    );

    const totalUsers = parseInt(usersResult.rows[0].count);
    const activeEmergencies = parseInt(emergenciesResult.rows[0].count);
    const totalParticipants = parseInt(participantsResult.rows[0].total);
    const acceptedParticipants = parseInt(participantsResult.rows[0].accepted);
    const responseRate = totalParticipants > 0
      ? Math.round((acceptedParticipants / totalParticipants) * 100)
      : 0;

    res.json({
      totalUsers,
      activeEmergencies,
      responseRate,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

export default router;

