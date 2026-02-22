# Fix Auto-Deploy After Service Rename

## The Issue

You renamed the service from "overflowing-reprieve" to "backend" in Railway. This may have disconnected the GitHub webhook connection.

## Solution: Reconnect GitHub Repository

### Step 1: Verify GitHub Connection
1. In Railway → Project Settings → **Source** (or **Repository**)
2. Check if it shows: `Tredoux555/guardian-connect`
3. If it shows "Not connected" or is missing, proceed to Step 2

### Step 2: Reconnect GitHub Repo
1. In Railway → Project Settings → **Source**
2. Click **"Connect GitHub Repo"** or **"Change Source"**
3. Select your repository: `guardian-connect`
4. Select branch: `main`
5. Click **"Connect"** or **"Save"**

### Step 3: Verify Webhook in GitHub
1. Go to: https://github.com/Tredoux555/guardian-connect/settings/hooks
2. Look for Railway webhook
3. Should show:
   - Status: **Active** (green)
   - Events: **push** (checked)
   - Recent deliveries should show successful requests

### Step 4: Test Auto-Deploy
1. Make a small change and push to GitHub
2. Railway should automatically detect and deploy
3. Check Deployments tab - should see new deployment starting

## Alternative: Check Service-Level Settings

If project-level connection is fine, check the service:

1. Go to **Backend** service → **Settings**
2. Look for **"Source"** or **"Repository"** section
3. Verify it's connected to the same repo
4. Check for any "Auto Deploy" or deployment settings

## Quick Test: Manual Deploy

To verify everything works:
1. Railway → Backend service → **Deployments** tab
2. Click **"Deploy"** → **"Deploy Latest Commit"**
3. This should work even if auto-deploy is broken
4. If manual deploy works, the issue is just the webhook connection

## Why This Happens

When you rename a service in Railway:
- The service name changes
- But the GitHub webhook might still reference the old name
- Or the connection might need to be refreshed
- Railway may need to re-establish the webhook

## After Reconnecting

Once reconnected:
- Railway will create a new webhook in GitHub
- Auto-deploy should work again
- Future pushes will trigger deployments automatically

---

**Most likely fix:** Reconnect the GitHub repository in Railway Project Settings → Source

