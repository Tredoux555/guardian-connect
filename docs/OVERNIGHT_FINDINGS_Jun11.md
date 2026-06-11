# Overnight Recon Findings — Jun 11, 2026 (Phase 1)

Branch: `overnight-revamp-jun11`. Verified the audit's claims directly in code.

## Confirmed P0 (all real)
1. **`GET /emergencies/:id` has NO authorization check** — any logged-in user can read any emergency incl. locations (`backend/src/routes/emergencies.ts:405`). Same for `POST /:id/escalate` (no participant check at all).
2. **Rate limiting is a no-op unless `NODE_ENV === 'production'`** (`auth.ts:23`). If the env var is missing/typoed on Railway, auth is wide open. Will invert: rate limiting ON by default, opt-out only via explicit `DISABLE_RATE_LIMIT=true`.
3. **Notification failures are swallowed** — `create` logs per-recipient errors then prints "all notifications sent" regardless; client response never says whether anyone was actually alerted. No retry.
4. **No transaction on emergency creation** — emergency row + participants inserted separately; `transaction()` helper exists in `db.ts` but is unused.

## Extra bugs found (not in audit)
- **`GET /emergencies/history` is dead** — registered AFTER `/:id`, so Express routes "history" into `findById('history')` → uuid cast error → 500.
- **Schema CHECK constraint** on `emergencies.status` only allows `active|ended|cancelled`, but history query filters on `'escalated'` — escalated status could never be written anyway.
- `web-user/src/components/GoogleMapsLoader.tsx` is **unused** (no imports) — plus `@react-google-maps/api`, `@types/google.maps`, `open-location-code` deps can go. Maps deep-link already exists in `EmergencyActive.tsx` (iOS uses `maps://` scheme; switching to `https://maps.apple.com/?daddr=` per spec).
- Admin login has **no rate limit** (`routes/admin.ts`).
- `LogViewer` debug widget rendered on Home for all users.
- Contact add is **auto-bidirectional without consent** (adding a registered user instantly adds you to their contacts). Leaving as-is for launch but flagged.

## State vs docs
- No tests, no test framework anywhere. No `.env.example` files.
- "Live tracking" is actually: one-shot `getCurrentPosition` posts + 5–10s polling loops + socket `location_update`. No `watchPosition`. Pivot = keep one-shot capture at trigger/accept, drop polling-driven location refresh, keep manual "Update location".
- Agora: mobile has a fully stubbed/disabled `video_call_service.dart` (commented out). Web has nothing. Plan: `agora-rtc-sdk-ng` in web-user, `AGORA_APP_ID` via env, optional token endpoint.
- `invoice-system/` is a standalone Node app, unrelated → archive.
- ~95 root-level .md files → `docs/archive/`.

## Plan deltas from the command doc
- Also fixing the `/history` shadow bug and the status CHECK constraint (migration SQL staged for prod in `db/RUN_THESE/`).
- Adding minimal test scaffold (vitest + supertest) for the authz fixes.
