import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/db';
import { sendContactInvitation } from '../services/email';
import { AuthRequest, authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all contacts
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const result = await query(
      `SELECT ec.id, ec.contact_user_id, ec.contact_email, ec.contact_phone, 
              ec.contact_name, ec.status, ec.created_at,
              u.email as user_email
       FROM emergency_contacts ec
       LEFT JOIN users u ON ec.contact_user_id = u.id
       WHERE ec.user_id = $1
       ORDER BY ec.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

// Add contact
router.post(
  '/add',
  authenticate,
  [
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone('any'),
    body('name').notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.userId!;
      const { email, phone, name } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ error: 'Email or phone is required' });
      }

      // Check if contact is a registered user
      let contactUserId = null;
      if (email) {
        const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows.length > 0) {
          contactUserId = userResult.rows[0].id;
        }
      }

      // Check if contact already exists
      const existingResult = await query(
        `SELECT id FROM emergency_contacts 
         WHERE user_id = $1 AND (contact_email = $2 OR contact_phone = $3)`,
        [userId, email || null, phone || null]
      );

      if (existingResult.rows.length > 0) {
        return res.status(400).json({ error: 'Contact already exists' });
      }

      // Add contact (bidirectional - if contact is a registered user, add them to each other's contacts)
      const result = await query(
        `INSERT INTO emergency_contacts 
         (user_id, contact_user_id, contact_email, contact_phone, contact_name, status) 
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, contact_user_id, contact_email, contact_phone, contact_name, status, created_at`,
        [userId, contactUserId, email || null, phone || null, name, contactUserId ? 'active' : 'pending']
      );

      const contact = result.rows[0];

      // If contact is a registered user, create bidirectional relationship
      if (contactUserId) {
        // Get current user's info for the reverse contact
        const currentUserResult = await query(
          'SELECT id, email FROM users WHERE id = $1',
          [userId]
        );
        const currentUser = currentUserResult.rows[0];
        
        if (currentUser) {
          // Check if reverse contact already exists
          const reverseExists = await query(
            `SELECT id FROM emergency_contacts 
             WHERE user_id = $1 AND contact_user_id = $2`,
            [contactUserId, userId]
          );
          
          // Only add if it doesn't exist
          if (reverseExists.rows.length === 0) {
            await query(
              `INSERT INTO emergency_contacts 
               (user_id, contact_user_id, contact_email, contact_phone, contact_name, status) 
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [contactUserId, userId, currentUser.email, null, currentUser.email.split('@')[0] || 'Contact', 'active']
            );
          }
        }
      }

      // If contact is not a registered user, send invitation
      if (!contactUserId && email) {
        const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
        const inviterEmail = userResult.rows[0]?.email || 'Someone';
        const downloadLink = `${process.env.APP_URL || 'http://localhost:3000'}/download`;
        
        await sendContactInvitation(email, inviterEmail, downloadLink);
      }

      res.status(201).json(contact);
    } catch (error) {
      console.error('Add contact error:', error);
      res.status(500).json({ error: 'Failed to add contact' });
    }
  }
);

// Remove contact (bidirectional - also remove reverse contact)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const contactId = req.params.id;

    console.log('Delete contact request:', { userId, contactId });

    // Validate UUID format
    if (!contactId || contactId.length !== 36) {
      return res.status(400).json({ error: 'Invalid contact ID format' });
    }

    // Get contact info before deleting
    const contactResult = await query(
      'SELECT contact_user_id FROM emergency_contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );

    if (contactResult.rows.length === 0) {
      console.log('Contact not found:', { contactId, userId });
      return res.status(404).json({ error: 'Contact not found' });
    }

    const contactUserId = contactResult.rows[0].contact_user_id;

    // Delete the contact
    await query(
      'DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );

    // If it was a bidirectional contact (registered user), remove reverse contact too
    if (contactUserId) {
      await query(
        'DELETE FROM emergency_contacts WHERE user_id = $1 AND contact_user_id = $2',
        [contactUserId, userId]
      );
    }

    console.log('Contact deleted successfully:', { contactId });
    res.json({ message: 'Contact removed' });
  } catch (error) {
    console.error('Remove contact error:', error);
    res.status(500).json({ error: 'Failed to remove contact' });
  }
});

export default router;

