-- Create donations table for tracking donations
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL, -- Amount in cents (e.g., 1000 = $10.00)
    currency VARCHAR(3) DEFAULT 'USD',
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'succeeded', 'failed', 'canceled'
    email VARCHAR(255),
    name VARCHAR(255),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at);
CREATE INDEX IF NOT EXISTS idx_donations_stripe_payment_intent_id ON donations(stripe_payment_intent_id);

-- Add comment for documentation
COMMENT ON TABLE donations IS 'Stores donation records with Stripe payment information';
COMMENT ON COLUMN donations.amount IS 'Amount in smallest currency unit (cents for USD)';
COMMENT ON COLUMN donations.stripe_payment_intent_id IS 'Stripe PaymentIntent ID for tracking payment';

