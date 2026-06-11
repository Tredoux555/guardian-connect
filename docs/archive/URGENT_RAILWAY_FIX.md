# 🚨 URGENT: Fix Railway Build Error

## The Error
```
⚠ Script start.sh not found
✖ Railpack could not determine how to build the app.
```

## ⚠️ WHY THIS HAPPENS

Railway is trying to build from the **ROOT** directory (`/`), but your app code is in:
- `backend/` folder (for backend)
- `web-user/` folder (for frontend)

Railway can't find `package.json` in the root, so it fails.

## ✅ THE FIX (Do This Now!)

### Step 1: Open Railway Dashboard
1. Go to: https://railway.app
2. Click on your project
3. Click on the **service** that's failing

### Step 2: Set Root Directory
1. Click **"Settings"** tab (left sidebar)
2. Scroll down to find **"Root Directory"** field
3. **Type exactly:** `backend` (for backend service) or `web-user` (for frontend)
4. Click **"Update"** or **"Save"** button
5. Railway will **automatically redeploy**

### Step 3: Verify
1. Go to **"Deployments"** tab
2. Wait for new deployment to start
3. Check logs - you should see:
   - ✅ `npm install` running
   - ✅ `npm run build` running
   - ✅ `npm start` running

## 📸 Visual Guide

```
Railway Dashboard
├── Your Project
    ├── Your Service (click this)
        ├── Settings (click this tab)
            └── Root Directory: [backend] ← TYPE HERE
```

## ❌ What NOT to Do

- Don't leave Root Directory empty
- Don't use `/backend` (no leading slash)
- Don't use `./backend` (no dot-slash)
- Just use: `backend` or `web-user`

## ✅ What to Do

- Set Root Directory to: `backend` (for backend service)
- Set Root Directory to: `web-user` (for frontend service)
- Save and let Railway redeploy

## 🔍 Still Not Working?

1. **Check the Root Directory is saved:**
   - Go back to Settings
   - Verify Root Directory shows: `backend` or `web-user`

2. **Check deployment logs:**
   - Go to Deployments tab
   - Click latest deployment
   - Check if it's reading from correct directory

3. **Verify GitHub has the files:**
   - Go to: https://github.com/Tredoux555/guardian-connect
   - Verify `backend/package.json` exists
   - Verify `web-user/package.json` exists

## 💡 Why This Works

When you set Root Directory to `backend`:
- Railway changes working directory to `backend/`
- Railway finds `backend/package.json`
- Railway runs `npm install` and `npm run build`
- Railway runs `npm start`
- ✅ Success!

---

**This is the #1 issue with monorepos on Railway. Setting Root Directory fixes it 100% of the time!**

