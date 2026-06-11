# How to Create Frontend Service in Railway

## ✅ Current Situation

You have:
- ✅ **Backend service** deployed (this is good!)
- ❌ **Frontend service** - needs to be created

## 🚀 Step-by-Step: Create Frontend Service

### Step 1: Go to Your Project

1. In Railway, make sure you're in your **"guardian-connect"** project
2. You should see your backend service (e.g., "overflowing-reprieve")

### Step 2: Create New Service

1. Look for a **"+ New"** button (usually top right, or in the Architecture view)
2. **Click "+ New"**
3. A menu will appear with options

### Step 3: Select GitHub Repo

1. In the menu, click **"GitHub Repo"** or **"Deploy from GitHub repo"**
2. You'll see a list of your repositories
3. **Click "guardian-connect"** (same repository as backend)

### Step 4: Set Root Directory (IMPORTANT!)

1. Railway will create a new service
2. **Click on the new service** that was created
3. Go to **"Settings"** tab
4. Scroll to **"Root Directory"** field
5. **Type exactly:** `web-user` (no quotes, no slashes)
6. Click **"Update"** or **"Save"**
7. Railway will automatically redeploy

### Step 5: Add Environment Variables

1. Still in the frontend service → Go to **"Variables"** tab
2. Click **"New Variable"**
3. Add this variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://your-backend-url.railway.app/api`
   - (Replace `your-backend-url` with your actual backend URL from Step 6 below)

### Step 6: Get Your Backend URL (for Step 5)

1. Go to your **backend service** (e.g., "overflowing-reprieve")
2. Go to **"Settings"** tab
3. Scroll to **"Public Networking"** section
4. Click **"Generate Domain"**
5. Enter port: `3001`
6. Click **"Generate Domain"**
7. **Copy the URL** (e.g., `https://xxx.up.railway.app`)
8. Use this URL in Step 5 above

### Step 7: Generate Frontend Domain

1. Go back to your **frontend service**
2. Go to **"Settings"** tab
3. Scroll to **"Public Networking"** section
4. Click **"Generate Domain"**
5. Enter port: `3003` (or leave default)
6. Click **"Generate Domain"**
7. **Copy the URL** - this is your app URL!

## 📋 Summary

You need **TWO services** in Railway:

1. **Backend Service:**
   - Root Directory: `backend`
   - Port: `3001`
   - Provides API

2. **Frontend Service:**
   - Root Directory: `web-user`
   - Port: `3003` (or default)
   - Shows your app UI
   - Needs `VITE_API_URL` pointing to backend

## ✅ Quick Checklist

- [ ] Backend service created (you have this)
- [ ] Backend Root Directory set to `backend`
- [ ] Backend URL generated
- [ ] Frontend service created
- [ ] Frontend Root Directory set to `web-user`
- [ ] Frontend `VITE_API_URL` set to backend URL
- [ ] Frontend URL generated

---

**Next:** Click "+ New" in Railway to create your frontend service!

