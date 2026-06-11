-- RANK 1 — Defense-in-depth: at most ONE active emergency per user.
-- The app now also enforces this with a transaction-scoped advisory lock,
-- so this index is belt-and-braces. Safe to run on live DB (CONCURRENTLY
-- avoids locking writes). Idempotent.
--
-- Run against the production Postgres (Railway):
--   psql "$DATABASE_URL" -f 01_unique_active_emergency.sql

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_active_emergency_per_user
  ON emergencies (user_id)
  WHERE status = 'active';
