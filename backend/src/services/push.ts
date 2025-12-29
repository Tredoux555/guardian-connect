import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { query } from '../database/db';

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
}

export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  try {
    // Get user's FCM token from database (we'll add this to users table later)
    const userResult = await query(
      'SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL',
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.log(`No FCM token found for user ${userId}`);
      return;
    }

    const fcmToken = userResult.rows[0].fcm_token;

    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      token: fcmToken,
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'emergency_alerts', // High-priority channel
          priority: 'max' as const,
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public' as const,
        },
      },
      apns: {
        headers: {
          'apns-priority': '10', // Highest priority
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'content-available': 1,
            'interruption-level': 'critical', // Bypass Do Not Disturb
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Push notification sent:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

export const sendEmergencyAlert = async (
  userId: string,
  emergencyId: string,
  senderName: string,
  location?: { latitude: number; longitude: number }
) => {
  try {
    console.log(`🚨 sendEmergencyAlert called for user ${userId}, emergency ${emergencyId}`);
    
    // Get user's FCM token with detailed logging
    const userResult = await query(
      'SELECT fcm_token, email, display_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ User ${userId} not found in database`);
      throw new Error(`User ${userId} not found`);
    }

    const user = userResult.rows[0];
    const fcmToken = user.fcm_token;
    
    console.log(`   User found: ${user.email || 'Unknown'}`);
    console.log(`   FCM Token: ${fcmToken ? `${fcmToken.substring(0, 20)}... (${fcmToken.length} chars)` : 'NULL'}`);

    if (!fcmToken || fcmToken.toString().trim().isEmpty) {
      console.error(`❌ No FCM token found for user ${userId} (${user.email || 'Unknown'})`);
      console.error(`   User needs to log in to register FCM token`);
      throw new Error(`No FCM token registered for user ${userId}`);
    }

    // Build emergency-specific critical notification
    const message = {
      notification: {
        title: '🚨 EMERGENCY ALERT',
        body: `${senderName} needs your help NOW!`,
      },
      data: {
        type: 'emergency',
        emergencyId,
        senderName,
        ...(location && {
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
        }),
      },
      token: fcmToken,
      android: {
        priority: 'high' as const,
        ttl: 0, // Deliver immediately, don't batch
        notification: {
          channelId: 'emergency_alerts',
          priority: 'max' as const,
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public' as const,
          tag: 'emergency', // Replace previous emergency notifications
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
          'apns-expiration': '0', // Deliver immediately
        },
        payload: {
          aps: {
            alert: {
              title: '🚨 EMERGENCY ALERT',
              body: `${senderName} needs your help NOW!`,
              'loc-key': 'EMERGENCY_ALERT',
            },
            sound: {
              critical: 1, // Critical alert - bypasses silent mode
              name: 'default',
              volume: 1.0, // Maximum volume
            },
            badge: 1,
            'content-available': 1,
            'mutable-content': 1,
            'interruption-level': 'critical', // iOS 15+ critical alert
          },
        },
      },
    };

    console.log(`   📤 Sending FCM message to token: ${fcmToken.substring(0, 20)}...`);
    const response = await admin.messaging().send(message);
    console.log(`   ✅ Emergency push notification sent successfully!`);
    console.log(`      Response: ${JSON.stringify(response)}`);
    return response;
  } catch (error: any) {
    console.error(`   ❌ ERROR sending emergency push notification:`);
    console.error(`      User ID: ${userId}`);
    console.error(`      Emergency ID: ${emergencyId}`);
    console.error(`      Error type: ${error?.constructor?.name || 'Unknown'}`);
    console.error(`      Error message: ${error?.message || error?.toString() || 'No message'}`);
    console.error(`      Error code: ${error?.code || 'N/A'}`);
    if (error?.stack) {
      console.error(`      Stack trace: ${error.stack}`);
    }
    
    // Check if it's a Firebase-specific error
    if (error?.code === 'messaging/invalid-registration-token' || 
        error?.code === 'messaging/registration-token-not-registered') {
      console.error(`   ⚠️ FCM token is invalid or expired - user needs to re-register`);
    }
    
    throw error;
  }
};

export const sendBroadcastNotification = async (
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  const promises = userIds.map((userId) =>
    sendPushNotification(userId, title, body, data).catch((error) => {
      console.error(`Failed to send to user ${userId}:`, error);
      return null;
    })
  );

  await Promise.all(promises);
};

export const updateFCMToken = async (userId: string, fcmToken: string): Promise<void> => {
  await query(
    'UPDATE users SET fcm_token = $1 WHERE id = $2',
    [fcmToken, userId]
  );
};

