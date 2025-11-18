# Deployment Notes

## ⚠️ IMPORTANT: Always Trigger Redeployment After Changes

Whenever you make **ANY** changes to the codebase (frontend or backend), you **MUST** trigger a redeployment in Railway.

### Why?
Railway doesn't automatically detect changes from your local machine. It only deploys when:
1. You push to GitHub (if connected to repo)
2. You manually trigger a redeployment
3. Railway detects changes in the connected repository

### How to Trigger Redeployment

#### Option 1: Push to GitHub (Recommended)
```bash
git add .
git commit -m "Your commit message"
git push origin main
```
Railway will automatically detect the push and redeploy.

#### Option 2: Manual Redeploy in Railway Dashboard
1. Go to your Railway project dashboard
2. Click on the service (Backend or Frontend)
3. Click the **"Redeploy"** button (usually in the top right or in the Deployments tab)
4. Select the latest deployment or commit
5. Click **"Redeploy"**

### When to Redeploy

**ALWAYS redeploy after:**
- ✅ Fixing TypeScript errors
- ✅ Updating environment variables
- ✅ Changing configuration files
- ✅ Modifying source code
- ✅ Updating dependencies
- ✅ Changing build settings

### Quick Checklist

Before considering deployment complete:
- [ ] Code changes committed
- [ ] Changes pushed to GitHub (or manual redeploy triggered)
- [ ] Railway build started
- [ ] Build completed successfully
- [ ] Service is running and accessible

### Troubleshooting

If changes aren't appearing:
1. Check Railway deployment logs for errors
2. Verify the latest commit is deployed
3. Clear browser cache (for frontend changes)
4. Check environment variables are set correctly
5. Verify the correct service is being redeployed

---

**Remember: Code changes on your local machine ≠ Changes on Railway!**

