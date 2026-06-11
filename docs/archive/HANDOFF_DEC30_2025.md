# Guardian Connect - Handoff Document
## Date: 2025-12-30 22:15 (Updated)

## Current Status
**WORKING** - Backend deployed, login functional

## What Was Fixed
1. **CORS** - Working (allow all origins)
2. **Email verification** - Temporarily disabled for testing (TODO: re-enable)
3. **Backend health** - ✅ Responding at /health
4. **Database** - ✅ Connected

## Test Credentials
- **Email:** test@test.com
- **Password:** password123

## Railway URLs
- **Frontend:** https://web-user-production.up.railway.app
- **Backend:** https://back-end-production-4a69.up.railway.app
- **Project:** https://railway.com/project/1bd2d2cd-3961-496e-aec4-406baafbf8e0

## API Endpoints Verified Working
- `GET /health` - Returns `{"status":"ok","database":"connected"}`
- `POST /api/auth/register` - Creates new user
- `POST /api/auth/login` - Returns tokens (verification disabled)

## Repository
- **GitHub:** https://github.com/Tredoux555/guardian-connect
- **Local:** ~/Documents/GitHub/guardian-connect

## Recent Commits
```
d1b69fc Temporarily disable email verification for testing
d7710e9 Add dev-verify endpoint for testing
8ad8735 Allow unverified login in dev mode for testing
891b9c8 fix: validate token after login before navigating
```

## TODO Before Production
1. Re-enable email verification in backend/src/routes/auth.ts
2. Configure email service (SendGrid/etc)
3. Restrict CORS to specific domains
4. Set up proper environment variables

## Next Steps to Test
1. Login at /login with test credentials
2. Test emergency creation
3. Test emergency contacts
4. Test group chat
5. Test push notifications

## Tech Stack
- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL on Railway
- **Hosting:** Railway

## Key Files
- `backend/src/routes/auth.ts` - Auth routes (verification disabled line ~133)
- `backend/src/server.ts` - CORS config
- `web-user/src/` - Frontend app
