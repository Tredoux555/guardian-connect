import express, { Response } from 'express';
import { query } from '../database/db'
import { Emergency } from '../models/Emergency';
import { upload, getImageUrl, getAudioUrl, getVideoUrl } from '../services/fileUpload';
import { emitToEmergency } from '../services/socket';
import { AuthRequest, authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for message sending (prevent spam)
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 messages per minute
  message: 'Too many messages sent. Please wait a moment.',
  skip: () => process.env.NODE_ENV !== 'production', // Disable in development
});

/**
 * GET /api/emergencies/:id/messages
 * Get all messages for an emergency
 */
router.get(
  '/:id/messages',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const emergencyId = req.params.id;
      const userId = req.userId!;

      // Verify emergency exists
      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found' });
      }

      // Verify user is emergency participant (creator or accepted participant)
      const participants = await Emergency.getParticipants(emergencyId);
      const participant = participants.find((p) => p.user_id === userId);
      const isEmergencyCreator = emergency.user_id === userId;

      if (!isEmergencyCreator && (!participant || participant.status !== 'accepted')) {
        return res.status(403).json({
          error: 'You must be an emergency participant to view messages',
        });
      }

      // Get messages with user info
      const messagesResult = await query(
        `SELECT 
          em.id,
          em.emergency_id,
          em.user_id,
          em.message,
          em.image_url,
          em.audio_url,
          em.video_url,
          em.created_at,
          u.email as user_email,
          COALESCE(u.display_name, u.email) as user_display_name
        FROM emergency_messages em
        JOIN users u ON em.user_id = u.id
        WHERE em.emergency_id = $1
        ORDER BY em.created_at ASC
        LIMIT 100`,
        [emergencyId]
      );

      const messages = messagesResult.rows.map((row: any) => ({
        id: row.id,
        emergency_id: row.emergency_id,
        user_id: row.user_id,
        user_email: row.user_email,
        user_display_name: row.user_display_name,
        message: row.message,
        image_url: row.image_url,
        audio_url: row.audio_url,
        video_url: row.video_url,
        created_at: row.created_at,
      }));

      res.json({ messages });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to retrieve messages' });
    }
  }
);

/**
 * POST /api/emergencies/:id/messages
 * Send a text message, photo, audio, or video to an emergency
 */
router.post(
  '/:id/messages',
  authenticate,
  messageLimiter,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const emergencyId = req.params.id;
      const userId = req.userId!;
      const message = req.body.message?.trim() || null;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const imageFile = files?.image?.[0];
      const audioFile = files?.audio?.[0];
      const videoFile = files?.video?.[0];

      // Validate: must have either message, image, audio, or video
      if (!message && !imageFile && !audioFile && !videoFile) {
        return res.status(400).json({
          error: 'Message, image, audio, or video is required',
        });
      }

      // Verify emergency exists and is active
      const emergency = await Emergency.findById(emergencyId);
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found' });
      }

      if (emergency.status !== 'active') {
        return res.status(400).json({
          error: 'Cannot send messages to inactive emergency',
        });
      }

      // Verify user is emergency participant (creator or accepted participant)
      const participants = await Emergency.getParticipants(emergencyId);
      const participant = participants.find((p) => p.user_id === userId);
      const isEmergencyCreator = emergency.user_id === userId;

      if (!isEmergencyCreator && (!participant || participant.status !== 'accepted')) {
        return res.status(403).json({
          error: 'You must accept the emergency before sending messages',
        });
      }

      // Get image URL if file was uploaded
      let imageUrl: string | null = null;
      if (imageFile) {
        // Validate image file size (5MB max)
        if (imageFile.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            error: 'Image file is too large. Maximum size is 5MB.',
          });
        }
        imageUrl = getImageUrl(imageFile.filename);
      }

      // Get audio URL if file was uploaded
      let audioUrl: string | null = null;
      if (audioFile) {
        audioUrl = getAudioUrl(audioFile.filename);
      }

      // Get video URL if file was uploaded
      let videoUrl: string | null = null;
      if (videoFile) {
        // Validate video file size (50MB max)
        if (videoFile.size > 50 * 1024 * 1024) {
          return res.status(400).json({
            error: 'Video file is too large. Maximum size is 50MB.',
          });
        }
        videoUrl = getVideoUrl(videoFile.filename);
      }

      // Insert message into database
      const result = await query(
        `INSERT INTO emergency_messages (emergency_id, user_id, message, image_url, audio_url, video_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, emergency_id, user_id, message, image_url, audio_url, video_url, created_at`,
        [emergencyId, userId, message, imageUrl, audioUrl, videoUrl]
      );

      const savedMessage = result.rows[0];

      // Get user display name and email for socket event and response
      const userResult = await query(
        'SELECT display_name, email FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0] || { email: null };
      const userEmail = user.email || null;
      const userDisplayName = user.display_name || userEmail;

      // Emit socket event to all participants in emergency room IMMEDIATELY
      const messageData = {
        emergencyId,
        messageId: savedMessage.id,
        userId,
        user_email: userEmail,
        user_display_name: userDisplayName,
        message: savedMessage.message,
        image_url: savedMessage.image_url,
        audio_url: savedMessage.audio_url,
        video_url: savedMessage.video_url,
        created_at: savedMessage.created_at,
      };
      
      console.log(`📤 Emitting new_message to emergency:${emergencyId}`, {
        messageId: savedMessage.id,
        userId,
        hasMessage: !!savedMessage.message,
        hasImage: !!savedMessage.image_url,
        hasAudio: !!savedMessage.audio_url,
        hasVideo: !!savedMessage.video_url,
      });
      
      emitToEmergency(emergencyId, 'new_message', messageData);

      // Include user_email and user_display_name in response for immediate frontend display
      res.status(201).json({
        message: {
          ...savedMessage,
          user_email: userEmail,
          user_display_name: userDisplayName,
        },
      });
    } catch (error: any) {
      console.error('Send message error:', error);

      // Handle multer errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File is too large. Maximum size is 50MB for videos, 10MB for audio, 5MB for images.',
        });
      }

      if (error.message && error.message.includes('Invalid file type')) {
        return res.status(400).json({
          error: error.message,
        });
      }

      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

export default router;

