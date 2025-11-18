import { query } from '../database/db';
import { User as UserType } from '../shared/types';
import bcrypt from 'bcrypt';

export class User {
  static async create(email: string, password: string, display_name?: string): Promise<UserType> {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, display_name, verified) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, display_name, verified, created_at`,
      [email, passwordHash, display_name || null, false]
    );
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<UserType | null> {
    const result = await query(
      'SELECT id, email, password_hash, display_name, verified, created_at FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<UserType | null> {
    const result = await query(
      'SELECT id, email, display_name, verified, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async verifyEmail(userId: string): Promise<void> {
    await query(
      'UPDATE users SET verified = true WHERE id = $1',
      [userId]
    );
  }

  static async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async updateDisplayName(userId: string, displayName: string): Promise<void> {
    await query(
      'UPDATE users SET display_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [displayName, userId]
    );
  }
}






