# Manual Railway Redeployment Guide

## If Auto-Deploy Isn't Working

Railway may not automatically detect GitHub pushes. Here's how to manually trigger a redeployment:

### Method 1: Railway Dashboard (Recommended)

1. **Go to Railway Dashboard**
   - Visit https://railway.app
   - Log in to your account
   - Open your `guardian-connect` project

2. **Select the Service**
   - Click on **Backend** service (or **Frontend** if that's what needs redeploying)
   - You should see the service details page

3. **Trigger Redeployment**
   - Look for the **"Deployments"** tab (usually at the top)
   - Click on **"Deployments"**
   - Find the latest deployment (should show commit `b18093d`)
   - Click the **"Redeploy"** button (three dots menu or direct button)
   - OR click **"Deploy"** button in the top right
   - Select **"Deploy Latest Commit"**

4. **Monitor the Build**
   - Watch the build logs in real-time
   - Check for any errors
   - Wait for "Build Successful" message

### Method 2: Railway CLI

If you have Railway CLI installed:

```bash
railway up
```

### Method 3: Check GitHub Connection

Railway might not be connected to your GitHub repo:

1. Go to Railway project settings
2. Check **"Source"** or **"Repository"** section
3. Verify it shows: `Tredoux555/guardian-connect`
4. If not connected:
   - Click **"Connect GitHub Repo"**
   - Select `guardian-connect` repository
   - Choose the branch (usually `main`)
   - Save

### Method 4: Force Redeploy via Settings

1. Go to your service in Railway
2. Click **"Settings"** tab
3. Scroll to **"Deploy"** section
4. Click **"Redeploy"** or **"Deploy Latest"**

### Troubleshooting

**If redeploy button is missing:**
- Check if you have the correct permissions
- Verify the service is active (not paused)
- Try refreshing the page

**If build keeps failing:**
- Check the build logs for errors
- Verify environment variables are set
- Check that the root directory is correct:
  - Backend: `backend`
  - Frontend: `web-user`

**If changes still don't appear:**
- Clear browser cache
- Check that the correct service is deployed
- Verify the commit hash matches what's in Railway

---

**Current Latest Commit:** `b18093d` - "Trigger Railway redeployment"

