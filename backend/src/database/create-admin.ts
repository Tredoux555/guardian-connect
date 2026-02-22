import { query } from './db';
import bcrypt from 'bcrypt';

async function createAdmin() {
  try {
    console.log('🔐 Creating admin user...');
    
    const email = 'admin@guardian.com';
    const password = 'admin123';
    
    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('🔒 Password hash generated');
    
    // Check if admin already exists
    const existing = await query(
      'SELECT id FROM admins WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      console.log('⚠️  Admin user already exists!');
      console.log('✅ You can use these credentials to login:');
      console.log('   Email:', email);
      console.log('   Password:', password);
      process.exit(0);
    }
    
    // Insert admin user
    await query(
      'INSERT INTO admins (email, password_hash) VALUES ($1, $2)',
      [email, passwordHash]
    );
    
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('');
    console.log('🚀 You can now login at: https://admin-production-d0f8.up.railway.app/login');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.code === '42P01') {
      console.error('💡 The admins table does not exist. Run "npm run setup-db" first!');
    }
    process.exit(1);
  }
}

createAdmin();

