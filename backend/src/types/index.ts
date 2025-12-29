// Local type definitions for backend

export interface Emergency {
  id: string;
  user_id: string;
  status: 'active' | 'ended' | 'cancelled' | 'escalated';
  created_at: Date;
  ended_at?: Date;
  escalated_at?: Date;
  escalation_reason?: string;
}

export interface EmergencyParticipant {
  id: string;
  emergency_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  joined_at?: Date;
  created_at: Date;
}

export interface User {
  id: string;
  email: string;
  display_name?: string;
  password_hash: string;
  verified: boolean;
  fcm_token?: string;
  push_subscription?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EmergencyLocation {
  id: string;
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
  audio_url?: string;
  video_url?: string;
  created_at: Date;
}
