# Railway Deployment - Complete Step-by-Step Guide

## ✅ Pre-Deployment Checklist

- [x] GitHub repository: https://github.com/Tredoux555/guardian-connect
- [x] Code pushed to GitHub
- [x] Railway configuration files created
- [x] JWT secrets generated
- [x] Environment variable templates ready

## 🚀 STEP 1: Sign Up / Log In to Railway

1. Go to: **https://railway.app**
2. Click **"Login"** or **"Start a New Project"**
3. Click **"Login with GitHub"**
4. Authorize Railway to access your GitHub account
5. You'll be taken to the Railway dashboard

---

## 🚀 STEP 2: Create New Project

1. In Railway dashboard, click **"+ New Project"** (top right)
2. Select **"Deploy from GitHub repo"**
3. You'll see a list of your repositories
4. Find and click: **`guardian-connect`**
5. Railway will create a new project and start analyzing your repo

---

## 🚀 STEP 3: Deploy Backend Service

### 3.1 Create Backend Service

1. In your Railway project, you'll see Railway trying to deploy
2. **IMPORTANT**: Click on the service that was created
3. Go to **"Settings"** tab
4. Scroll down to **"Root Directory"**
5. Enter: **`backend`**
6. Click **"Save"** or **"Update"**
7. Railway will automatically redeploy

### 3.2 Add PostgreSQL Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"**
3. Click **"Add PostgreSQL"**
4. Railway will create a PostgreSQL database
5. **Note the database service name** (e.g., "Postgres")

### 3.3 Link Database to Backend

1. Go back to your **backend service**
2. Click **"Variables"** tab
3. You should see Railway has automatically added database variables:
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`
4. If not automatically added, click **"New Variable"** and Railway will show you database connection options

### 3.4 Add Environment Variables

1. Still in backend service → **"Variables"** tab
2. Click **"New Variable"** for each variable below
3. Copy from `RAILWAY_ENV_BACKEND.txt`:

**Required Variables:**
```
NODE_ENV=production
PORT=3001
JWT_SECRET=61bf5370182a805f83f0d6bf87d8d889b11bbcb18835fd6dc7d37556b6ad88dd
JWT_REFRESH_SECRET=9c02d547c65ce680382ddb6de36a1f22834edfb5a934340f7f9b1e483527b19b
ALLOWED_ORIGINS=https://your-frontend-url.railway.app
```

**Database Variables (Railway should auto-add these, but if not):**
- Click **"New Variable"** → Railway will show **"Reference Variable"** option
- Select your PostgreSQL service
- Add: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

**Optional Variables (add if you have them):**
```
VITE_GOOGLE_MAPS_API_KEY=your-key
STRIPE_SECRET_KEY=your-key
STRIPE_PUBLISHABLE_KEY=your-key
VAPID_PUBLIC_KEY=your-key
VAPID_PRIVATE_KEY=your-key
VAPID_SUBJECT=your-email@example.com
APP_URL=https://your-backend-url.railway.app
```

### 3.5 Generate Backend Domain

1. Go to backend service → **"Settings"** tab
2. Scroll to **"Domains"** section
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `https://guardian-backend-production.up.railway.app`)
5. **Save this URL** - you'll need it for frontend configuration

### 3.6 Run Database Migrations

1. Go to backend service → **"Deployments"** tab
2. Wait for deployment to complete (green checkmark)
3. Click on the latest deployment
4. Click **"View Logs"** to see if migrations ran
5. If migrations didn't run automatically:
   - Go to backend service → **"Settings"** → **"Deploy"**
   - Or use Railway CLI (if installed):
     ```bash
     railway run npm run migrate
     ```

---

## 🚀 STEP 4: Deploy Frontend Service

### 4.1 Create Frontend Service

1. In your Railway project, click **"+ New"**
2. Select **"GitHub Repo"**
3. Select: **`guardian-connect`** (same repo)
4. Railway will create a new service
5. **IMPORTANT**: Click on the new service
6. Go to **"Settings"** tab
7. Scroll to **"Root Directory"**
8. Enter: **`web-user`**
9. Click **"Save"**
10. Railway will automatically redeploy

### 4.2 Configure Frontend Build

1. Go to frontend service → **"Settings"** tab
2. Scroll to **"Build Command"** (if visible)
3. Should be: `npm install && npm run build`
4. Scroll to **"Start Command"**
5. Should be: `npx serve -s dist -l $PORT`
6. If not set, Railway should auto-detect from `web-user/railway.json`

### 4.3 Add Frontend Environment Variables

1. Go to frontend service → **"Variables"** tab
2. Click **"New Variable"** for each:

**Required (update with your backend URL):**
```
VITE_API_URL=https://your-backend-url.railway.app/api
```

**Replace `your-backend-url.railway.app` with the actual backend URL from Step 3.5!**

**Optional (add if you have them):**
```
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
VITE_ENABLE_DONATIONS=true
VITE_ENABLE_SUBSCRIPTIONS=true
```

### 4.4 Generate Frontend Domain

1. Go to frontend service → **"Settings"** tab
2. Scroll to **"Domains"** section
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `https://guardian-frontend-production.up.railway.app`)
5. **Save this URL**

### 4.5 Update Backend CORS

1. Go back to **backend service** → **"Variables"** tab
2. Find `ALLOWED_ORIGINS` variable
3. Click to edit
4. Update to your frontend URL:
   ```
   https://your-frontend-url.railway.app
   ```
5. Replace `your-frontend-url.railway.app` with the actual frontend URL from Step 4.4
6. Save - Railway will automatically redeploy backend

---

## 🚀 STEP 5: Test Your Deployment

### 5.1 Test Frontend

1. Open your frontend URL in a browser
2. You should see the login page
3. Try registering a new user
4. Try logging in

### 5.2 Test Backend API

1. Your backend URL should show: `{"message":"Guardian Connect API",...}`
2. Test endpoint: `https://your-backend-url.railway.app/api/health` (if exists)

### 5.3 Test Full Flow

1. Register a new user
2. Create an emergency
3. Test geolocation (should work on HTTPS!)
4. Test real-time features

---

## 🔧 Troubleshooting

### Backend won't build?
- Check Root Directory is set to `backend`
- Check build logs in Railway dashboard
- Verify `backend/package.json` exists

### Frontend won't build?
- Check Root Directory is set to `web-user`
- Check build logs
- Verify `web-user/package.json` exists

### Database connection fails?
- Verify PostgreSQL service is added
- Check database variables are set
- Check Railway automatically linked the database

### CORS errors?
- Verify `ALLOWED_ORIGINS` includes your frontend URL
- Make sure it's the exact URL (with https://)
- Redeploy backend after updating CORS

### Frontend can't connect to backend?
- Verify `VITE_API_URL` is set correctly
- Should be: `https://your-backend-url.railway.app/api`
- Check backend is running (green status in Railway)

---

## 📝 Quick Reference

**Backend URL:** `https://your-backend-url.railway.app`  
**Frontend URL:** `https://your-frontend-url.railway.app`  
**Database:** Automatically managed by Railway

**Environment Variable Files:**
- Backend: `RAILWAY_ENV_BACKEND.txt`
- Frontend: `RAILWAY_ENV_FRONTEND.txt`

---

## ✅ Deployment Complete!

Once both services are deployed and working:
- ✅ Your app is live on HTTPS
- ✅ Geolocation will work on mobile
- ✅ Database is managed by Railway
- ✅ Automatic deployments on git push

**Next Steps:**
- Set up custom domains (optional)
- Configure file storage (S3/Cloudinary for uploads)
- Set up monitoring and alerts

---

**Need Help?** Check Railway logs in the dashboard for detailed error messages!

