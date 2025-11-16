import webpush from 'web-push';
import * as dotenv from 'dotenv';
import { query } from '../database/db';

dotenv.config();

// Set VAPID details
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@guardianconnect.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('✅ Web Push VAPID keys configured');
} else {
  console.warn('⚠️  VAPID keys not configured - web push notifications will be disabled');
}

// Store push subscription
export const savePushSubscription = async (
  userId: string,
  subscription: webpush.PushSubscription
): Promise<void> => {
  try {
    await query(
      'UPDATE users SET push_subscription = $1 WHERE id = $2',
      [JSON.stringify(subscription), userId]
    );
    console.log(`✅ Push subscription saved for user ${userId}`);
  } catch (error) {
    console.error('Error saving push subscription:', error);
    throw error;
  }
};

// Get push subscription
export const getPushSubscription = async (
  userId: string
): Promise<webpush.PushSubscription | null> => {
  try {
    const result = await query(
      'SELECT push_subscription FROM users WHERE id = $1 AND push_subscription IS NOT NULL',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return JSON.parse(result.rows[0].push_subscription);
  } catch (error) {
    console.error('Error getting push subscription:', error);
    return null;
  }
};

// Send web push notification
export const sendWebPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> => {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured, skipping web push notification');
    return;
  }

  try {
    const subscription = await getPushSubscription(userId);

    if (!subscription) {
      console.log(`No push subscription found for user ${userId}`);
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: data || {},
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      tag: `emergency-${data?.emergencyId || 'alert'}`,
    });

    await webpush.sendNotification(subscription, payload);
    console.log(`✅ Web push notification sent to user ${userId}`);
  } catch (error: any) {
    if (error.statusCode === 410) {
      // Subscription expired, remove it
      console.log(`Push subscription expired for user ${userId}, removing...`);
      await query('UPDATE users SET push_subscription = NULL WHERE id = $1', [userId]);
    } else {
      console.error('Error sending web push notification:', error);
    }
    throw error;
  }
};

// Send emergency alert via web push
export const sendEmergencyWebPush = async (
  userId: string,
  emergencyId: string,
  senderName: string
): Promise<void> => {
  return sendWebPushNotification(
    userId,
    '🚨 Emergency Alert',
    `${senderName} needs help!`,
    {
      type: 'emergency',
      emergencyId,
      senderName,
      url: `/emergency/${emergencyId}`
    }
  );
};

