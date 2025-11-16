import express, { Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { savePushSubscription } from '../services/webPush';

const router = express.Router();

// Subscribe to push notifications
router.post(
  '/subscribe',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const subscription = req.body;

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
      }

      await savePushSubscription(userId, subscription);
      res.json({ success: true, message: 'Push subscription saved' });
    } catch (error) {
      console.error('Subscription error:', error);
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  }
);

// Get VAPID public key (for frontend to subscribe)
router.get(
  '/vapid-public-key',
  authenticate,
  (req: AuthRequest, res: Response) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return res.status(500).json({ error: 'VAPID public key not configured' });
    }
    res.json({ publicKey });
  }
);

export default router;

