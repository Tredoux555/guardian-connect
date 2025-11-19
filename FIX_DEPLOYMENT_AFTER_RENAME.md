# Fix Deployment After Service Rename

## The Problem

After renaming the service in Railway, the GitHub connection is broken. Railway can't see your latest commits, so when you click "Redeploy", it only redeploys the old code (the one that's currently deployed).

## The Root Cause

When you rename a service, Railway may:
- Lose the GitHub repository connection
- Not know about new commits
- Only be able to redeploy the last known commit (which is old)

## Solution: Reconnect GitHub Repository

### Method 1: Reconnect at Project Level (Recommended)

1. **Go to Railway Project Settings**
   - Open https://railway.app
   - Click on your **"guardian-connect"** project
   - Click **"Settings"** (project-level, at the top or in sidebar)

2. **Find Source/Repository Section**
   - Look for **"Source"** or **"Repository"** section
   - Check if it shows: `Tredoux555/guardian-connect`
   - If it says "Not connected" or is missing, continue

3. **Reconnect GitHub**
   - Click **"Connect Repository"** or **"Change Source"**
   - Select: `Tredoux555/guardian-connect`
   - Select branch: `main`
   - Click **"Connect"** or **"Save"**

4. **Verify Connection**
   - Should now show: `Tredoux555/guardian-connect` (main)
   - Status should be "Connected"

5. **Trigger Deployment**
   - Go to your **Backend** service
   - Click **"Deployments"** tab
   - Now you should see **"Deploy"** button with option to select latest commit
   - Click **"Deploy"** → **"Deploy Latest Commit"**
   - Should show your latest commit (with design system changes)

### Method 2: Reconnect at Service Level

If project-level doesn't work:

1. **Go to Backend Service**
   - Railway → Project → **Backend** service
   - Click **"Settings"** tab

2. **Find Source Section**
   - Look for **"Source"** or **"Repository"** section
   - If missing or disconnected, continue

3. **Connect Repository**
   - Click **"Connect Repository"** or **"Change Source"**
   - Select: `Tredoux555/guardian-connect`
   - Branch: `main`
   - Save

4. **Deploy Latest**
   - Go to **"Deployments"** tab
   - Click **"Deploy"** → Should now show latest commits

### Method 3: Force Refresh via GitHub Webhook

If reconnecting doesn't work:

1. **Check GitHub Webhooks**
   - Go to: https://github.com/Tredoux555/guardian-connect/settings/hooks
   - Look for Railway webhook
   - If missing or inactive, continue

2. **Remove Old Webhook** (if exists and broken)
   - Click on Railway webhook
   - Click **"Delete"** or **"Remove"**

3. **Reconnect in Railway** (forces new webhook)
   - Follow Method 1 or 2 above
   - Railway will create a new webhook automatically

4. **Test Webhook**
   - Make a small commit and push
   - Railway should auto-deploy
   - Or manually deploy from Deployments tab

### Method 4: Manual Push to Trigger (Quick Test)

If you just want to test if connection works:

1. **Make a tiny change**
   ```bash
   cd /Users/tredouxwillemse/Desktop/guardian-connect
   echo "# Test" >> README.md
   git add README.md
   git commit -m "Test: trigger Railway deployment"
   git push origin main
   ```

2. **Check Railway**
   - Go to Deployments tab
   - Should see new deployment starting automatically
   - If not, connection is still broken (use Method 1-3)

## After Reconnecting

Once reconnected, you should be able to:

1. ✅ See latest commits in Deployments tab
2. ✅ Click "Deploy" and select any commit
3. ✅ Auto-deploy will work on future pushes
4. ✅ Manual deploy will show latest code

## Verify It Worked

After reconnecting and deploying:

1. **Check Deployment**
   - Deployments tab → Latest deployment
   - Should show your latest commit hash
   - Should show: "Build Successful"

2. **Check Service Logs**
   - Service → Logs tab
   - Should see server starting
   - Should NOT see: "Cannot find module '/app/dist/server.js'"

3. **Test Auto-Deploy**
   - Make a small change and push
   - Railway should automatically start deploying
   - Check Deployments tab - new deployment should appear

## Current Latest Commit

After reconnecting, deploy this commit:
- **Latest**: Should show your most recent commit
- **Contains**: Design system changes + all previous fixes

## If Still Not Working

If reconnecting doesn't work:

1. **Check Railway Status**
   - Is Railway having issues? Check status.railway.app

2. **Check GitHub Permissions**
   - Railway needs access to your repo
   - Check GitHub → Settings → Applications → Railway
   - Should have access to `guardian-connect` repo

3. **Try Disconnecting and Reconnecting**
   - Disconnect repository in Railway
   - Wait 30 seconds
   - Reconnect it
   - This forces Railway to refresh everything

4. **Contact Railway Support**
   - If nothing works, Railway support can help
   - They can manually reconnect the service

---

**Most Important Step**: Reconnect the GitHub repository in Railway Project Settings → Source

This will restore the connection and allow Railway to see your latest commits.

