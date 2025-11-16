import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Emergency } from '../models/Emergency';
import { query } from '../database/db';
import { sendEmergencyAlert } from '../services/push';
import { sendEmergencyWebPush } from '../services/webPush';
import { emitToEmergency, emitToUser } from '../services/socket';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getUserDisplayName } from '../utils/userDisplay';
import messageRoutes from './messages';

const router = express.Router();

// Create emergency
router.post(
  '/create',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      
      // Check if user already has an active emergency
      const activeEmergency = await Emergency.findActiveByUserId(userId);
      if (activeEmergency) {
        return res.status(400).json({
          error: 'You already have an active emergency',
          emergencyId: activeEmergency.id,
        });
      }

      // Create emergency
      const emergency = await Emergency.create(userId);

      // Get user's emergency contacts
      const contactsResult = await query(
        `SELECT ec.contact_user_id, ec.contact_email, ec.contact_phone, ec.contact_name
         FROM emergency_contacts ec
         WHERE ec.user_id = $1 AND ec.status = 'active'`,
        [userId]
      );

      const contacts = contactsResult.rows;

      // Add all contacts as participants (status: pending)
      const participantPromises = contacts.map(async (contact: any) => {
        if (contact.contact_user_id) {
          // Contact is a registered user
          await Emergency.addParticipant(emergency.id, contact.contact_user_id);
          return { userId: contact.contact_user_id, name: contact.contact_name };
        }
        return null;
      });

      const participants = (await Promise.all(participantPromises)).filter(
        (p: any) => p !== null
      );

      // Get sender display name and email for notifications
      const userResult = await query(
        'SELECT display_name, email FROM users WHERE id = $1',
        [userId]
      );
      const senderUser = userResult.rows[0] || { email: 'Someone' };
      const senderDisplayName = getUserDisplayName(senderUser);

      // Send notifications to all registered contacts
      for (const participant of participants) {
        if (participant && participant.userId) {
          // Send Firebase push notification (for mobile apps)
          try {
            await sendEmergencyAlert(
              participant.userId,
              emergency.id,
              senderDisplayName,
              undefined // Location will be sent when user accepts
            );
          } catch (error) {
            console.error(`Failed to send Firebase alert to ${participant.userId}:`, error);
          }

          // Send Web Push notification (for web browsers - works even when app is closed)
          try {
            await sendEmergencyWebPush(
              participant.userId,
              emergency.id,
              senderDisplayName
            );
          } catch (error) {
            console.error(`Failed to send web push to ${participant.userId}:`, error);
          }

          // Emit socket event (for real-time updates when app is open)
          emitToUser(participant.userId, 'emergency_created', {
            emergencyId: emergency.id,
            userId,
            userEmail: senderUser.email,
            senderName: senderDisplayName,
            participants: participants.length,
          });
        }
      }

      res.status(201).json({
        emergency: {
          id: emergency.id,
          status: emergency.status,
          createdAt: emergency.created_at,
        },
        participantsCount: participants.length,
      });
    } catch (error) {
      console.error('Create emergency error:', error);
      res.status(500).json({ error: 'Failed to create emergency' });
    }
  }
);

// Accept emergency (respondent accepts to help)
router.post(
  '/:id/accept',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const emergencyId = req.params.id;
      const userId = req.userId!;

      // Verify emergency exists and is active
      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found' });
      }
      if (emergency.status !== 'active') {
        return res.status(400).json({ error: 'Emergency is not active' });
      }

      // Verify user is a participant
      const participants = await Emergency.getParticipants(emergencyId);
      const participant = participants.find((p) => p.user_id === userId);
      if (!participant) {
        return res.status(403).json({ error: 'You are not a participant in this emergency' });
      }

      // Update participant status to accepted
      await Emergency.updateParticipantStatus(emergencyId, userId, 'accepted');

      // Get user's display name for socket event
      const userResult = await query(
        'SELECT display_name, email FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0] || { email: participant.user_email };
      const userDisplayName = getUserDisplayName(user);

      // Emit socket event to all participants
      emitToEmergency(emergencyId, 'participant_accepted', {
        emergencyId,
        userId,
        userName: userDisplayName,
        user_email: user.email,
        user_display_name: userDisplayName,
      });

      res.json({
        message: 'Emergency accepted. Your location will now be shared.',
        emergencyId,
      });
    } catch (error) {
      console.error('Accept emergency error:', error);
      res.status(500).json({ error: 'Failed to accept emergency' });
    }
  }
);

// Reject emergency (respondent unavailable)
router.post(
  '/:id/reject',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const emergencyId = req.params.id;
      const userId = req.userId!;

      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found' });
      }

      // Verify user is a participant
      const participants = await Emergency.getParticipants(emergencyId);
      const participant = participants.find((p) => p.user_id === userId);
      if (!participant) {
        return res.status(403).json({ error: 'You are not a participant in this emergency' });
      }

      // Update participant status to rejected
      await Emergency.updateParticipantStatus(emergencyId, userId, 'rejected');

      // Emit socket event
      emitToEmergency(emergencyId, 'participant_rejected', {
        emergencyId,
        userId,
        userName: participant.user_email,
      });

      res.json({
        message: 'You have been marked as unavailable for this emergency.',
        emergencyId,
      });
    } catch (error) {
      console.error('Reject emergency error:', error);
      res.status(500).json({ error: 'Failed to reject emergency' });
    }
  }
);

// Update location (only for accepted participants)
router.post(
  '/:id/location',
  authenticate,
  [
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const emergencyId = req.params.id;
      const userId = req.userId!;
      const { latitude, longitude } = req.body;

      // Verify emergency exists and is active
      const emergency = await Emergency.findById(emergencyId);
      if (!emergency || emergency.status !== 'active') {
        return res.status(400).json({ error: 'Emergency is not active' });
      }

      // Allow emergency creator OR accepted participants to share location
      const participants = await Emergency.getParticipants(emergencyId);
      const participant = participants.find((p) => p.user_id === userId);
      const isEmergencyCreator = emergency.user_id === userId;
      
      if (!isEmergencyCreator && (!participant || participant.status !== 'accepted')) {
        return res.status(403).json({
          error: 'You must accept the emergency before sharing your location',
        });
      }

      // Add location
      await Emergency.addLocation(emergencyId, userId, latitude, longitude);

      // Get user's display name and email for socket event
      const userResult = await query(
        'SELECT display_name, email FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0] || { email: null };
      const userDisplayName = getUserDisplayName(user);
      const userEmail = user.email || null;

      // Emit socket event to all participants (include user_display_name for frontend display)
      emitToEmergency(emergencyId, 'location_update', {
        emergencyId,
        userId,
        user_email: userEmail,
        user_display_name: userDisplayName,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });

      res.json({ message: 'Location updated' });
    } catch (error) {
      console.error('Update location error:', error);
      res.status(500).json({ error: 'Failed to update location' });
    }
  }
);

// Get user's pending emergencies (emergencies where user is a participant with pending status)
router.get('/pending', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const result = await query(
      `SELECT DISTINCT e.id, e.user_id, e.status, e.created_at, e.ended_at,
              u.email as sender_email,
              COALESCE(u.display_name, u.email) as sender_display_name
       FROM emergencies e
       JOIN emergency_participants ep ON e.id = ep.emergency_id
       JOIN users u ON e.user_id = u.id
       WHERE ep.user_id = $1 
       AND ep.status = 'pending'
       AND e.status = 'active'
       ORDER BY e.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get pending emergencies error:', error);
    res.status(500).json({ error: 'Failed to get pending emergencies' });
  }
});

// Get user's active emergency (emergency they created)
router.get('/active', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const emergency = await Emergency.findActiveByUserId(userId);
    if (emergency) {
      const participants = await Emergency.getParticipants(emergency.id);
      const locations = await Emergency.getLatestLocations(emergency.id);
      res.json({
        emergency,
        participants,
        locations,
      });
    } else {
      res.json({ emergency: null });
    }
  } catch (error) {
    console.error('Get active emergency error:', error);
    res.status(500).json({ error: 'Failed to get active emergency' });
  }
});

// Get emergency details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const emergencyId = req.params.id;
    const emergency = await Emergency.findById(emergencyId);

    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    // Get participants
    const participants = await Emergency.getParticipants(emergencyId);

    // Get latest locations (only for accepted participants)
    const locations = await Emergency.getLatestLocations(emergencyId);

    res.json({
      emergency,
      participants,
      locations,
    });
  } catch (error) {
    console.error('Get emergency error:', error);
    res.status(500).json({ error: 'Failed to get emergency' });
  }
});

// End emergency
router.post(
  '/:id/end',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const emergencyId = req.params.id;
      const userId = req.userId!;

      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found' });
      }

      if (emergency.user_id !== userId) {
        return res.status(403).json({ error: 'Only the emergency creator can end it' });
      }

      await Emergency.end(emergencyId, userId);

      // Emit socket event
      emitToEmergency(emergencyId, 'emergency_ended', {
        emergencyId,
        endedAt: new Date().toISOString(),
      });

      res.json({ message: 'Emergency ended' });
    } catch (error) {
      console.error('End emergency error:', error);
      res.status(500).json({ error: 'Failed to end emergency' });
    }
  }
);

// Cancel emergency
router.post(
  '/:id/cancel',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const emergencyId = req.params.id;
      const userId = req.userId!;

      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found' });
      }

      if (emergency.user_id !== userId) {
        return res.status(403).json({ error: 'Only the emergency creator can cancel it' });
      }

      await Emergency.cancel(emergencyId, userId);

      // Emit socket event
      emitToEmergency(emergencyId, 'emergency_cancelled', {
        emergencyId,
        cancelledAt: new Date().toISOString(),
      });

      res.json({ message: 'Emergency cancelled' });
    } catch (error) {
      console.error('Cancel emergency error:', error);
      res.status(500).json({ error: 'Failed to cancel emergency' });
    }
  }
);

// Mount message routes
router.use('/', messageRoutes);

export default router;

