import { query, transaction } from '../database/db';
import { Emergency as EmergencyType, EmergencyParticipant } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class Emergency {
  static async create(userId: string): Promise<EmergencyType> {
    const result = await query(
      `INSERT INTO emergencies (user_id, status) 
       VALUES ($1, 'active') 
       RETURNING id, user_id, status, created_at, ended_at`,
      [userId]
    );
    return result.rows[0];
  }

  static async findById(id: string): Promise<EmergencyType | null> {
    const result = await query(
      'SELECT id, user_id, status, created_at, ended_at FROM emergencies WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findActiveByUserId(userId: string): Promise<EmergencyType | null> {
    const result = await query(
      "SELECT id, user_id, status, created_at, ended_at FROM emergencies WHERE user_id = $1 AND status = 'active'",
      [userId]
    );
    return result.rows[0] || null;
  }

  static async end(id: string, userId: string): Promise<void> {
    await query(
      "UPDATE emergencies SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
  }

  static async cancel(id: string, userId: string): Promise<void> {
    await query(
      "UPDATE emergencies SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
  }

  static async addParticipant(
    emergencyId: string,
    userId: string
  ): Promise<EmergencyParticipant> {
    const result = await query(
      `INSERT INTO emergency_participants (emergency_id, user_id, status) 
       VALUES ($1, $2, 'pending') 
       ON CONFLICT (emergency_id, user_id) DO NOTHING
       RETURNING id, emergency_id, user_id, status, joined_at, created_at`,
      [emergencyId, userId]
    );
    
    if (result.rows.length === 0) {
      // Participant already exists, fetch it
      const existing = await query(
        'SELECT id, emergency_id, user_id, status, joined_at, created_at FROM emergency_participants WHERE emergency_id = $1 AND user_id = $2',
        [emergencyId, userId]
      );
      return existing.rows[0];
    }
    
    return result.rows[0];
  }

  static async updateParticipantStatus(
    emergencyId: string,
    userId: string,
    status: 'accepted' | 'rejected'
  ): Promise<void> {
    const joinedAt = status === 'accepted' ? new Date() : null;
    await query(
      `UPDATE emergency_participants 
       SET status = $1, joined_at = $2 
       WHERE emergency_id = $3 AND user_id = $4`,
      [status, joinedAt, emergencyId, userId]
    );
  }

  static async getParticipants(emergencyId: string): Promise<any[]> {
    const result = await query(
      `SELECT ep.id, ep.emergency_id, ep.user_id, ep.status, ep.joined_at, ep.created_at,
              u.email as user_email,
              COALESCE(u.display_name, u.email) as user_display_name
       FROM emergency_participants ep
       LEFT JOIN users u ON ep.user_id = u.id
       WHERE ep.emergency_id = $1
       ORDER BY ep.created_at`,
      [emergencyId]
    );
    return result.rows;
  }

  static async addLocation(
    emergencyId: string,
    userId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    await query(
      `INSERT INTO emergency_locations (emergency_id, user_id, latitude, longitude) 
       VALUES ($1, $2, $3, $4)`,
      [emergencyId, userId, latitude, longitude]
    );
  }

  static async getLatestLocations(emergencyId: string): Promise<any[]> {
    const result = await query(
      `SELECT DISTINCT ON (el.user_id) 
       el.id, el.emergency_id, el.user_id, el.latitude, el.longitude, el.timestamp,
       u.email as user_email,
       COALESCE(u.display_name, u.email) as user_display_name
       FROM emergency_locations el
       LEFT JOIN users u ON el.user_id = u.id
       WHERE el.emergency_id = $1
       ORDER BY el.user_id, el.timestamp DESC`,
      [emergencyId]
    );
    return result.rows;
  }
}

