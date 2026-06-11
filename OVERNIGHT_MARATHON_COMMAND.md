# 🌙 OVERNIGHT MARATHON COMMAND — Guardian Connect Revamp
**Written:** Jun 11, 2026 · **For:** the next session (refreshed context), running autonomously
**Mandate:** carte blanche. This is NOT an active/production project. You may cut, chop, rebuild,
delete, and revamp aggressively. Breaking things is acceptable — committing often is mandatory so
nothing is *irreversibly* lost. Be bold, be opinionated, ship real improvements.

---

## 0. READ THIS FIRST, THEN GO
You are Claude (highest available model) running a long autonomous session while Tredoux sleeps.
Do NOT stop to ask questions. Make the best decision and proceed. Use TaskCreate/TaskUpdate to
track every phase. **Audit after every phase** (see §6). Work in a loop: analyse → research →
build → audit → repeat. Leave a clear morning report at the end (§7).

### Where everything lives
- **Read/Edit/Grep/Glob path:** `/Users/tredouxwillemse/Desktop/Master Brain/ACTIVE/guardian-connect`
- **bash path:** `/sessions/great-admiring-lamport/mnt/Desktop/Master Brain/ACTIVE/guardian-connect`
- Prior audit (read it): `LAUNCH_AUDIT_Jun11_2026.md` in that folder
- Apps: `backend/` (Node/TS + Postgres), `web-user/` (React), `admin/` (React), `mobile/` (Flutter)
- It's a git repo. **`git add -A && git commit` at the end of every phase** with a clear message.
  Create a branch first: `git checkout -b overnight-revamp-jun11`. Never force-push, never touch remote.

### What Guardian Connect is
Personal-safety alert app: trigger emergency → notify trusted contacts → share location →
coordinate. Launching FREE as the brand/credibility arm of Tredoux's ecosystem.

---

## 1. TREDOUX'S PIVOT DECISIONS (these override the old design — implement them)
1. **Live/real-time location tracking is OUT.** Emergency location is now **STATIC** — capture GPS
   once at trigger time, store it, share it. No continuous streaming, no battery-drain polling,
   no high-frequency updates. Rip out / disable the live-tracking machinery. This simplifies a LOT.
2. **Location must open cleanly in the user's maps app.** This was the old blocker. Implement a
   clean "Navigate / Open in Maps" action that deep-links to **Google Maps by default** (everyone
   uses it), with Apple Maps fallback on iOS. Use:
   - Google: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`
   - Apple (iOS detect): `https://maps.apple.com/?daddr=<lat>,<lng>`
   - No embedded map widget, no Google Maps API key, no billing. Just a button → native app.
3. **Video calling is IN, via Agora.** Montree already uses Agora — reuse the same account/App ID
   pattern. Once contacts are "on board" with an emergency, they connect by video call. Wire Agora
   into the emergency-active screen (web first; mobile if time). Pull the Agora App ID from env/config
   the same way Montree does. (Find Montree's Agora setup for reference if helpful — it's in the
   whale/montree codebase; otherwise just env-var it: `AGORA_APP_ID`.)
4. **Mental model shift:** this is a *static-location alert + group video room*, not a live tracker.
   Reframe code, copy, and UX around that. It's simpler, cheaper, and more reliable — lean into it.

---

## 2. NON-NEGOTIABLE P0 FIXES (from the audit — verify in code, then fix)
- **Authorization bypass:** `GET /emergencies/:id` and the location endpoint must verify the caller
  is the owner or an invited participant. This is the #1 risk for a safety app. Fix and add a test.
  (`backend/src/routes/emergencies.ts`)
- **Re-enable rate limiting** on auth + emergency endpoints; ensure it actually engages in production
  (`NODE_ENV=production`). (`backend/src/routes/auth.ts`)
- **Notification failures must be loud + retried**, never silently swallowed — a created emergency
  that never alerts anyone is the worst failure. Surface errors to the client; add retry/queue.
  (`backend/src/services/push.ts`)
- **Wrap emergency creation in a DB transaction** (no partial writes).
- **Legal:** generate **Privacy Policy** + **Terms of Service** HTML pages (location/camera/mic data,
  retention, GDPR/CCPA basics) with a prominent **"NOT a replacement for 911 / emergency services"**
  disclaimer. Link them in the web app footer + login. Draft them yourself; mark "review by a human
  before real launch."
- **Escalation honesty:** the old escalation is a stub. Either remove the claim or clearly relabel
  "Coming soon." Do not present fake 911 integration.

## 3. P1 IMPROVEMENTS (do as many as time allows)
- Token storage hardening (avoid raw localStorage if feasible), tighten CORS to known origins,
  rate-limit admin login.
- Onboarding: a new user must be able to get protected in <60s. Add a guided "add your contacts
  first" flow + sensible empty states. Allow contact add by something easier than exact email if
  feasible (invite link / shareable code).
- **One-page landing site** for guardianconnect.icu: hero, how-it-works (3 steps), FAQ, privacy/terms
  links, honest 911 disclaimer. Static HTML is fine. Make it genuinely good — this is marketing.
- Deploy/readiness notes for the admin panel.
- Decide & document what `invoice-system/` is doing in this repo (looks orphaned — archive it).

## 4. P2 / CLEANUP (if you still have runway)
- Archive the ~88 root-level .md files into `docs/archive/` so the repo is navigable.
- Add DB indexes where obvious; add basic tests/CI scaffolding.
- Remove now-dead live-tracking code paths fully (don't just disable — delete, since location is static).

---

## 5. SUGGESTED PHASE ORDER (loop with audits between each)
1. **Recon & branch.** Read audit + key source files; map real state vs. the docs; `git checkout -b`.
   Write a short findings note. **Audit.**
2. **Security P0.** Auth bypass, rate limiting, transaction, loud notifications. **Audit + test.**
3. **Static-location pivot.** Rip out live tracking; capture-once GPS; clean Maps deep-link button
   (Google default / Apple fallback). **Audit.**
4. **Agora video.** Wire video room into emergency-active flow (web). **Audit.**
5. **Legal + escalation honesty.** Privacy/ToS pages + 911 disclaimer; fix escalation claim. **Audit.**
6. **Onboarding + landing page.** **Audit.**
7. **Cleanup + final full audit + build check** (`npm run build` per app; `flutter analyze` if reachable).
8. **Morning report.**

## 6. AUDIT DISCIPLINE (every phase)
After each phase, run an audit pass — ideally spawn a subagent to review the diff for: security
regressions, broken builds, secrets committed, half-wired features, and whether the change actually
does what was intended. Record pass/fail in the task list. Fix fails before moving on. Re-audit.
Never mark a phase complete with a failing build or an unverified security fix.

## 7. GUARDRAILS
- Commit per phase; stay on the `overnight-revamp-jun11` branch; never push to remote.
- **Never** commit real secrets/keys. Use env vars + `.env.example`. If you find committed secrets,
  flag them in the report (don't silently leave them).
- Don't deploy to Railway, don't change DNS, don't send real notifications/SMS, don't touch payment
  live keys. Build and prepare; leave the "go live" switches for Tredoux.
- Anything genuinely destructive or ambiguous → do the reversible version and note it for Tredoux.

## 8. MORNING REPORT (end of session) — write to `MARATHON_REPORT_Jun12.md`
- What changed, per phase, with commit SHAs.
- Audit results per phase (pass/fail + fixes).
- What's now launch-ready vs. still blocking.
- Exact next steps + any decisions needed from Tredoux.
- Honest risk list (esp. anything security/legal he must confirm before a real launch).

---
**Tone:** decisive, surgical, creative. You have the keys. Make Guardian Connect meaningfully
better by morning. Go.
