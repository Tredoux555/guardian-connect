# ⚠️ CRITICAL: Set Root Directory in Railway

## The Error You're Seeing

```
⚠ Script start.sh not found
✖ Railpack could not determine how to build the app.
```

This happens because Railway is trying to build from the **root directory**, but your app has separate `backend` and `web-user` directories.

## ✅ SOLUTION: Set Root Directory

### For Backend Service:

1. In Railway dashboard, click on your **backend service**
2. Go to **"Settings"** tab
3. Scroll down to **"Root Directory"**
4. Enter: **`backend`**
5. Click **"Save"** or **"Update"**
6. Railway will automatically redeploy

### For Frontend Service:

1. Create a new service (or use existing)
2. Go to **"Settings"** tab
3. Scroll to **"Root Directory"**
4. Enter: **`web-user`**
5. Click **"Save"**
6. Railway will automatically redeploy

## 📍 Where to Find Root Directory Setting

1. Click on your service in Railway
2. Click **"Settings"** tab (left sidebar)
3. Scroll down to **"Root Directory"** section
4. It's usually near the bottom of the settings page

## ✅ After Setting Root Directory

- Railway will detect Node.js automatically
- It will use `package.json` from the correct directory
- Build will work correctly
- Deployment will succeed

## 🔍 How to Verify

After setting Root Directory:
1. Go to **"Deployments"** tab
2. Click on the latest deployment
3. Check the logs - you should see:
   - `npm install` running
   - `npm run build` running (for backend)
   - `npm start` running

If you still see errors, check that:
- Root Directory is set correctly (`backend` or `web-user`)
- The directory exists in your GitHub repo
- `package.json` exists in that directory

---

**This is the most common issue with monorepos on Railway!**
