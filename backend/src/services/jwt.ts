import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/db';
import { JWTPayload } from '../types';
import * as dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export const generateTokens = (payload: JWTPayload) => {
  const accessToken = jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRY,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

export const createSession = async (userId: string, token: string): Promise<void> => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days for refresh token

  await query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
};

export const deleteSession = async (token: string): Promise<void> => {
  await query('DELETE FROM sessions WHERE token = $1', [token]);
};

export const deleteAllUserSessions = async (userId: string): Promise<void> => {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
};


