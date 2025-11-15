import * as dotenv from 'dotenv';
import { query } from './db';

dotenv.config();

async function runMigration() {
  try {
    console.log('Checking if video_url column exists...');
    
    // Check if column exists
    const checkResult = await query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'emergency_messages' 
       AND column_name = 'video_url'`
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ video_url column already exists. No migration needed.');
      process.exit(0);
    }

    console.log('Adding video_url column to emergency_messages table...');
    
    // Add the column
    await query(
      `ALTER TABLE emergency_messages ADD COLUMN video_url VARCHAR(500)`
    );

    console.log('✅ Migration completed successfully! video_url column added.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();





