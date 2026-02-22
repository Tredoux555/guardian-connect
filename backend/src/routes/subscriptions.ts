import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import Stripe from 'stripe';
import { AuthRequest, authenticate } from '../middleware/auth';
import { checkFeatureFlag } from '../middleware/featureFlags';
import { 
  createSubscription,
  getSubscription,
  cancelSubscription,
  updateSubscription,
  resumeSubscription,
  getOrCreateCustomer,
  getAvailablePlans
} from '../services/stripe';
import { query } from '../database/db';

const router = express.Router();

// Apply feature flag to all subscription routes (except /plans which can be public)
router.use((req, res, next) => {
  // Allow /plans to be accessed even if feature is disabled (for preview)
  if (req.path === '/plans') {
    return next();
  }
  return checkFeatureFlag('subscriptions')(req, res, next);
});

// Get available subscription plans
router.get(
  '/plans',
  async (req: AuthRequest, res: Response) => {
    try {
      // First check database for plans
      const dbPlans = await query(
        `SELECT * FROM subscription_plans WHERE is_active = true ORDER BY amount ASC`
      );

      if (dbPlans.rows.length > 0) {
        return res.json({ plans: dbPlans.rows });
      }

      // Fallback to Stripe if no plans in database
      try {
        const stripePlans = await getAvailablePlans();
        const formattedPlans = stripePlans.map(price => ({
          id: price.id,
          name: (price.product as any)?.name || 'Subscription Plan',
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval, // 'month' or 'year'
          interval_count: price.recurring?.interval_count || 1,
        }));

        return res.json({ plans: formattedPlans });
      } catch (stripeError) {
        console.error('Error fetching plans from Stripe:', stripeError);
        return res.json({ plans: [] });
      }
    } catch (error: any) {
      console.error('Error fetching subscription plans:', error);
      res.status(500).json({ 
        error: 'Failed to fetch subscription plans',
        message: error.message 
      });
    }
  }
);

// Create a new subscription
router.post(
  '/create',
  authenticate,
  [
    body('priceId').isString().notEmpty().withMessage('Price ID is required'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.userId!;
      const { priceId } = req.body;

      // Get user email for customer creation
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      const userEmail = userResult.rows[0]?.email;

      if (!userEmail) {
        return res.status(400).json({ error: 'User email not found' });
      }

      // Create or get Stripe customer
      const customer = await getOrCreateCustomer(userEmail);

      // Create subscription
      const subscription = await createSubscription(
        customer.id,
        priceId,
        {
          userId: userId,
        }
      );

      // Get price details to determine plan type
      const price = (subscription.items.data[0].price);
      const planType = price.recurring?.interval === 'year' ? 'annual' : 'monthly';

      // Save subscription to database
      await query(
        `INSERT INTO subscriptions (
          user_id, stripe_subscription_id, stripe_customer_id, stripe_price_id,
          status, plan_type, amount, currency,
          current_period_start, current_period_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (stripe_subscription_id) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          subscription.id,
          customer.id,
          priceId,
          subscription.status,
          planType,
          price.unit_amount || 0,
          price.currency.toUpperCase(),
          new Date(subscription.current_period_start * 1000),
          new Date(subscription.current_period_end * 1000),
        ]
      );

      // Get client secret from latest invoice
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;
      const clientSecret = paymentIntent?.client_secret;

      res.json({
        subscriptionId: subscription.id,
        clientSecret: clientSecret,
        status: subscription.status,
      });
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ 
        error: 'Failed to create subscription',
        message: error.message 
      });
    }
  }
);

// Get current user's subscription
router.get(
  '/current',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const result = await query(
        `SELECT * FROM subscriptions 
         WHERE user_id = $1 
         AND status IN ('active', 'trialing', 'past_due')
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.json({ subscription: null });
      }

      const subscription = result.rows[0];

      // Optionally sync with Stripe for latest status
      try {
        const stripeSubscription = await getSubscription(subscription.stripe_subscription_id);
        
        // Update database with latest status
        await query(
          `UPDATE subscriptions 
           SET status = $1, 
               current_period_start = $2,
               current_period_end = $3,
               cancel_at_period_end = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE stripe_subscription_id = $5`,
          [
            stripeSubscription.status,
            new Date(stripeSubscription.current_period_start * 1000),
            new Date(stripeSubscription.current_period_end * 1000),
            stripeSubscription.cancel_at_period_end,
            subscription.stripe_subscription_id,
          ]
        );

        subscription.status = stripeSubscription.status;
        subscription.current_period_start = new Date(stripeSubscription.current_period_start * 1000);
        subscription.current_period_end = new Date(stripeSubscription.current_period_end * 1000);
        subscription.cancel_at_period_end = stripeSubscription.cancel_at_period_end;
      } catch (stripeError) {
        console.error('Error syncing with Stripe:', stripeError);
        // Continue with database data
      }

      res.json({ subscription });
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ 
        error: 'Failed to fetch subscription',
        message: error.message 
      });
    }
  }
);

// Cancel subscription
router.post(
  '/cancel',
  authenticate,
  [
    body('subscriptionId').isString().notEmpty(),
    body('cancelAtPeriodEnd').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.userId!;
      const { subscriptionId, cancelAtPeriodEnd = true } = req.body;

      // Verify subscription belongs to user
      const subResult = await query(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );

      if (subResult.rows.length === 0) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      // Cancel subscription in Stripe
      const subscription = await cancelSubscription(subscriptionId, cancelAtPeriodEnd);

      // Update database
      await query(
        `UPDATE subscriptions 
         SET status = $1, 
             cancel_at_period_end = $2,
             canceled_at = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $4`,
        [
          subscription.status,
          subscription.cancel_at_period_end,
          subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          subscriptionId,
        ]
      );

      res.json({
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({ 
        error: 'Failed to cancel subscription',
        message: error.message 
      });
    }
  }
);

// Resume subscription
router.post(
  '/resume',
  authenticate,
  [
    body('subscriptionId').isString().notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.userId!;
      const { subscriptionId } = req.body;

      // Verify subscription belongs to user
      const subResult = await query(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );

      if (subResult.rows.length === 0) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      // Resume subscription in Stripe
      const subscription = await resumeSubscription(subscriptionId);

      // Update database
      await query(
        `UPDATE subscriptions 
         SET status = $1, 
             cancel_at_period_end = $2,
             canceled_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $3`,
        [
          subscription.status,
          subscription.cancel_at_period_end,
          subscriptionId,
        ]
      );

      res.json({
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      res.status(500).json({ 
        error: 'Failed to resume subscription',
        message: error.message 
      });
    }
  }
);

// Update subscription (change plan)
router.post(
  '/update',
  authenticate,
  [
    body('subscriptionId').isString().notEmpty(),
    body('newPriceId').isString().notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.userId!;
      const { subscriptionId, newPriceId } = req.body;

      // Verify subscription belongs to user
      const subResult = await query(
        'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 AND user_id = $2',
        [subscriptionId, userId]
      );

      if (subResult.rows.length === 0) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      // Update subscription in Stripe
      const subscription = await updateSubscription(subscriptionId, newPriceId);

      // Get updated price details
      const price = subscription.items.data[0].price;
      const planType = price.recurring?.interval === 'year' ? 'annual' : 'monthly';

      // Update database
      await query(
        `UPDATE subscriptions 
         SET stripe_price_id = $1,
             plan_type = $2,
             amount = $3,
             current_period_start = $4,
             current_period_end = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $6`,
        [
          newPriceId,
          planType,
          price.unit_amount || 0,
          new Date(subscription.current_period_start * 1000),
          new Date(subscription.current_period_end * 1000),
          subscriptionId,
        ]
      );

      res.json({
        status: subscription.status,
        subscriptionId: subscription.id,
      });
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      res.status(500).json({ 
        error: 'Failed to update subscription',
        message: error.message 
      });
    }
  }
);

// Get subscription history
router.get(
  '/history',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const result = await query(
        `SELECT * FROM subscriptions 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({ subscriptions: result.rows });
    } catch (error: any) {
      console.error('Error fetching subscription history:', error);
      res.status(500).json({ 
        error: 'Failed to fetch subscription history',
        message: error.message 
      });
    }
  }
);

export default router;

