-- Migration: Change latitude and longitude from DECIMAL to TEXT
-- This ensures zero precision loss - exact GPS coordinates stored as strings
-- Date: 2025-01-23
-- Purpose: Bulletproof location accuracy - store exact GPS coordinates without rounding

-- Step 1: Add new TEXT columns
ALTER TABLE emergency_locations 
ADD COLUMN IF NOT EXISTS latitude_text TEXT,
ADD COLUMN IF NOT EXISTS longitude_text TEXT;

-- Step 2: Copy existing DECIMAL values to TEXT columns (convert to string)
UPDATE emergency_locations 
SET latitude_text = latitude::TEXT,
    longitude_text = longitude::TEXT
WHERE latitude_text IS NULL OR longitude_text IS NULL;

-- Step 3: Drop old DECIMAL columns
ALTER TABLE emergency_locations 
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude;

-- Step 4: Rename TEXT columns to original names
ALTER TABLE emergency_locations 
RENAME COLUMN latitude_text TO latitude;

ALTER TABLE emergency_locations 
RENAME COLUMN longitude_text TO longitude;

-- Step 5: Add NOT NULL constraint
ALTER TABLE emergency_locations 
ALTER COLUMN latitude SET NOT NULL,
ALTER COLUMN longitude SET NOT NULL;

