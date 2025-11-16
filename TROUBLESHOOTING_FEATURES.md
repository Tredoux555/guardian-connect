# Troubleshooting: Features Not Showing

## ✅ Feature Flags Are Set Correctly

I've verified:
- ✅ `VITE_ENABLE_DONATIONS=true` in `web-user/.env`
- ✅ `VITE_ENABLE_SUBSCRIPTIONS=true` in `web-user/.env`
- ✅ `ENABLE_DONATIONS=true` in `backend/.env`
- ✅ `ENABLE_SUBSCRIPTIONS=true` in `backend/.env`

## 🔄 CRITICAL: Restart Required

**Vite reads environment variables ONLY at server startup.** You MUST restart the dev server!

### Steps to Fix:

1. **Stop the frontend dev server:**
   - Go to the terminal running `npm run dev` in `web-user/`
   - Press `Ctrl+C` to stop it

2. **Restart the frontend:**
   ```bash
   cd web-user
   npm run dev
   ```

3. **Stop the backend dev server:**
   - Go to the terminal running `npm run dev` in `backend/`
   - Press `Ctrl+C` to stop it

4. **Restart the backend:**
   ```bash
   cd backend
   npm run dev
   ```

5. **Hard refresh browser:**
   - Mac: `Cmd+Shift+R`
   - Windows: `Ctrl+Shift+R`
   - Or close and reopen the browser tab

## 🔍 Debug Check

After restarting, open browser console (F12) and you should see:
```
🔍 Feature Flags Status: {
  donations: true,
  subscriptions: true,
  ...
}
```

If you see `donations: false` or `subscriptions: false`, the server didn't restart properly.

## 🧪 Manual Test

Try navigating directly to:
- `http://localhost:3003/donations`
- `http://localhost:3003/subscriptions`

If these routes work but buttons don't show, it's a rendering issue.
If these routes give 404, the feature flags aren't being read.

## ⚠️ Common Issues

1. **Server not restarted** - Most common! Vite must restart.
2. **Browser cache** - Hard refresh required.
3. **Wrong port** - Make sure you're on the right port (3003 for frontend).
4. **Multiple terminals** - Make sure you restarted the RIGHT server.

## 🎯 Quick Fix Command

If you're in the project root:
```bash
# Kill any running dev servers
pkill -f "vite\|ts-node-dev" || true

# Restart frontend
cd web-user && npm run dev &

# Restart backend  
cd ../backend && npm run dev &
```

---

**Most likely issue**: Server needs restart! Vite doesn't hot-reload `.env` changes.

