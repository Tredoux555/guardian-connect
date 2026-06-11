# Railway Deployment Fix

## ✅ Problem Solved

Railway was trying to build from the root directory, which contains multiple services. I've added configuration files to help Railway understand the project structure.

## 📋 What Was Added

1. **`backend/railway.json`** - Configuration for backend service
2. **`web-user/railway.json`** - Configuration for frontend service  
3. **`railway.toml`** - Root-level configuration
4. **Updated `web-user/package.json`** - Added start script for production

## 🚀 How to Deploy (Updated Steps)

### Step 1: Deploy Backend

1. In Railway dashboard, click **"+ New"** → **"GitHub Repo"**
2. Select: `Tredoux555/guardian-connect`
3. **IMPORTANT**: In service settings, set:
   - **Root Directory**: `backend`
4. Railway will now detect Node.js and use `backend/railway.json`
5. Add PostgreSQL database (click "+ New" → "Database" → "PostgreSQL")
6. Configure environment variables (see RAILWAY_DEPLOYMENT_STEPS.md)
7. Generate domain

### Step 2: Deploy Frontend

1. In the same Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select: `Tredoux555/guardian-connect` (same repo)
3. **IMPORTANT**: In service settings, set:
   - **Root Directory**: `web-user`
4. Railway will detect Vite/React and use `web-user/railway.json`
5. Configure environment variables:
   - `VITE_API_URL=https://your-backend-url.railway.app/api`
   - `VITE_GOOGLE_MAPS_API_KEY=your-key`
6. Generate domain

## ⚠️ Critical: Root Directory Setting

**You MUST set the Root Directory for each service:**

- **Backend service**: Root Directory = `backend`
- **Frontend service**: Root Directory = `web-user`

Without this, Railway will try to build from the root and fail.

## 📝 Where to Set Root Directory

1. Click on your service in Railway
2. Go to **"Settings"** tab
3. Scroll to **"Root Directory"**
4. Enter: `backend` or `web-user`
5. Save changes

## ✅ Files Pushed to GitHub

All configuration files have been committed and pushed to GitHub. Railway will automatically use them when you set the correct Root Directory.

---

**Next**: Go back to Railway, set the Root Directory for your service, and redeploy!

