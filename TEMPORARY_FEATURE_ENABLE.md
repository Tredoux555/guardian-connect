# Temporary Feature Enable - For Preview Only

## ✅ Features Enabled

I've temporarily enabled both Donations and Subscriptions features so you can see them.

**Added to `web-user/.env`:**
```env
VITE_ENABLE_DONATIONS=true
VITE_ENABLE_SUBSCRIPTIONS=true
```

**Added to `backend/.env`:**
```env
ENABLE_DONATIONS=true
ENABLE_SUBSCRIPTIONS=true
```

## 🔄 Next Steps

1. **Restart Frontend Server** (REQUIRED - Vite needs restart to read new env vars):
   ```bash
   cd web-user
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Restart Backend Server**:
   ```bash
   cd backend
   # Stop current server (Ctrl+C)
   npm run dev
   ```

3. **Hard Refresh Browser**:
   - Chrome/Edge: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - Firefox: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)
   - Safari: `Cmd+Option+R`

## 👀 What You Should See

After restarting:
- **"Donate" button** in the header (next to Contacts)
- **"Subscribe" button** in the header
- Routes `/donations` and `/subscriptions` will be accessible

## ⚠️ Note

The payment forms will show errors because Stripe keys aren't configured yet. That's expected! You can still see the UI and test the flow.

## 🔒 To Hide Again Later

When you're done previewing, remove or change these lines in both `.env` files:

**In `web-user/.env`:**
```env
VITE_ENABLE_DONATIONS=false
VITE_ENABLE_SUBSCRIPTIONS=false
```

**In `backend/.env`:**
```env
ENABLE_DONATIONS=false
ENABLE_SUBSCRIPTIONS=false
```

Then restart both servers again.

---

**Status**: ✅ Features enabled! Restart servers to see them.

