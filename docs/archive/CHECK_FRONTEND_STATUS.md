# How to Check if Your Frontend is Active

## 🔍 Step 1: Find Your Frontend Service

1. **Go to Railway Dashboard**
   - Open: https://railway.app
   - Make sure you're logged in

2. **Navigate to Your Project**
   - Click **"Projects"** in the left sidebar (or top navigation)
   - Click on **"guardian-connect"** project
   - You should see a list of services

3. **Look for Frontend Service**
   - You should see services like:
     - **"backend"** (or similar name)
     - **"web-user"** or **"frontend"** (this is what we're looking for)
     - **PostgreSQL** (database)

## ✅ Step 2: Check Service Status

### If You See a Frontend Service:

1. **Click on the frontend service** (e.g., "web-user" or "frontend")

2. **Check the Status:**
   - Look at the top of the service page
   - Status should be:
     - ✅ **"Active"** or **"Running"** = Good!
     - ⚠️ **"Building"** = Still deploying, wait a minute
     - ❌ **"Crashed"** or **"Failed"** = Problem, check logs
     - ⏸️ **"Stopped"** = Not running, needs to be started

3. **Check Deployments:**
   - Click **"Deployments"** tab
   - Look for the latest deployment
   - Should show:
     - ✅ **"Active"** = Currently running
     - ⚠️ **"Building"** = In progress
     - ❌ **"Failed"** = Build error, check logs

4. **Check Logs:**
   - Click **"Logs"** tab
   - Look for errors (red text)
   - Should see: "Listening on port..." or similar success message

5. **Check Domain/URL:**
   - Click **"Settings"** tab
   - Scroll to **"Domains"** or **"Public Networking"** section
   - Do you see a URL? (e.g., `https://xxx.up.railway.app`)
     - ✅ **Yes** = Service has a URL, you can access it!
     - ❌ **No** = Need to generate a domain (see Step 3 below)

### If You DON'T See a Frontend Service:

**You need to create it!** Follow these steps:

1. **In your Railway project**, click **"+ New"** button (top right)
2. Select **"GitHub Repo"**
3. Choose **"guardian-connect"** repository
4. Railway will create a new service
5. **IMPORTANT:** Set Root Directory:
   - Click on the new service
   - Go to **"Settings"** tab
   - Find **"Root Directory"** field
   - Type: `web-user`
   - Click **"Update"**
6. Railway will automatically redeploy

## 🌐 Step 3: Generate Domain (If Missing)

If your frontend service doesn't have a URL:

1. **Go to Frontend Service** → **"Settings"** tab
2. Scroll to **"Public Networking"** or **"Domains"** section
3. Click **"Generate Domain"** button
4. Leave port as default (or enter `3003`)
5. Click **"Generate Domain"**
6. **Copy the URL** - this is your frontend app URL!

## 🔧 Step 4: Check Environment Variables

Your frontend needs to know where the backend is:

1. **Go to Frontend Service** → **"Variables"** tab
2. Look for: `VITE_API_URL`
   - ✅ **Exists** = Good! Check if it's correct (see below)
   - ❌ **Missing** = Need to add it (see below)

### If VITE_API_URL is Missing:

1. **Get your Backend URL first:**
   - Go to **Backend Service** → **"Settings"** → **"Domains"**
   - Copy the backend URL (e.g., `https://xxx.up.railway.app`)

2. **Add to Frontend:**
   - Frontend Service → **"Variables"** tab
   - Click **"New Variable"**
   - **Name:** `VITE_API_URL`
   - **Value:** `https://your-backend-url.railway.app/api`
     - Replace `your-backend-url` with your actual backend URL
   - Click **"Save"**
   - Railway will redeploy automatically

### If VITE_API_URL Exists:

1. **Check if it's correct:**
   - Should be: `https://your-backend-url.railway.app/api`
   - Should NOT be: `http://localhost:3001/api` (this is wrong for production)
2. **If wrong, update it:**
   - Click the variable
   - Update the value
   - Save

## 🧪 Step 5: Test Your Frontend

1. **Get your Frontend URL:**
   - Frontend Service → **"Settings"** → **"Domains"**
   - Copy the URL

2. **Open in Browser:**
   - Paste the URL in your browser
   - Press Enter

3. **What You Should See:**
   - ✅ **Login/Registration page** = Frontend is working!
   - ❌ **Error page** or **blank page** = Problem, check logs
   - ❌ **"Cannot connect"** = Service might be stopped

## 🐛 Troubleshooting

### Frontend Service Shows "Crashed" or "Failed"

1. **Check Logs:**
   - Click **"Logs"** tab
   - Look for error messages
   - Common issues:
     - Build errors (TypeScript, missing files)
     - Port conflicts
     - Missing environment variables

2. **Check Build Logs:**
   - Click **"Deployments"** tab
   - Click on the failed deployment
   - Look at build logs for errors

### Frontend URL Shows Error

1. **Check if service is running:**
   - Service status should be "Active"

2. **Check environment variables:**
   - Make sure `VITE_API_URL` is set correctly

3. **Check browser console:**
   - Open browser DevTools (F12)
   - Look for errors in Console tab
   - Look for network errors in Network tab

### Can't Find Frontend Service

- You might need to create it (see "If You DON'T See a Frontend Service" above)
- Or it might have a different name - look for any service that's not "backend" or "PostgreSQL"

## 📋 Quick Checklist

- [ ] Frontend service exists in Railway project
- [ ] Service status is "Active" or "Running"
- [ ] Latest deployment is "Active"
- [ ] Service has a domain/URL generated
- [ ] `VITE_API_URL` environment variable is set
- [ ] `VITE_API_URL` points to backend URL (not localhost)
- [ ] Frontend URL opens in browser
- [ ] Login/Registration page appears

---

**Once all checkboxes are ✅, your frontend is active and ready to use!**

