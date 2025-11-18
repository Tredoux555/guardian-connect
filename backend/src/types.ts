// Shared TypeScript types for backend and admin panel

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  verified: boolean;
  created_at: Date;
  updated_at?: Date;
}

export interface Emergency {
  id: string;
  user_id: string;
  status: 'active' | 'ended' | 'cancelled';
  created_at: Date;
  ended_at?: Date;
}

export interface EmergencyParticipant {
  emergency_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  joined_at?: Date;
}

export interface EmergencyLocation {
  emergency_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

export interface EmergencyMessage {
  id: string;
  emergency_id: string;
  user_id: string;
  message?: string;
  image_url?: string;
  created_at: Date;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  contact_user_id?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_name: string;
  status: 'active' | 'pending';
  created_at: Date;
}

export interface Session {
  user_id: string;
  token: string;
  expires_at: Date;
}

export interface Admin {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role?: 'user' | 'admin';
}






