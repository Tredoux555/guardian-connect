# Admin panel — deploy readiness (Jun 12, 2026)

The admin app (`admin/`) builds clean (`npm run build` → `dist/`). It is a static
Vite/React bundle, same shape as web-user. To deploy on Railway:

1. New service from this repo, root directory `admin/`.
2. Build command: `npm install && npm run build` · Start: `npx serve -s dist -l $PORT`
   (serve is already used by web-user's start script).
3. Env var `VITE_API_URL=https://api.guardianconnect.icu/api` at BUILD time
   (Vite bakes it in — set it before the first build).
4. Backend `ALLOWED_ORIGINS` must include the admin URL once it exists.
5. Admin login is rate-limited (5/15min) as of the Jun-11 security pass.

Suggested: keep the admin panel on a non-obvious subdomain and don't link it
from the public site.
