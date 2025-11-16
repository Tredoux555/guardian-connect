# Donation Platform Setup Guide - Step by Step

## Overview
We'll use **Stripe** for international payments. Stripe supports:
- Credit/Debit cards (Visa, Mastercard, Amex, etc.)
- Digital wallets (Apple Pay, Google Pay)
- Bank transfers (in supported countries)
- 135+ currencies worldwide

## Step 1: Create Stripe Account

### 1.1 Sign Up
1. Go to https://stripe.com
2. Click "Start now" or "Sign up"
3. Enter your email and create a password
4. Verify your email address

### 1.2 Complete Business Information
1. **Business type**: Select "Non-profit" or "Individual" (depending on your setup)
2. **Business name**: Guardian Connect (or your organization name)
3. **Country**: Select your country
4. **Business address**: Enter your address
5. **Phone number**: Enter contact number

### 1.3 Verify Identity (Required for receiving payments)
- You'll need to provide:
  - Government-issued ID
  - Bank account details (for payouts)
  - Tax information (if applicable)

**Note**: You can start testing immediately, but you'll need to complete verification to receive real payments.

## Step 2: Get Your API Keys

### 2.1 Access Dashboard
1. Log in to https://dashboard.stripe.com
2. You'll see "Test mode" toggle in the top right

### 2.2 Get Test Keys (For Development)
1. Make sure "Test mode" is ON (toggle in top right)
2. Click "Developers" → "API keys" in the left sidebar
3. You'll see:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`) - Click "Reveal test key"

### 2.3 Get Live Keys (For Production)
1. Toggle "Test mode" to OFF
2. Click "Developers" → "API keys"
3. Get your live keys:
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** (starts with `sk_live_...`)

**⚠️ IMPORTANT**: 
- Never commit secret keys to git
- Use environment variables
- Test keys are safe to use in development
- Live keys should only be used in production

## Step 3: Add Keys to Your Project

### 3.1 Backend Environment Variables
Add to `backend/.env`:
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here

# For production, use:
# STRIPE_SECRET_KEY=sk_live_your_live_secret_key_here
# STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key_here
```

### 3.2 Frontend Environment Variables
Add to `web-user/.env`:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here
```

**Note**: Only publishable key goes in frontend (it's safe to expose)

## Step 4: Database Setup

We'll create a `donations` table to track donations:

```sql
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL, -- Amount in cents (e.g., 1000 = $10.00)
    currency VARCHAR(3) DEFAULT 'USD',
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(50) NOT NULL, -- 'pending', 'succeeded', 'failed', 'canceled'
    email VARCHAR(255),
    name VARCHAR(255),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_donations_user_id ON donations(user_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_created_at ON donations(created_at);
```

## Step 5: Install Frontend Stripe Package

```bash
cd web-user
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## Step 6: Implementation Overview

### Backend:
1. Create payment intent (secure way to collect payment)
2. Confirm payment
3. Webhook handler (for payment status updates)

### Frontend:
1. Donation form component
2. Stripe Elements (secure card input)
3. Payment processing

## Step 7: Testing

### Test Cards (Stripe Test Mode)
Use these in test mode:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires 3D Secure**: `4000 0025 0000 3155`

Any future expiry date, any 3-digit CVC, any ZIP code.

## Step 8: Go Live Checklist

Before accepting real payments:
- [ ] Complete Stripe account verification
- [ ] Add bank account for payouts
- [ ] Switch to live API keys
- [ ] Test with small amount first
- [ ] Set up webhook endpoint (for production)
- [ ] Review Stripe's security best practices

## Next Steps

After completing setup, we'll implement:
1. Backend payment routes
2. Frontend donation form
3. Payment confirmation
4. Donation history
5. Thank you page

---

**Ready to start?** Let me know when you've completed Steps 1-3 (Stripe account + API keys), and I'll implement the code!

