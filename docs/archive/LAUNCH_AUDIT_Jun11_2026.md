# Guardian Connect — Launch Audit & Improvement Plan
**Date:** June 11, 2026 · Audited for: free public launch readiness

## What it is (objective)
A personal-safety **emergency alert system**. A user in trouble triggers an alert (panic
button) → their trusted contacts are notified → live GPS location is shared → everyone
coordinates via real-time chat → if no one responds in ~5 min it's meant to escalate.
Built as the "credibility / brand-awareness, launch-free" arm of the ecosystem.

**Stack:** Node/TypeScript + PostgreSQL backend (live on Railway), React web-user app,
React admin panel, Flutter mobile app (iOS/Android), Socket.io for realtime.
**Apps:** mobile/ (Flutter), web-user/ (React), admin/ (React), backend/ (API).
**Domain:** guardianconnect.icu (DNS not finished). Last commit Feb 21 — idle ~4 months.

## Verdict
Tech ~75% done · **Legal 0% done** · Deployment ~40% done.
Core flow works (register → add contacts → trigger → chat → accept → history).
**Fastest credible launch = WEB-FIRST in ~7–10 days.** Mobile app is 3–4 weeks from
store-ready (no signing, no Firebase creds, API <33, no legal docs). Don't ship native day 1.

---

## P0 — MUST FIX BEFORE ANY PUBLIC LAUNCH

### Security (verify each in code before trusting)
1. **Authorization bypass — GET /emergencies/:id** — any logged-in user can reportedly
   read ANY emergency's data + live location. For a safety app this is the #1 risk. Add
   participant/owner check. (`backend/src/routes/emergencies.ts`)
2. **Location update endpoint missing participant verification** — same class of bug.
3. **Rate limiting disabled** in production (conditional fails) — auth + emergency endpoints
   wide open to abuse. Re-enable; set `NODE_ENV=production`. (`backend/src/routes/auth.ts`)
4. **Silent notification failure** — emergency can be created but responders never alerted,
   with no error surfaced. For an emergency app this is the worst failure mode. Make
   notification failures loud + retried. (`backend/src/services/push.ts`)
5. **No DB transaction on emergency creation** — partial writes possible.

### Legal / trust (non-negotiable for a location app)
6. **No Privacy Policy + No Terms of Service.** App collects location/camera/mic. Required
   by GDPR/CCPA and both app stores. Must include an explicit **"NOT a replacement for 911"**
   disclaimer. ~2 days incl. drafting.
7. **Escalation feature is a stub** (logs only, no real 911/SMS integration) but presents as
   working — dangerous false sense of safety + liability. For MVP: relabel "Coming soon" /
   remove the claim. Real escalation (Twilio etc.) = post-launch premium feature.

### Config
8. **Firebase push credentials not set** in Railway → push notifications silently don't fire.
9. **Custom domain not finished** — API hardcoded to api.guardianconnect.icu; finish Railway
   + GoDaddy CNAME or the live app breaks.

## P1 — STRONGLY RECOMMENDED
- Email verification disabled (decide: enable via SendGrid/SES, or document as intentional).
- Token stored in localStorage (XSS-exposed); CORS overly permissive; admin login has no rate limit.
- No landing page (traffic has nowhere to go); no app-store assets; no data-retention policy.
- Onboarding friction: no guided "add contacts first" flow; email-only contacts (no phone/QR);
  cold empty state. A safety app a new user can't set up in 60s won't retain.
- Deploy the admin panel (no live URL found). Decide what invoice-system/ is doing in here (looks orphaned).

## P2 — LATER
- Video calling (needs Agora ID), native panic-button widget, contact QR sharing,
  donations/subscriptions (Stripe stubbed), tests/CI, DB indexes, archive the ~88 root .md files.

---

## RECOMMENDED 7-DAY WEB-FIRST PLAN
- **Days 1–2:** Privacy Policy + ToS (+ 911 disclaimer) linked in app; Firebase creds; finish domain.
- **Days 3–4:** Fix the authorization bypass + location-endpoint check; re-enable rate limiting;
  make notification failures loud; full register→trigger→chat→accept test on the live URL.
- **Days 5–6:** One-page landing site (hero / how-it-works / FAQ / privacy); basic screenshots.
- **Day 7:** Soft launch on guardianconnect.icu; share in safety/family communities; gather feedback.
- **Weeks 2–4:** Mobile signing + Firebase + tested builds → store submission; real escalation; video.

## Marketability angle (free launch)
Lead with the honest promise: "Free panic button that alerts the people who'd actually come
for you — not a call center." Niche-target first (parents, lone workers, elderly-care families,
students) rather than broad. The 911 disclaimer is both legal cover AND positioning: it's a
*personal network* alert, complementary to emergency services.

> NOTE: security line-numbers/claims came from an automated read — confirm each in code while fixing.
