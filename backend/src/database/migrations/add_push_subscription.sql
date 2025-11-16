-- Add push_subscription column to users table for Web Push API
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription TEXT;

