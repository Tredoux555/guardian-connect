# Railway Deployment - Step by Step

## ✅ Step 1: GitHub Setup - COMPLETE!

- ✅ Repository created: https://github.com/Tredoux555/guardian-connect
- ✅ Code pushed to GitHub
- ✅ Ready for Railway deployment

## 🚀 Step 2: Deploy to Railway

### 2.1 Sign Up / Log In to Railway

1. Go to: https://railway.app
2. Click "Login" or "Start a New Project"
3. Sign in with GitHub (use your GitHub account: Tredoux555)
4. Authorize Railway to access your GitHub repositories

### 2.2 Create New Project

1. In Railway dashboard, click **"+ New Project"**
2. Select **"Deploy from GitHub repo"**
3. Find and select: **`Tredoux555/guardian-connect`**
4. Railway will create a new project

### 2.3 Deploy Backend First

1. Railway will detect your repository
2. Click **"+ New"** → **"GitHub Repo"**
3. Select your repository again
4. In the service settings:
   - **Root Directory**: `backend`
   - Railway will auto-detect Node.js

5. **Add PostgreSQL Database:**
   - Click **"+ New"** in your project
   - Select **"Database"** → **"Add PostgreSQL"**
   - Railway will create the database automatically

6. **Configure Environment Variables:**
   - Go to your backend service → **"Variables"** tab
   - Add these variables (Railway provides database vars automatically):

```env
NODE_ENV=production
PORT=3001

# Database - Railway provides these automatically:
# DB_HOST=${{Postgres.PGHOST}}
# DB_PORT=${{Postgres.PGPORT}}
# DB_NAME=${{Postgres.PGDATABASE}}
# DB_USER=${{Postgres.PGUSER}}
# DB_PASSWORD=${{Postgres.PGPASSWORD}}

# JWT Secrets - GENERATE NEW ONES!
# Run this locally: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<paste-generated-secret-here>
JWT_REFRESH_SECRET=<paste-another-generated-secret-here>

# CORS - Update after frontend is deployed
ALLOWED_ORIGINS=https://your-frontend-url.railway.app

# Google Maps (if you have it)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Stripe (if using)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# VAPID Keys (if using Web Push)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=your-email@example.com

# App URL - Update after deployment
APP_URL=https://your-backend-url.railway.app
```

7. **Generate Domain:**
   - Go to backend service → **"Settings"** → **"Generate Domain"**
   - Copy the URL (e.g., `https://guardian-backend-production.up.railway.app`)

8. **Run Database Migrations:**
   - Go to backend service → **"Deployments"** tab
   - Click on the latest deployment → **"View Logs"**
   - Or use Railway CLI:
     ```bash
     railway run npm run migrate
     ```

### 2.4 Deploy Frontend

1. In the same Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select your repository again
3. In service settings:
   - **Root Directory**: `web-user`
   - Railway will auto-detect Vite/React

4. **Configure Build Settings:**
   - Build Command: `npm install && npm run build`
   - Start Command: `npx serve -s dist -l $PORT`
   - Or use Railway's static file serving (check "Serve Static Files")

5. **Add Environment Variables:**
   ```env
   VITE_API_URL=https://your-backend-url.railway.app/api
   VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
   VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
   ```

6. **Generate Domain:**
   - Go to frontend service → **"Settings"** → **"Generate Domain"**
   - Copy the URL (e.g., `https://guardian-frontend-production.up.railway.app`)

7. **Update Backend CORS:**
   - Go back to backend service → **"Variables"**
   - Update `ALLOWED_ORIGINS` with your frontend URL:
     ```
     ALLOWED_ORIGINS=https://your-frontend-url.railway.app
     ```
   - Redeploy backend (Railway auto-redeploys when vars change)

### 2.5 Test Your Deployment

1. Open your frontend URL in a browser
2. Test login/registration
3. Test emergency creation
4. Verify geolocation works (should work on HTTPS!)

## 📝 Quick Reference

**Backend URL:** `https://your-backend-url.railway.app`  
**Frontend URL:** `https://your-frontend-url.railway.app`  
**Database:** Automatically managed by Railway

## 🔧 Generate JWT Secrets

Run this locally to generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice to get two different secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`.

## ⚠️ Important Notes

- Railway provides database connection strings automatically
- Use `${{Postgres.PGHOST}}` format for database vars (Railway will replace them)
- Frontend needs to know backend URL via `VITE_API_URL`
- Backend needs to allow frontend URL in `ALLOWED_ORIGINS`
- File uploads: Consider using Railway volumes or S3/Cloudinary for production

## 🆘 Troubleshooting

- **Build fails?** Check build logs in Railway dashboard
- **Database connection fails?** Verify database vars are set correctly
- **CORS errors?** Make sure `ALLOWED_ORIGINS` includes your frontend URL
- **Frontend can't connect?** Verify `VITE_API_URL` is set correctly

---

**Ready to deploy?** Go to https://railway.app and follow the steps above!

