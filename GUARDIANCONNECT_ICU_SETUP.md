# Guardian Connect Domain Setup - guardianconnect.icu

## ✅ Configuration Updated

I've updated the following files:

1. ✅ **Mobile App** - `mobile/lib/config/app_config.dart`
   - API URL: `https://api.guardianconnect.icu`
   - Socket URL: `https://api.guardianconnect.icu`

2. ✅ **Backend CORS** - `backend/src/server.ts`
   - Added: `https://app.guardianconnect.icu`
   - Added: `https://admin.guardianconnect.icu`
   - Added: `https://guardianconnect.icu`

## 📋 DNS Configuration in GoDaddy

### Step 1: Login to GoDaddy

1. Go to https://dcc.godaddy.com
2. Click on **guardianconnect.icu**
3. Click **DNS** or **Manage DNS**

### Step 2: Add DNS Records

#### For Backend API (Required):

```
Type: A or CNAME
Name: api
Value: [Your hosting provider IP or URL]
TTL: 600 (10 minutes)
```

**If using Railway:**
- Type: **CNAME**
- Name: `api`
- Value: `your-app-name.railway.app` (your Railway URL)
- TTL: 600

**If using Render:**
- Type: **CNAME**
- Name: `api`
- Value: `your-app-name.onrender.com`
- TTL: 600

**If using Fly.io:**
- Type: **CNAME**
- Name: `api`
- Value: `your-app-name.fly.dev`
- TTL: 600

**If using custom server:**
- Type: **A**
- Name: `api`
- Value: `123.45.67.89` (your server IP)
- TTL: 600

#### For Web App (Optional):

```
Type: A or CNAME
Name: app
Value: [Your web app hosting URL]
TTL: 600
```

#### For Admin Panel (Optional):

```
Type: A or CNAME
Name: admin
Value: [Your admin panel hosting URL]
TTL: 600
```

## ✅ Backend is on Railway!

Since your backend is hosted on Railway, here's the exact setup:

### Step 1: Get Your Railway URL

1. Go to https://railway.app
2. Click on your project
3. Click on your backend service
4. Go to **Settings** → **Domains**
5. Copy the Railway URL (e.g., `your-backend-name.railway.app`)

### Step 2: Add Custom Domain in Railway

1. In Railway (Settings → Domains)
2. Click **"Add Custom Domain"**
3. Enter: `api.guardianconnect.icu`
4. Railway will provision SSL automatically

### Step 3: Add DNS Record in GoDaddy

**In GoDaddy DNS Manager:**
- Type: **CNAME**
- Name: `api`
- Value: `[Your Railway URL from Step 1]`
- TTL: `600`

**Example:**
```
Type: CNAME
Name: api
Value: guardian-backend-production.up.railway.app
TTL: 600
```

## 🔒 SSL Certificate Setup

### If Using Railway:
1. Go to your Railway project
2. Click on your backend service
3. Go to **Settings** → **Domains**
4. Add custom domain: `api.guardianconnect.icu`
5. Railway will automatically provision SSL certificate

### If Using Render:
1. Go to your Render dashboard
2. Click on your service
3. Go to **Settings** → **Custom Domains**
4. Add: `api.guardianconnect.icu`
5. Render will automatically provision SSL

### If Using Fly.io:
1. Run: `flyctl domains add api.guardianconnect.icu`
2. Fly.io will automatically provision SSL

### If Using Custom Server:
- Use **Let's Encrypt** (free)
- Or **Cloudflare** (free SSL + CDN)

## 📱 Mobile App Build

After DNS is configured, rebuild your mobile app:

```bash
cd mobile

# For iOS
flutter build ios --dart-define=API_BASE_URL=https://api.guardianconnect.icu --dart-define=INCLUDE_NGROK_HEADERS=false

# For Android
flutter build apk --dart-define=API_BASE_URL=https://api.guardianconnect.icu --dart-define=INCLUDE_NGROK_HEADERS=false
```

Or update the default in `app_config.dart` (already done ✅).

## 🌐 Web User App

Set environment variable in your hosting platform:

**For Railway:**
- Variable: `VITE_API_URL`
- Value: `https://api.guardianconnect.icu/api`

**For Render:**
- Variable: `VITE_API_URL`
- Value: `https://api.guardianconnect.icu/api`

## ✅ Testing

After DNS propagates (can take 5 minutes to 48 hours):

1. **Test API:**
   ```bash
   curl https://api.guardianconnect.icu/api/health
   ```

2. **Test from mobile app:**
   - Rebuild app
   - Check logs for: `📱 App Configuration:`
   - Should show: `API Base URL: https://api.guardianconnect.icu`

3. **Test from web app:**
   - Check browser console
   - Should show: `API Base URL: https://api.guardianconnect.icu/api`

## 🎯 Next Steps

1. **Tell me where your backend is hosted** (Railway, Render, etc.)
2. **Add DNS records in GoDaddy** (I'll provide exact values)
3. **Configure SSL** (usually automatic)
4. **Rebuild mobile app** with new domain
5. **Set web-user environment variable**
6. **Test everything!**

## 📝 Current Status

- ✅ Mobile app configured for `api.guardianconnect.icu`
- ✅ Backend CORS updated for `guardianconnect.icu` domains
- ⏳ Waiting for: Backend hosting info to provide exact DNS values

