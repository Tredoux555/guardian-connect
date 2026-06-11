import { sendEmergencyAlert } from './push';
import { sendEmergencyWebPush } from './webPush';
import { emitToUser } from './socket';

/**
 * Emergency notification fan-out with delivery tracking + retries.
 *
 * Design goals (see audit P0 #4):
 *  - NEVER silently swallow a failure: every recipient gets an explicit
 *    delivered/failed status that is returned to the API caller.
 *  - Retry transient failures in the background with backoff.
 *  - The socket channel is best-effort extra; "delivered" means at least one
 *    PUSH channel (FCM or Web Push) succeeded, since sockets only reach
 *    users with the app currently open.
 */

export interface RecipientDelivery {
  userId: string;
  name: string | null;
  fcm: 'sent' | 'failed' | 'no_token';
  webPush: 'sent' | 'failed' | 'no_subscription';
  socket: 'sent' | 'failed';
  delivered: boolean;
}

const RETRY_DELAYS_MS = [5_000, 30_000, 120_000];

interface EmergencyContext {
  emergencyId: string;
  senderName: string;
  senderEmail: string | null;
  senderUserId: string;
}

function isMissingTargetError(err: any): boolean {
  const msg = String(err?.message || '');
  return msg.includes('No FCM token') || msg.includes('No push subscription');
}

async function attemptFcm(userId: string, ctx: EmergencyContext, hasToken: boolean): Promise<'sent' | 'failed' | 'no_token'> {
  if (!hasToken) return 'no_token';
  try {
    await sendEmergencyAlert(userId, ctx.emergencyId, ctx.senderName, undefined);
    return 'sent';
  } catch (err) {
    return isMissingTargetError(err) ? 'no_token' : 'failed';
  }
}

async function attemptWebPush(userId: string, ctx: EmergencyContext): Promise<'sent' | 'failed' | 'no_subscription'> {
  try {
    await sendEmergencyWebPush(userId, ctx.emergencyId, ctx.senderName);
    return 'sent';
  } catch (err: any) {
    // webPush.sendEmergencyWebPush resolves silently when there is no
    // subscription; an exception here is a real failure unless it's a 410
    // (expired subscription, already cleaned up by the service).
    if (err?.statusCode === 410) return 'no_subscription';
    return 'failed';
  }
}

function attemptSocket(userId: string, ctx: EmergencyContext, participantsCount: number): 'sent' | 'failed' {
  try {
    emitToUser(userId, 'emergency_created', {
      emergencyId: ctx.emergencyId,
      userId: ctx.senderUserId,
      userEmail: ctx.senderEmail,
      senderName: ctx.senderName,
      participants: participantsCount,
    });
    return 'sent';
  } catch {
    return 'failed';
  }
}

/**
 * Background retry for recipients whose push channels failed transiently.
 * In-process setTimeout based — good enough for MVP; a durable queue
 * (BullMQ/pg-boss) is the production-grade follow-up.
 */
function scheduleRetry(
  userId: string,
  ctx: EmergencyContext,
  hasToken: boolean,
  attempt: number
): void {
  if (attempt >= RETRY_DELAYS_MS.length) {
    console.error(
      `🔴 NOTIFICATION PERMANENTLY FAILED after ${RETRY_DELAYS_MS.length} retries — ` +
      `user ${userId}, emergency ${ctx.emergencyId}. This recipient was NOT alerted by push.`
    );
    return;
  }
  const delay = RETRY_DELAYS_MS[attempt];
  console.warn(`🔁 Scheduling notification retry #${attempt + 1} in ${delay / 1000}s for user ${userId} (emergency ${ctx.emergencyId})`);
  const timer = setTimeout(async () => {
    const [fcm, webPush] = await Promise.all([
      attemptFcm(userId, ctx, hasToken),
      attemptWebPush(userId, ctx),
    ]);
    const ok = fcm === 'sent' || webPush === 'sent';
    if (ok) {
      console.log(`✅ Notification retry #${attempt + 1} succeeded for user ${userId} (emergency ${ctx.emergencyId})`);
    } else if (fcm === 'no_token' && webPush === 'no_subscription') {
      console.error(`🔴 User ${userId} has no push channel registered — cannot alert by push (emergency ${ctx.emergencyId})`);
    } else {
      scheduleRetry(userId, ctx, hasToken, attempt + 1);
    }
  }, delay);
  // Don't keep the process alive just for retries
  if (typeof timer.unref === 'function') timer.unref();
}

export async function notifyEmergencyParticipants(
  ctx: EmergencyContext,
  recipients: Array<{ userId: string; name: string | null; hasFcmToken: boolean }>
): Promise<RecipientDelivery[]> {
  const results = await Promise.all(
    recipients.map(async (r): Promise<RecipientDelivery> => {
      const [fcm, webPush] = await Promise.all([
        attemptFcm(r.userId, ctx, r.hasFcmToken),
        attemptWebPush(r.userId, ctx),
      ]);
      const socket = attemptSocket(r.userId, ctx, recipients.length);
      const delivered = fcm === 'sent' || webPush === 'sent';

      if (!delivered) {
        const transient = fcm === 'failed' || webPush === 'failed';
        console.error(
          `🔴 Push delivery FAILED for user ${r.userId} (${r.name || 'unknown'}) — ` +
          `fcm=${fcm}, webPush=${webPush}, socket=${socket} (emergency ${ctx.emergencyId})`
        );
        if (transient) scheduleRetry(r.userId, ctx, r.hasFcmToken, 0);
      }

      return { userId: r.userId, name: r.name, fcm, webPush, socket, delivered };
    })
  );

  const deliveredCount = results.filter((r) => r.delivered).length;
  console.log(
    `📊 Notification summary for emergency ${ctx.emergencyId}: ` +
    `${deliveredCount}/${results.length} recipients reached by push ` +
    `(socket reached ${results.filter((r) => r.socket === 'sent').length})`
  );
  if (results.length > 0 && deliveredCount === 0) {
    console.error(`🚨🚨 CRITICAL: emergency ${ctx.emergencyId} was created but NO recipient was reached by push.`);
  }
  return results;
}
