# Railway Auto-Deploy Guide

## Where to Find Auto-Deploy Settings

Railway's UI has changed, and auto-deploy settings may be in different locations:

### Option 1: Service Settings → Source Tab
1. Go to your Railway project
2. Click on your **Backend** service
3. Click **Settings** tab
4. Look for **"Source"** section
5. Check for:
   - "Auto Deploy" toggle/switch
   - "Deploy on Push" option
   - "GitHub Integration" settings

### Option 2: Project Settings → Source
1. Go to Railway project dashboard
2. Click **Settings** (project-level, not service-level)
3. Look for **"Source"** or **"Repository"** section
4. Check GitHub connection status
5. Look for auto-deploy options there

### Option 3: Deployments Tab
1. Go to your service
2. Click **Deployments** tab
3. Look for a gear icon or settings button
4. Check for deployment settings/options

### Option 4: Service → Settings → Deploy
1. Service → Settings
2. Look for **"Deploy"** section
3. Check for:
   - "Auto Deploy" toggle
   - "Deploy on Push" option
   - "Wait for CI" (should be OFF)

## If Auto-Deploy Option is Missing

Railway may have changed to **auto-deploy by default**. If you don't see the option:

1. **Check if it's already enabled** - Railway might auto-deploy by default now
2. **Check GitHub webhook** - Go to GitHub repo → Settings → Webhooks
   - Should see a Railway webhook
   - Should be "Active" and listening for "push" events
3. **Manual trigger test** - Try manually deploying to see if it works

## Troubleshooting: Why Deployments Aren't Happening

### 1. Check GitHub Webhook
- GitHub repo → Settings → Webhooks
- Look for Railway webhook
- Check if it's active and receiving events
- Check recent deliveries for errors

### 2. Check Service Status
- Is the service paused?
- Is there a build error preventing deployment?
- Check the Deployments tab for failed builds

### 3. Check Build Logs
- Go to Deployments tab
- Click on latest deployment
- Check build logs for errors
- Look for "Build Successful" message

### 4. Force Manual Deployment
- Deployments tab → Click "Deploy" button
- Select "Deploy Latest Commit"
- This will force a deployment even if auto-deploy is off

## Current Status

- ✅ Latest commit: `3193b7d` - "Trigger Railway redeployment - backend crash prevention fixes"
- ✅ All config files correct
- ✅ Code pushed to GitHub
- ⚠️ Railway not auto-deploying

## Quick Fix: Manual Deploy

If auto-deploy isn't working:

1. Go to Railway → Your Service → **Deployments** tab
2. Click **"Deploy"** or **"Redeploy"** button
3. Select **"Deploy Latest Commit"**
4. This will deploy commit `3193b7d` with all fixes

## Verify Deployment

After deployment:
1. Check build logs - should see "Build Successful"
2. Check service status - should be "Active"
3. Check logs - should see server starting without errors
4. Test API endpoint - should respond

---

**Note:** Railway may have removed the explicit "Auto Deploy" toggle and made it default behavior. If deployments still don't happen automatically, the issue might be:
- GitHub webhook not configured
- Service in error state
- Build failures preventing deployment

