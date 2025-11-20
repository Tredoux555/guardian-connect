import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Support Railway's PostgreSQL connection
// Priority: DATABASE_URL > Individual variables (PGHOST, etc.)
let pool: Pool;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided (Railway provides this)
  console.log('📊 Using DATABASE_URL for database connection');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  // Fall back to individual connection variables
  const host = process.env.PGHOST || process.env.DB_HOST;
  const port = parseInt(process.env.PGPORT || process.env.DB_PORT || '5432');
  const database = process.env.PGDATABASE || process.env.DB_NAME || 'guardian_connect';
  const user = process.env.PGUSER || process.env.DB_USER || 'user';
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD || 'password';

  // Log connection details (without password)
  console.log('📊 Database connection config:', {
    host: host || 'localhost (WARNING: not set!)',
    port: port,
    database: database,
    user: user,
    hasPassword: !!password,
    hasHost: !!host,
  });

  // Warn if host is not set or is localhost in production
  if (!host || host === 'localhost') {
    console.error('❌ ERROR: Database host not configured properly!');
    console.error('❌ Current host:', host || 'NOT SET');
    console.error('❌ Set PGHOST or DATABASE_URL in Railway backend service variables');
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ This will cause connection failures in production!');
    }
  }

  pool = new Pool({
    host: host || 'localhost',
    port: port,
    database: database,
    user: user,
    password: password,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err: Error) => {
  console.error('❌ Database connection error:', err);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  return client;
};

export const transaction = async (callback: (client: PoolClient) => Promise<any>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;


