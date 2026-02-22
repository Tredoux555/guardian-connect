import * as dotenv from 'dotenv';
import { query } from './db';

dotenv.config();

async function runMigration() {
  try {
    console.log('Checking if audio_url column exists...');
    
    // Check if column exists
    const checkResult = await query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'emergency_messages' 
       AND column_name = 'audio_url'`
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ audio_url column already exists. No migration needed.');
      process.exit(0);
    }

    console.log('Adding audio_url column to emergency_messages table...');
    
    // Add the column
    await query(
      `ALTER TABLE emergency_messages ADD COLUMN audio_url VARCHAR(500)`
    );

    console.log('✅ Migration completed successfully! audio_url column added.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();





