# How to Access Your Deployed App

## 🚀 Getting Your URLs

### Step 1: Get Backend URL

1. Go to Railway dashboard: https://railway.app
2. Click on your **backend service**
3. Go to **"Settings"** tab
4. Scroll to **"Domains"** section
5. You'll see a URL like: `https://guardian-backend-production.up.railway.app`
6. **Copy this URL** - this is your backend API

### Step 2: Get Frontend URL

1. In the same Railway project
2. Click on your **frontend service** (or create one if you haven't)
3. Go to **"Settings"** tab
4. Scroll to **"Domains"** section
5. Click **"Generate Domain"** if you don't have one
6. You'll see a URL like: `https://guardian-frontend-production.up.railway.app`
7. **Copy this URL** - this is your frontend app

## 🌐 Accessing Your App

### Frontend (Web App)

1. **Open the frontend URL** in your browser
   - Example: `https://guardian-frontend-production.up.railway.app`
2. You should see the **login/registration page**
3. **Register a new account** or login
4. Start using the app!

### Backend API

1. **Open the backend URL** in your browser
   - Example: `https://guardian-backend-production.up.railway.app`
2. You should see a JSON response like:
   ```json
   {
     "message": "Guardian Connect API",
     "version": "1.0.0",
     "endpoints": {...}
   }
   ```

## 📱 Testing on Mobile

### Option 1: Use the Railway URL Directly

1. Open the frontend URL on your phone's browser
2. The app will work with HTTPS (geolocation will work!)
3. No need for ngrok anymore!

### Option 2: Share the URL

1. Copy the frontend URL
2. Send it to yourself via email/message
3. Open on your phone
4. Bookmark it for easy access

## 🔍 Quick Access Methods

### From Railway Dashboard

1. Go to your service
2. Click the **"..."** menu (three dots)
3. Select **"Open in Browser"** or **"View"**
4. Opens directly in your browser

### From Service Overview

1. In Railway project dashboard
2. Each service shows its URL
3. Click the URL to open it

## ✅ What to Expect

### First Time Access

- **Frontend**: Login/Registration page
- **Backend**: API information JSON
- **HTTPS**: Secure connection (green lock icon)
- **Fast**: Railway's CDN makes it fast globally

### After Login

- Full app functionality
- Geolocation works (HTTPS enabled!)
- Real-time features work
- All features available

## 🔧 Troubleshooting

### Can't see the app?

1. **Check deployment status:**
   - Go to "Deployments" tab
   - Make sure latest deployment is "Active" (green)

2. **Check service is running:**
   - Service should show "Running" status
   - Check logs for any errors

3. **Verify URLs:**
   - Backend URL should show API info
   - Frontend URL should show login page

### Getting errors?

1. **Check environment variables:**
   - Make sure `VITE_API_URL` is set in frontend
   - Make sure `ALLOWED_ORIGINS` includes frontend URL in backend

2. **Check CORS:**
   - Backend must allow frontend URL
   - Update `ALLOWED_ORIGINS` if needed

3. **Check database:**
   - Make sure PostgreSQL is running
   - Check database connection in logs

## 📝 Custom Domain (Optional)

You can add a custom domain later:

1. Go to service → Settings → Domains
2. Click "Custom Domain"
3. Add your domain
4. Follow DNS setup instructions

---

**Your app is live! Just copy the URLs from Railway and open them in your browser!**

