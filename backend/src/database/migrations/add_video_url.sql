-- Migration: Add video_url column to emergency_messages table
-- Run this if the column doesn't exist yet

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'emergency_messages' 
        AND column_name = 'video_url'
    ) THEN
        ALTER TABLE emergency_messages ADD COLUMN video_url VARCHAR(500);
    END IF;
END $$;





