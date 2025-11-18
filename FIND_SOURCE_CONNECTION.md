# Find Source Connection in Railway

## The Issue
Railway's UI doesn't show "Source" in Project Settings. The source connection might be at the **service level** instead.

## Solution: Check Service Settings

### Step 1: Go to Your Backend Service
1. In Railway, click on your **"backend"** service (not the project)
2. You should see service-specific tabs: "Deployments", "Variables", "Metrics", "Settings"

### Step 2: Check Service Settings → Source
1. Click the **"Settings"** tab for the backend service
2. Look for a **"Source"** section or tab
3. This is where the GitHub repository connection should be

### Step 3: Alternative Locations to Check

If "Source" isn't in service settings, check:

**Option A: Service → Settings → General**
- Look for "Repository" or "GitHub" connection
- Should show: `Tredoux555/guardian-connect`

**Option B: Service → Deployments Tab**
- Look for a gear icon or settings button
- Check for "Source" or "Repository" settings

**Option C: Service → Settings → Build**
- Check if there's a "Source" or "Repository" option there

## What to Look For

The source connection should show:
- Repository: `Tredoux555/guardian-connect`
- Branch: `main`
- Status: Connected/Active

If it shows "Not connected" or is missing, that's the problem!

## If You Can't Find Source Anywhere

Railway might have changed their UI. Try:

1. **Check the service's Deployments tab**
   - Look at the latest deployment
   - See if it shows which commit it's deploying from
   - If it's old, the connection is broken

2. **Manual Deploy Test**
   - Service → Deployments → Click "Deploy"
   - If it asks you to select a repository, the connection is broken
   - If it just deploys, the connection might be fine but auto-deploy is off

3. **Check GitHub Webhooks**
   - Go to: https://github.com/Tredoux555/guardian-connect/settings/hooks
   - Look for Railway webhook
   - If missing, that's the issue

## Quick Fix: Recreate Connection

If you find the source settings but it's disconnected:

1. Click "Connect GitHub Repo" or "Change Source"
2. Select: `guardian-connect` repository
3. Select branch: `main`
4. Save

This should restore auto-deploy.

