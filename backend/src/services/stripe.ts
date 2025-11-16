import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Stripe with secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('⚠️  STRIPE_SECRET_KEY not configured - payment functionality will be disabled');
}

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia', // Use latest API version
    })
  : null;

// Create a payment intent for a donation
export const createDonationPaymentIntent = async (
  amount: number, // Amount in cents
  currency: string = 'usd',
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> => {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true, // Enable all payment methods (cards, wallets, etc.)
      },
      metadata: metadata || {},
    });

    return paymentIntent;
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
};

// Retrieve a payment intent
export const getPaymentIntent = async (
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error: any) {
    console.error('Error retrieving payment intent:', error);
    throw new Error(`Failed to retrieve payment intent: ${error.message}`);
  }
};

// Confirm a payment intent (for server-side confirmation if needed)
export const confirmPaymentIntent = async (
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<Stripe.PaymentIntent> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const params: Stripe.PaymentIntentConfirmParams = {};
    if (paymentMethodId) {
      params.payment_method = paymentMethodId;
    }

    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, params);
    return paymentIntent;
  } catch (error: any) {
    console.error('Error confirming payment intent:', error);
    throw new Error(`Failed to confirm payment intent: ${error.message}`);
  }
};

// Create or retrieve a customer
export const getOrCreateCustomer = async (
  email: string,
  name?: string
): Promise<Stripe.Customer> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Search for existing customer by email
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
    });

    return customer;
  } catch (error: any) {
    console.error('Error getting/creating customer:', error);
    throw new Error(`Failed to get or create customer: ${error.message}`);
  }
};

// Create a subscription
export const createSubscription = async (
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: metadata || {},
    });

    return subscription;
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    throw new Error(`Failed to create subscription: ${error.message}`);
  }
};

// Retrieve a subscription
export const getSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error: any) {
    console.error('Error retrieving subscription:', error);
    throw new Error(`Failed to retrieve subscription: ${error.message}`);
  }
};

// Cancel a subscription
export const cancelSubscription = async (
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    if (cancelAtPeriodEnd) {
      // Cancel at period end (user keeps access until period ends)
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return subscription;
    } else {
      // Cancel immediately
      const subscription = await stripe.subscriptions.cancel(subscriptionId);
      return subscription;
    }
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

// Update subscription (change plan)
export const updateSubscription = async (
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations', // Prorate the difference
    });

    return updatedSubscription;
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
};

// Resume a canceled subscription
export const resumeSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    return subscription;
  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    throw new Error(`Failed to resume subscription: ${error.message}`);
  }
};

// List all available prices/products (for subscription plans)
export const getAvailablePlans = async (): Promise<Stripe.Price[]> => {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const prices = await stripe.prices.list({
      active: true,
      type: 'recurring', // Only recurring subscriptions
      expand: ['data.product'],
    });

    return prices.data;
  } catch (error: any) {
    console.error('Error fetching available plans:', error);
    throw new Error(`Failed to fetch available plans: ${error.message}`);
  }
};

