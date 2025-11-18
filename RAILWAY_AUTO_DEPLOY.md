# Railway Auto-Deployment

## ✅ Automatic Redeployment

Railway automatically redeploys your services when you push changes to GitHub.

### How It Works

1. **Make changes** to your code
2. **Commit and push** to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. **Railway detects** the push automatically
4. **Railway redeploys** your services automatically
5. **No manual trigger needed!**

### What Triggers Redeployment

- ✅ Pushing to the `main` branch (or your configured branch)
- ✅ Merging a pull request
- ✅ Any git push to the connected repository

### What Does NOT Trigger Redeployment

- ❌ Local commits (must push to GitHub)
- ❌ Changes to files not in git
- ❌ Environment variable changes (these update without redeploy)

### Manual Redeployment

If you need to manually trigger a redeployment:

1. Go to Railway dashboard
2. Click on your service
3. Go to **"Deployments"** tab
4. Click **"Redeploy"** button (if available)
5. Or make a small change and push to GitHub

### Best Practices

- **Test locally first** before pushing
- **Use meaningful commit messages** to track changes
- **Check deployment logs** after each push
- **Monitor for errors** in Railway dashboard

### Environment Variables

- Changing environment variables in Railway dashboard **does NOT** require a redeploy
- Environment variables are updated immediately
- Services restart automatically when env vars change

### Database Migrations

- Database migrations should be run manually or via deployment scripts
- Use Railway CLI: `railway run npm run migrate`
- Or add to deployment process

---

**Note**: Railway watches your GitHub repository and automatically redeploys on every push to the main branch.

