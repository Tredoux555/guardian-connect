# How to Manually Deploy in Railway - Step by Step

## Step-by-Step Instructions

### Step 1: Navigate to Your Backend Service
1. Go to https://railway.app
2. Log in to your account
3. Click on your **"guardian-connect"** project
4. You should see the **Architecture** view with your services
5. **Click on the "backend" service card** (the box/rectangle showing your backend service)
   - This opens the service details page

### Step 2: Go to Deployments Tab
1. At the top of the service page, you'll see tabs:
   - **Deployments** ← Click this one
   - Variables
   - Metrics
   - Settings
2. Click on **"Deployments"** tab

### Step 3: Find the Deploy Button
1. On the Deployments page, look for:
   - A **"Deploy"** button (usually purple/blue, top right)
   - OR a **"Redeploy"** button
   - OR three dots (⋯) menu with "Deploy" option
2. Click the **"Deploy"** button

### Step 4: Select Commit to Deploy
After clicking "Deploy", you'll see options:

**Option A: "Deploy Latest Commit"**
- If you see this option, click it
- This will deploy the most recent commit from GitHub

**Option B: Commit Selection**
- You might see a list of commits
- Look for commit `253fc2c` or the most recent one
- It should show: "Test auto-deploy - verify Railway detects GitHub pushes"
- Click on that commit to select it
- Then click "Deploy" or "Deploy Selected"

**Option C: Branch Selection**
- You might need to select a branch first
- Select **"main"** branch
- Then select the commit
- Then click "Deploy"

### Step 5: Monitor the Deployment
1. After clicking deploy, you'll see a new deployment starting
2. Watch the build logs in real-time
3. You should see:
   - "Building..." or "Deploying..."
   - Build steps running
   - Eventually "Build Successful" or "Deployed"

## Visual Guide

```
Railway Dashboard
  └── guardian-connect (project)
      └── Architecture View
          └── [Backend Service Card] ← Click here
              └── Service Details Page
                  └── [Deployments Tab] ← Click here
                      └── [Deploy Button] ← Click here
                          └── Select Commit → Deploy
```

## What You Should See

### On Deployments Page:
- List of previous deployments
- Each deployment shows:
  - Commit hash (like `253fc2c`)
  - Commit message
  - Status (Success/Failed/Deploying)
  - Timestamp

### When You Click Deploy:
- Modal/popup appears
- Shows list of commits from GitHub
- Latest commit should be at the top
- Shows commit message and hash

### During Deployment:
- Build logs appear
- Shows progress: "Installing dependencies", "Building", "Starting"
- Eventually shows "Deployed" or "Build Successful"

## Troubleshooting

### Can't Find Deploy Button?
- Make sure you're in the **Deployments** tab (not Variables or Metrics)
- Try refreshing the page
- Check if you have the correct permissions

### No Commits Showing?
- Railway might not be connected to GitHub
- Check if you can see any previous deployments
- If no deployments show, the connection might be broken

### Deployment Fails?
- Check the build logs for errors
- Look for red error messages
- Common issues:
  - Build errors (TypeScript, missing files)
  - Environment variables missing
  - Port conflicts

## Alternative: Use Three Dots Menu

If you don't see a "Deploy" button:
1. Look for three dots (⋯) or a menu icon
2. Click it
3. Select "Deploy" or "Redeploy" from the menu
4. Follow the same steps to select a commit

## Quick Test

To verify manual deploy works:
1. Follow steps above
2. Deploy commit `253fc2c`
3. Watch the build logs
4. If it succeeds, manual deploy is working!
5. You can use this method until auto-deploy is fixed

---

**Note:** Manual deploy works even if auto-deploy is broken. This is a reliable workaround until the GitHub webhook is reconnected.

