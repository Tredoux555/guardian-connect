import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthRequest, authenticate } from '../middleware/auth';
import { checkFeatureFlag } from '../middleware/featureFlags';
import { 
  createDonationPaymentIntent, 
  getPaymentIntent,
  getOrCreateCustomer 
} from '../services/stripe';
import { query } from '../database/db';

const router = express.Router();

// Apply feature flag to all donation routes
router.use(checkFeatureFlag('donations'));

// Create a payment intent for donation
router.post(
  '/create-intent',
  authenticate,
  [
    body('amount').isInt({ min: 50 }).withMessage('Amount must be at least $0.50 (50 cents)'),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('name').optional().isString().trim(),
    body('message').optional().isString().trim().isLength({ max: 500 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.userId!;
      const { amount, currency = 'usd', name, message } = req.body;

      // Get user email for customer creation
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      const userEmail = userResult.rows[0]?.email;

      // Create or get Stripe customer
      let customer;
      if (userEmail) {
        try {
          customer = await getOrCreateCustomer(userEmail, name);
        } catch (error) {
          console.error('Error creating customer:', error);
          // Continue without customer if it fails
        }
      }

      // Create payment intent
      const paymentIntent = await createDonationPaymentIntent(
        amount,
        currency,
        {
          userId: userId,
          name: name || '',
          message: message || '',
        }
      );

      // Save donation record (pending status)
      await query(
        `INSERT INTO donations (
          user_id, amount, currency, stripe_payment_intent_id, 
          stripe_customer_id, status, email, name, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          amount,
          currency.toUpperCase(),
          paymentIntent.id,
          customer?.id || null,
          'pending',
          userEmail || null,
          name || null,
          message || null,
        ]
      );

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      console.error('Error creating donation intent:', error);
      res.status(500).json({ 
        error: 'Failed to create payment intent',
        message: error.message 
      });
    }
  }
);

// Confirm payment (webhook will also handle this, but this is for immediate confirmation)
router.post(
  '/confirm',
  authenticate,
  [
    body('paymentIntentId').isString().notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { paymentIntentId } = req.body;

      // Retrieve payment intent from Stripe
      const paymentIntent = await getPaymentIntent(paymentIntentId);

      // Update donation status in database
      await query(
        `UPDATE donations 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE stripe_payment_intent_id = $2`,
        [paymentIntent.status, paymentIntentId]
      );

      res.json({
        status: paymentIntent.status,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      res.status(500).json({ 
        error: 'Failed to confirm payment',
        message: error.message 
      });
    }
  }
);

// Get donation history for current user
router.get(
  '/history',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const result = await query(
        `SELECT 
          id, amount, currency, status, name, message, 
          created_at, updated_at
         FROM donations 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [userId]
      );

      res.json({ donations: result.rows });
    } catch (error: any) {
      console.error('Error fetching donation history:', error);
      res.status(500).json({ 
        error: 'Failed to fetch donation history',
        message: error.message 
      });
    }
  }
);

// Get total donations (public endpoint, no auth required)
router.get(
  '/total',
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT 
          SUM(amount) as total_amount,
          currency,
          COUNT(*) as donation_count
         FROM donations 
         WHERE status = 'succeeded'
         GROUP BY currency`
      );

      res.json({ totals: result.rows });
    } catch (error: any) {
      console.error('Error fetching donation totals:', error);
      res.status(500).json({ 
        error: 'Failed to fetch donation totals',
        message: error.message 
      });
    }
  }
);

export default router;

