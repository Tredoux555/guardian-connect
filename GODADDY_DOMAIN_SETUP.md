# GoDaddy Domain Setup Guide

## Step 1: Get Your Domain Ready

**What domain do you have?** (e.g., `guardianconnect.com`)

Once you provide it, I'll update all the configuration files.

## Step 2: DNS Configuration in GoDaddy

### Recommended Setup (Subdomains):

1. **Login to GoDaddy:**
   - Go to https://dcc.godaddy.com
   - Click on your domain
   - Go to "DNS" or "Manage DNS"

2. **Add DNS Records:**

   **For Backend API:**
   ```
   Type: A or CNAME
   Name: api
   Value: [Your hosting provider IP or URL]
   TTL: 600 (10 minutes)
   ```

   **For Web App (optional):**
   ```
   Type: A or CNAME
   Name: app
   Value: [Your hosting provider IP or URL]
   TTL: 600
   ```

   **For Admin Panel (optional):**
   ```
   Type: A or CNAME
   Name: admin
   Value: [Your hosting provider IP or URL]
   TTL: 600
   ```

### If Using Root Domain:
```
Type: A or CNAME
Name: @
Value: [Your hosting provider IP or URL]
TTL: 600
```

## Step 3: Where is Your Backend Hosted?

**Options:**
- **Railway** - Provides a `.railway.app` URL
- **Render** - Provides a `.onrender.com` URL
- **Fly.io** - Provides a `.fly.dev` URL
- **AWS/Heroku** - Custom setup
- **Other** - Let me know

**For Railway/Render/Fly.io:**
- Use **CNAME** record pointing to their URL
- Example: `api.yourdomain.com` → `your-app.railway.app`

**For Custom Server:**
- Use **A** record pointing to IP address
- Example: `api.yourdomain.com` → `123.45.67.89`

## Step 4: SSL Certificate

Most hosting platforms provide automatic SSL:
- ✅ **Railway** - Automatic SSL with custom domain
- ✅ **Render** - Automatic SSL with custom domain
- ✅ **Fly.io** - Automatic SSL with custom domain
- ✅ **Cloudflare** - Free SSL (if using Cloudflare DNS)

## Step 5: Configuration Updates Needed

Once you provide your domain, I'll update:

1. ✅ `mobile/lib/config/app_config.dart` - Mobile app API URL
2. ✅ `web-user` - Environment variable for API URL
3. ✅ `backend/src/server.ts` - CORS settings
4. ✅ DNS setup instructions

## Quick Start

**Just tell me:**
1. Your domain name (e.g., `guardianconnect.com`)
2. Where your backend is hosted (Railway, Render, etc.)
3. The hosting URL or IP address

Then I'll update everything for you!





