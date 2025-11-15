-- Migration: Add audio_url column to emergency_messages table
-- Run this if the column doesn't exist yet

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'emergency_messages' 
        AND column_name = 'audio_url'
    ) THEN
        ALTER TABLE emergency_messages ADD COLUMN audio_url VARCHAR(500);
    END IF;
END $$;





