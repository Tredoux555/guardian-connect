# 🌅 MARATHON REPORT — Guardian Connect Overnight Revamp (Jun 11→12, 2026)

All 8 phases done, on branch **`overnight-revamp-jun11`** (never pushed, never deployed —
your rules). Every phase was audited by an independent review pass; final audit verdict:
**PASS on all phases, no secrets committed, nothing half-wired.**

## What changed, per phase (commit SHAs)

**Phase 1 — Recon** (`21adc44`): verified the audit's claims in code; found two extra bugs
nobody knew about (the history endpoint was unreachable; the database rule list didn't allow a
status the code used).

**Phase 2 — Security P0** (`fb2ca1a`, `ce47c9a`): the big one.
- Anyone logged in could read ANY emergency + its locations → now owner/participants only
  (strangers get 404, so they can't even confirm an emergency exists).
- Rate limiting was OFF unless an env var was exactly right → now ON by default everywhere
  (auth, emergency creation, messages, admin login — admin login had none at all).
- Emergency creation is now all-or-nothing in the database AND protected against the
  double-tap race (advisory lock + staged unique index).
- Notification failures are no longer silent: every alert is tracked per person, failures
  retry automatically (5s/30s/2min), and the response now tells the app how many people were
  actually reached, with an honest warning if nobody was.
- The escalate endpoint used to reply "escalated to emergency services" while doing NOTHING.
  It now honestly returns "not available yet — call your local emergency number."
- Tests added (8, all passing) + `.env.example`.

**Phase 3 — Static location pivot** (`bd276de`): no more polling loops; location is captured
once at trigger/accept, updated only when someone presses the button. "Navigate" opens
Google Maps (Apple Maps on iOS) via plain links — no API key, no billing, no embedded map.
Deleted the unused Google Maps component and 3 dependencies.

**Phase 4 — Video calls** (`8ed8752`): Agora group video room on the emergency screen.
Join button → camera/mic grid with mute/camera/leave controls. Credentials come from a new
participants-only endpoint; works in App-ID-only mode (set `AGORA_APP_ID` in Railway, same as
Montree) or secured-token mode (`AGORA_APP_CERTIFICATE`). SDK loads only when someone joins.

**Phase 5 — Legal** (`6676fbb`): Privacy Policy + Terms of Service (plain language, GDPR/CCPA
basics, retention, camera/mic) with big red NOT-911 disclaimers; linked from login, home
footer, and the landing page. ⚠️ Marked as drafts — **have a human review before real launch.**

**Phase 6 — Onboarding + landing** (`9f3860c`): the under-60-seconds path.
- **Invite link**: one button on Contacts → share a link → whoever registers through it
  automatically becomes your mutual emergency contact. No exact-email guessing. (Stateless
  signed tokens — no database changes needed.)
- Guided empty states: Home now warns you clearly when zero contacts would be alerted, with
  a one-tap path to fix it.
- **Landing page** in `landing/index.html` for guardianconnect.icu: hero, 3 steps, honest FAQ,
  legal links, disclaimer. Static file — host it anywhere (Railway static service, Netlify, etc).

**Phase 7 — Cleanup + verification** (`34a46d1`, `e688ec6`, `163de3c`): 95 root docs →
`docs/archive/`; orphaned `invoice-system/` → `archive/`; admin-panel deploy instructions in
`docs/ADMIN_DEPLOY_NOTES.md`; final audit hardening (invite tokens can never be used as login
tokens). **Builds verified on your Mac: backend tsc ✓, 8/8 tests ✓, web-user ✓, admin ✓.**

## For you to run (ranked, in `db/RUN_THESE/`)
1. `01_unique_active_emergency.sql` — guarantees one active emergency per user at DB level.
2. `02_helpful_indexes.sql` — two optional speed indexes. Both safe + idempotent.

## To flip on later (no rush)
- Railway: `AGORA_APP_ID` (+ optional `AGORA_APP_CERTIFICATE`) → video calls go live.
- Railway: `APP_URL=https://app.guardianconnect.icu` (or wherever web-user lives) so invite
  links point at the right place.
- Deploy the admin panel using `docs/ADMIN_DEPLOY_NOTES.md`.
- Host `landing/index.html` at guardianconnect.icu.

## Launch-ready vs still blocking
**Ready:** core flow secured, static-location + maps handoff, video, legal pages, onboarding,
landing page, navigable repo.
**Blocking before a real public launch:**
1. Human review of Privacy/Terms (drafts only).
2. Firebase + VAPID push keys in Railway (alerts to closed apps depend on them).
3. Finish the domain (api.guardianconnect.icu DNS) — old audit item, unchanged.
4. A real end-to-end test with two phones: register → invite link → trigger → accept →
   navigate → video call. I verified everything that can be verified without two live devices.

## Honest risk list
- Notification retries live in the server's memory — if the server restarts mid-retry, those
  retries are lost (durable queue is the upgrade; fine for launch scale).
- Legal pages are my drafts, not a lawyer's.
- Mobile (Flutter) app untouched tonight — web-first per the launch plan; its escalation
  service now gets honest 501s from the backend and logs them as failures.
- Merging this branch into main is YOUR call. Recommendation: **MERGE-WITH-CARE** — verified
  by builds, tests, and two independent audit passes, but it deserves one human click-through
  before going live.
