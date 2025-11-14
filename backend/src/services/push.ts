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
      },
      apns: {
        headers: {
          'apns-priority': '10',
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
  const title = 'Emergency Alert';
  const body = `${senderName} needs help!`;
  const data = {
    type: 'emergency',
    emergencyId,
    senderName,
    ...(location && {
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
    }),
  };

  return sendPushNotification(userId, title, body, data);
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

