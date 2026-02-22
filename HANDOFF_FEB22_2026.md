# Guardian Connect — Handoff Document
## Date: 2026-02-22

## Current Status
**DEPLOYED** — Backend and frontend running on Railway. Code pushed to GitHub (commit cb95b66).

## What Was Done This Session

### 1. Security & Bug Fixes
- **Fixed `.isEmpty` bug** in `backend/src/services/push.ts` (line 111) and `backend/src/routes/emergencies.ts` (line 88) — `.isEmpty`/`.isNotEmpty` don't exist on JS strings, changed to `.length === 0` / `.length > 0`
- **Removed hardcoded JWT fallback** in `backend/src/services/jwt.ts` — now throws fatal error if `JWT_SECRET` env var is missing
- **Removed JWT fallback** in `backend/src/routes/admin.ts` — removed `|| 'default-secret'`
- **Cleared test credentials** from `web-user/src/pages/Login.tsx` and `admin/src/pages/Login.tsx`
- **Tightened CORS** in `backend/src/server.ts` — removed regex wildcard `/.railway.app$/`, now reads `ALLOWED_ORIGINS` env var
- **Matched Socket.io CORS** in `backend/src/services/socket.ts` — was `origin: '*'`, now matches HTTP CORS config

### 2. Performance Fixes
- **Fixed N+1 query** in `backend/src/routes/emergencies.ts` — replaced per-contact FCM token loop with batch query using `WHERE id = ANY($1)`
- **Added 30s video limit** in `web-user/src/components/EmergencyChat.tsx` — auto-stops recording at 30 seconds

### 3. Cleanup
- Removed unused deps from `backend/package.json`: `aws-sdk`, `twilio`, `redis`
- Deleted `backend/src/database/redis.ts` (unused)
- Deleted stale files: `EmergencyActive.OLD.tsx`, 5x `.bak` files

### 4. PWA Enhancement
- Added offline caching strategy to `web-user/public/service-worker.js` — precaches critical assets, network-first with cache fallback

### 5. iOS Aesthetic Overhaul (Complete)
Rewrote all 12 CSS files with unified iOS design system:
- `web-user/src/design-system.css` — Apple HIG tokens (colors, typography, spacing, shadows, animations)
- `web-user/src/index.css` — Global iOS base styles
- `web-user/src/App.css` — App shell
- `web-user/src/pages/Login.css`
- `web-user/src/pages/Home.css`
- `web-user/src/pages/EmergencyActive.css`
- `web-user/src/components/EmergencyChat.css`
- `web-user/src/pages/Contacts.css`
- `web-user/src/pages/Profile.css`
- `web-user/src/pages/EmergencyResponse.css`
- `web-user/src/pages/Donations.css`
- `web-user/src/pages/Subscriptions.css`

## Deployment
- **GitHub:** https://github.com/Tredoux555/guardian-connect (branch: main)
- **Railway Project:** https://railway.com/project/1bd2d2cd-3961-496e-aec4-406baafbf8e0
- **Frontend:** https://web-user-production.up.railway.app
- **Backend:** https://back-end-production-4a69.up.railway.app
- **Database:** PostgreSQL on Railway (connected)

## Domain: guardianconnect.icu
- **Root (guardianconnect.icu):** Resolves to GoDaddy parking IPs
- **api.guardianconnect.icu:** Has CNAME to old Railway URL `e0z4048c.up.railway.app` — NEEDS UPDATE
- **app.guardianconnect.icu:** NOT CONFIGURED — needs CNAME
- **admin.guardianconnect.icu:** NOT CONFIGURED
- **www.guardianconnect.icu:** Redirects to root

### DNS TODO (manual — Chrome automation was unavailable)
In GoDaddy DNS for guardianconnect.icu:
1. Add/Update CNAME: `app` → `web-user-production.up.railway.app`
2. Add/Update CNAME: `api` → `back-end-production-4a69.up.railway.app`

In Railway (each service → Settings → Networking → Custom Domain):
3. Web User service: add `app.guardianconnect.icu`
4. Backend service: add `api.guardianconnect.icu`

## Environment Variables Needed
Backend requires these env vars in Railway:
- `JWT_SECRET` — **CRITICAL** (no fallback now — app will crash without it)
- `DATABASE_URL` — PostgreSQL connection string
- `ALLOWED_ORIGINS` — comma-separated allowed origins (e.g. `https://web-user-production.up.railway.app,https://app.guardianconnect.icu`)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — for web push notifications
- `FCM_SERVER_KEY` — Firebase Cloud Messaging

## Architecture
- **Monorepo:** backend/ (Express/TypeScript), web-user/ (React/Vite/TypeScript), admin/ (React/Vite/TypeScript), mobile/ (Flutter), invoice-system/ (Next.js)
- **Real-time:** Socket.io for emergency alerts, location updates, chat
- **Push:** Firebase Cloud Messaging + Web Push API
- **PWA:** Installable, offline notifications, offline caching (new)

## Emergency Flow
1. User presses big red button → creates emergency
2. Emergency contacts get push notification + alert sound
3. Contacts accept → join emergency room
4. User's GPS location shared (openable in Google/Apple Maps)
5. Real-time chat: text, photos, video (30s max), voice notes
6. User marks "I'm Safe" → emergency ends

## GitHub PAT
A fine-grained PAT was created for pushing. Consider revoking old tokens at:
https://github.com/settings/personal-access-tokens
