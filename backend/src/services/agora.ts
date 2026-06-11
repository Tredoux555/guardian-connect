// Agora video-call configuration for emergency rooms.
//
// Same pattern as Montree: AGORA_APP_ID from env. Two modes:
//  - App ID only (Agora project with certificate DISABLED): token = null,
//    clients join with the App ID alone. Easiest to set up.
//  - Secured (AGORA_APP_CERTIFICATE set): we mint a short-lived RTC token.
//
// The channel name is derived from the emergency id, and access to the
// endpoint is already gated by emergency participation, so only invited
// responders can obtain the room credentials.

let RtcTokenBuilder: any = null;
let RtcRole: any = null;
try {
  // Optional dependency — only needed in secured mode.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const agoraToken = require('agora-token');
  RtcTokenBuilder = agoraToken.RtcTokenBuilder;
  RtcRole = agoraToken.RtcRole;
} catch {
  // not installed — App ID-only mode still works
}

export interface VideoCredentials {
  appId: string;
  channel: string;
  token: string | null;
  /** seconds the token is valid for (0 = no token) */
  expiresIn: number;
}

export function isVideoConfigured(): boolean {
  return !!process.env.AGORA_APP_ID;
}

export function getVideoCredentials(emergencyId: string): VideoCredentials | null {
  const appId = process.env.AGORA_APP_ID;
  if (!appId) return null;

  const channel = `emergency_${emergencyId}`;
  const certificate = process.env.AGORA_APP_CERTIFICATE;

  if (certificate && RtcTokenBuilder) {
    const expiresIn = 60 * 60 * 2; // 2 hours — longer than any sane emergency call setup
    const now = Math.floor(Date.now() / 1000);
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      certificate,
      channel,
      0, // uid 0 = any uid may join with this token
      RtcRole.PUBLISHER,
      now + expiresIn,
      now + expiresIn
    );
    return { appId, channel, token, expiresIn };
  }

  if (certificate && !RtcTokenBuilder) {
    console.error('⚠️ AGORA_APP_CERTIFICATE is set but the "agora-token" package is not installed — falling back to App ID-only join, which will FAIL on a secured project. Run: npm install agora-token');
  }

  return { appId, channel, token: null, expiresIn: 0 };
}
