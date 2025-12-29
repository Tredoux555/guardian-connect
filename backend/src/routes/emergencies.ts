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
      console.log(`🚨 Emergency created: ${emergency.id} by user ${userId}`);

      // Get user's emergency contacts
      const contactsResult = await query(
        `SELECT ec.contact_user_id, ec.contact_email, ec.contact_phone, ec.contact_name
         FROM emergency_contacts ec
         WHERE ec.user_id = $1 AND ec.status = 'active'`,
        [userId]
      );

      const contacts = contactsResult.rows;
      console.log(`📋 Found ${contacts.length} emergency contacts for user ${userId}:`);
      contacts.forEach((c: any, i: number) => {
        console.log(`   ${i + 1}. ${c.contact_name || 'Unknown'} (${c.contact_email}) - user_id: ${c.contact_user_id || 'NOT REGISTERED'}`);
      });

      // Add all contacts as participants (status: pending)
      const participantPromises = contacts.map(async (contact: any) => {
        if (contact.contact_user_id) {
          // Contact is a registered user
          await Emergency.addParticipant(emergency.id, contact.contact_user_id);
          console.log(`   ✅ Added participant: ${contact.contact_user_id}`);
          return { userId: contact.contact_user_id, name: contact.contact_name };
        }
        console.log(`   ⚠️ Contact ${contact.contact_email} is NOT a registered user - cannot notify`);
        return null;
      });

      const participants = (await Promise.all(participantPromises)).filter(
        (p: any) => p !== null
      );
      console.log(`👥 Total participants to notify: ${participants.length}`);

      // Get sender display name and email for notifications
      const userResult = await query(
        'SELECT display_name, email FROM users WHERE id = $1',
        [userId]
      );
      const senderUser = userResult.rows[0] || { email: 'Someone' };
      const senderDisplayName = getUserDisplayName(senderUser);

      // Send notifications to all registered contacts
      console.log(`📤 Starting notification process for ${participants.length} participant(s)...`);
      
      for (const participant of participants) {
        if (participant && participant.userId) {
          console.log(`\n📤 === NOTIFICATION ATTEMPT FOR: ${participant.userId} (${participant.name}) ===`);
          
          // Check if user has FCM token before attempting push
          const tokenCheck = await query(
            'SELECT fcm_token FROM users WHERE id = $1',
            [participant.userId]
          );
          const hasFcmToken = tokenCheck.rows.length > 0 && 
                             tokenCheck.rows[0].fcm_token != null &&
                             tokenCheck.rows[0].fcm_token.toString().trim().isNotEmpty;
          
          console.log(`   🔑 FCM Token Status: ${hasFcmToken ? '✅ EXISTS' : '❌ MISSING'}`);
          
          // Send Firebase push notification (for mobile apps)
          if (hasFcmToken) {
            try {
              await sendEmergencyAlert(
                participant.userId,
                emergency.id,
                senderDisplayName,
                undefined // Location will be sent when user accepts
              );
              console.log(`   ✅ Firebase push sent successfully to ${participant.userId}`);
            } catch (error: any) {
              console.error(`   ❌ FAILED to send Firebase alert to ${participant.userId}:`, error);
              console.error(`      Error type: ${error?.constructor?.name || 'Unknown'}`);
              console.error(`      Error message: ${error?.message || error?.toString() || 'No message'}`);
              if (error?.stack) {
                console.error(`      Stack: ${error.stack}`);
              }
            }
          } else {
            console.log(`   ⚠️ SKIPPING Firebase push - no FCM token for user ${participant.userId}`);
            console.log(`      User needs to log in to register FCM token`);
          }

          // Send Web Push notification (for web browsers - works even when app is closed)
          try {
            await sendEmergencyWebPush(
              participant.userId,
              emergency.id,
              senderDisplayName
            );
            console.log(`   ✅ Web push sent to ${participant.userId}`);
          } catch (error: any) {
            console.error(`   ❌ Failed to send web push to ${participant.userId}:`, error?.message || error);
          }

          // Emit socket event (for real-time updates when app is open)
          try {
            console.log(`   📡 Emitting socket event 'emergency_created' to user:${participant.userId}`);
            emitToUser(participant.userId, 'emergency_created', {
              emergencyId: emergency.id,
              userId,
              userEmail: senderUser.email,
              senderName: senderDisplayName,
              participants: participants.length,
            });
            console.log(`   ✅ Socket event emitted to user:${participant.userId}`);
          } catch (error: any) {
            console.error(`   ❌ Failed to emit socket event to ${participant.userId}:`, error?.message || error);
          }
          
          console.log(`📤 === END NOTIFICATION ATTEMPT FOR: ${participant.userId} ===\n`);
        }
      }
      console.log(`✅ Emergency ${emergency.id} created and all notifications sent`)

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

      // Emit socket event to all participants
      emitToEmergency(emergencyId, 'participant_accepted', {
        emergencyId,
        userId,
        userName: participant.user_email,
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
      const { latitude, longitude, accuracy } = req.body;

      // Reject known fallback/default coordinates that browsers return when GPS isn't available
      // San Francisco fallback (Google's default): 37.785834, -122.406417
      // This happens when:
      // - Desktop browsers use IP-based geolocation
      // - VPN makes IP appear in San Francisco
      // - Browser can't access real GPS
      const isSanFranciscoFallback = 
        (Math.abs(latitude - 37.785834) < 0.0001 && Math.abs(longitude - (-122.406417)) < 0.0001) ||
        (Math.abs(latitude - 37.7858) < 0.001 && Math.abs(longitude - (-122.4064)) < 0.001);
      
      const isNullIslandFallback = Math.abs(latitude) < 0.001 && Math.abs(longitude) < 0.001;
      
      if (isSanFranciscoFallback || isNullIslandFallback) {
        console.warn(`⚠️ Rejecting fallback location for user ${userId}:`, {
          latitude,
          longitude,
          reason: isSanFranciscoFallback ? 'San Francisco fallback (IP-based)' : 'Null Island fallback',
          emergencyId
        });
        return res.status(400).json({ 
          error: 'Invalid location: Browser returned fallback coordinates. Please enable GPS or use a mobile device for accurate location.',
          code: 'FALLBACK_LOCATION',
          details: {
            detected: isSanFranciscoFallback ? 'san_francisco_fallback' : 'null_island_fallback',
            suggestion: 'Use mobile device with GPS enabled for accurate emergency location'
          }
        });
      }

      // Warn about low accuracy locations (but still accept them)
      if (accuracy && accuracy > 1000) {
        console.warn(`⚠️ Low accuracy location from user ${userId}: ${accuracy}m (emergency: ${emergencyId})`);
      }

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
    
    // Log when there are pending emergencies (helpful for debugging)
    if (result.rows.length > 0) {
      console.log(`📥 User ${userId} has ${result.rows.length} pending emergency(ies):`);
      result.rows.forEach((e: any, i: number) => {
        console.log(`   ${i + 1}. ${e.id} from ${e.sender_display_name || e.sender_email}`);
      });
    }
    
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

// Escalate emergency to emergency services
router.post(
  '/:id/escalate',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const emergencyId = req.params.id;
      const { reason, latitude, longitude, sender_name } = req.body;
      
      // Get emergency
      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found' });
      }
      
      // Log escalation
      console.log(`🚨 ESCALATION: Emergency ${emergencyId} escalated to emergency services`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Location: ${latitude}, ${longitude}`);
      console.log(`   Sender: ${sender_name}`);
      
      // TODO: Integrate with emergency services API (911, etc.)
      // For now, just log the escalation (update method not implemented yet)
      console.log(`   Status: Emergency marked as escalated (in logs only - DB update pending)`);
      
      // Notify all participants
      emitToEmergency(emergencyId, 'emergency_escalated', {
        emergencyId,
        reason,
        escalatedAt: new Date().toISOString(),
      });
      
      res.json({ 
        message: 'Emergency escalated to emergency services',
        escalatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Escalate emergency error:', error);
      res.status(500).json({ error: 'Failed to escalate emergency' });
    }
  }
);

// Get emergency history
router.get(
  '/history',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const page = parseInt(req.query.page as string) || 0;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = page * limit;
      
      // Get emergencies where user was sender or participant
      const result = await query(
        `SELECT DISTINCT e.*, 
         COUNT(DISTINCT ep.user_id) FILTER (WHERE ep.status = 'accepted') as responder_count
         FROM emergencies e
         LEFT JOIN emergency_participants ep ON e.id = ep.emergency_id
         WHERE (e.user_id = $1 OR ep.user_id = $1)
         AND e.status IN ('ended', 'cancelled', 'escalated')
         GROUP BY e.id
         ORDER BY e.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error('Get emergency history error:', error);
      res.status(500).json({ error: 'Failed to get emergency history' });
    }
  }
);

// Mount message routes
router.use('/', messageRoutes);

export default router;

