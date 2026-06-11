-- RANK 2 — Optional performance indexes (safe, idempotent, run anytime).
-- The schema already has good coverage; these close two gaps the code paths use:
--   1. reverse-contact lookups (delete + invite-link linking) filter on contact_user_id
--   2. pending-emergency polling joins participants by (user_id, status)

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_contact_user_id
  ON emergency_contacts(contact_user_id);

CREATE INDEX IF NOT EXISTS idx_emergency_participants_user_status
  ON emergency_participants(user_id, status);
