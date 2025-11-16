-- Add display_name column to users table
-- This allows users to set a display name that appears in emergency alerts instead of email

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);

