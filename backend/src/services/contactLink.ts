import { query } from '../database/db';

/**
 * Make two registered users mutual emergency contacts (idempotent).
 * Used by the invite-link flow: someone who registers through your link
 * is someone you trust — you become each other's contacts immediately.
 */
export async function linkMutualContacts(userIdA: string, userIdB: string): Promise<boolean> {
  if (!userIdA || !userIdB || userIdA === userIdB) return false;

  const users = await query('SELECT id, email, display_name FROM users WHERE id = ANY($1)', [
    [userIdA, userIdB],
  ]);
  if (users.rows.length !== 2) return false;

  const byId = new Map(users.rows.map((u: any) => [u.id, u]));
  const a = byId.get(userIdA);
  const b = byId.get(userIdB);

  const displayName = (u: any) => u.display_name || (u.email ? u.email.split('@')[0] : 'Contact');

  for (const [owner, contact] of [
    [a, b],
    [b, a],
  ] as const) {
    const exists = await query(
      'SELECT id FROM emergency_contacts WHERE user_id = $1 AND (contact_user_id = $2 OR contact_email = $3)',
      [owner.id, contact.id, contact.email]
    );
    if (exists.rows.length === 0) {
      await query(
        `INSERT INTO emergency_contacts
         (user_id, contact_user_id, contact_email, contact_name, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [owner.id, contact.id, contact.email, displayName(contact)]
      );
    }
  }
  console.log(`🤝 Mutual contacts linked: ${userIdA} ↔ ${userIdB} (invite link)`);
  return true;
}
