import { Emergency } from '../models/Emergency';

export interface EmergencyAccess {
  emergency: any | null;
  isOwner: boolean;
  participant: any | null;
  /** Owner OR invited participant (any status) */
  canView: boolean;
  /** Owner OR participant who has accepted */
  canParticipate: boolean;
}

/**
 * Pure authorization decision — kept free of I/O so it is unit-testable.
 */
export function evaluateEmergencyAccess(
  emergency: { user_id: string } | null,
  participants: Array<{ user_id: string; status: string }>,
  userId: string
): EmergencyAccess {
  if (!emergency) {
    return { emergency: null, isOwner: false, participant: null, canView: false, canParticipate: false };
  }
  const isOwner = String(emergency.user_id) === String(userId);
  const participant = participants.find((p) => String(p.user_id) === String(userId)) || null;
  return {
    emergency,
    isOwner,
    participant,
    canView: isOwner || participant !== null,
    canParticipate: isOwner || (participant !== null && participant.status === 'accepted'),
  };
}

/**
 * Loads an emergency + participants and evaluates the caller's access.
 */
export async function getEmergencyAccess(emergencyId: string, userId: string): Promise<EmergencyAccess> {
  const emergency = await Emergency.findById(emergencyId);
  if (!emergency) {
    return evaluateEmergencyAccess(null, [], userId);
  }
  const participants = await Emergency.getParticipants(emergencyId);
  return evaluateEmergencyAccess(emergency, participants, userId);
}
