# Guardian Connect — AI Brain / Memory

## What Is This Project?
Emergency safety app. Users press a button to alert their emergency contact group, share GPS location (opens in Google/Apple Maps), and communicate via real-time chat (text, photos, video, voice notes). No live calls.

## Owner
- **Name:** Tredoux
- **Email:** tredoux555@gmail.com
- **GitHub:** Tredoux555

## Tech Stack
- **Backend:** Express + TypeScript, PostgreSQL, Socket.io, Firebase Cloud Messaging
- **Frontend (web-user):** React + Vite + TypeScript, PWA
- **Admin:** React + Vite + TypeScript
- **Mobile:** Flutter (not actively deployed)
- **Invoice System:** Next.js (separate, being decommissioned)

## Deployment
- **Platform:** Railway (auto-deploys from GitHub main branch)
- **Frontend URL:** https://web-user-production.up.railway.app
- **Backend URL:** https://back-end-production-4a69.up.railway.app
- **Railway Project:** https://railway.com/project/1bd2d2cd-3961-496e-aec4-406baafbf8e0
- **GitHub:** https://github.com/Tredoux555/guardian-connect (branch: main)

## Domain
- **guardianconnect.icu** — registered on GoDaddy
- DNS partially configured (api subdomain exists but points to old Railway URL)
- NEEDS: CNAME `app` → `web-user-production.up.railway.app`
- NEEDS: CNAME `api` → `back-end-production-4a69.up.railway.app`
- NEEDS: Custom domains added in Railway service settings

## Design System
- iOS aesthetic (Apple Human Interface Guidelines inspired)
- Design tokens in `web-user/src/design-system.css`
- SF Pro system fonts, 8pt spacing grid, iOS system colors
- Frosted glass nav bars, 0.5px separators, scale(0.98) press states
- Emergency red: #FF3B30, System blue: #007AFF, Success green: #34C759

## Key Files
- `backend/src/server.ts` — Express server, CORS config
- `backend/src/services/socket.ts` — Socket.io real-time
- `backend/src/services/push.ts` — Push notifications (FCM)
- `backend/src/services/jwt.ts` — JWT auth (requires JWT_SECRET env var)
- `backend/src/routes/emergencies.ts` — Emergency CRUD + FCM alerts
- `web-user/src/pages/Home.tsx` — Dashboard with emergency button
- `web-user/src/pages/EmergencyActive.tsx` — Active emergency view
- `web-user/src/components/EmergencyChat.tsx` — Real-time chat
- `web-user/public/service-worker.js` — PWA offline caching

## Critical Env Vars (Backend)
- `JWT_SECRET` — FATAL crash without it (no fallback)
- `DATABASE_URL` — PostgreSQL
- `ALLOWED_ORIGINS` — comma-separated CORS origins
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — web push
- `FCM_SERVER_KEY` — Firebase push

## Known Issues / TODO
1. Domain not fully configured (see Domain section above)
2. Email verification disabled for testing — re-enable for production
3. Admin panel needs its own domain/subdomain
4. Mobile (Flutter) app not actively maintained
5. Invoice system is separate and being decommissioned
6. Consider adding rate limiting to API endpoints
7. No automated tests exist

## Session History
- **2025-12-30:** Backend deployed, login fixed, CORS configured
- **2026-02-22:** Recovered code from GitHub, audited system, fixed 11 bugs (security + performance), complete iOS aesthetic overhaul (12 CSS files), pushed to GitHub via API
