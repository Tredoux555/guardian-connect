# Domain Setup Guide

## Overview

This guide will help you configure your Guardian Connect app to use your custom domain instead of ngrok.

## Prerequisites

- ✅ Domain purchased and DNS access
- ✅ Backend deployed (Railway, Render, etc.)
- ✅ SSL certificate configured (usually automatic with hosting)

## Step 1: Update Mobile App Configuration

### Option A: Quick Setup (Edit Config File)

Edit `mobile/lib/config/app_config.dart`:

```dart
// Change this line:
static const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://crowded-claudine-decayable.ngrok-free.dev', // OLD
);

// To your domain:
static const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://api.yourdomain.com', // NEW - Replace with your domain
);

// Also set this to false for production:
static const bool includeNgrokHeaders = bool.fromEnvironment(
  'INCLUDE_NGROK_HEADERS',
  defaultValue: false, // Set to false for production domains
);
```

### Option B: Build-Time Configuration (Recommended)

Build your app with environment variables:

```bash
# For iOS
flutter build ios --dart-define=API_BASE_URL=https://api.yourdomain.com --dart-define=INCLUDE_NGROK_HEADERS=false

# For Android
flutter build apk --dart-define=API_BASE_URL=https://api.yourdomain.com --dart-define=INCLUDE_NGROK_HEADERS=false
```

## Step 2: Update Web User App

The web-user app already uses environment variables. Set `VITE_API_URL` in your hosting platform:

**For Railway:**
1. Go to your web-user service
2. Add environment variable: `VITE_API_URL=https://api.yourdomain.com/api`

**For other platforms:**
Set `VITE_API_URL` to `https://api.yourdomain.com/api` in your environment variables.

## Step 3: DNS Configuration

### If using subdomain (recommended):
- `api.yourdomain.com` → Points to your backend server
- `app.yourdomain.com` → Points to your web-user frontend
- `admin.yourdomain.com` → Points to your admin panel (optional)

### DNS Records:
```
Type: A or CNAME
Name: api (or @ for root domain)
Value: Your server IP or Railway/Render URL
TTL: 300 (5 minutes)
```

## Step 4: Backend CORS Configuration

Update your backend to allow your domain:

```typescript
// backend/src/server.ts
const corsOptions = {
  origin: [
    'https://app.yourdomain.com',
    'https://admin.yourdomain.com',
    'https://yourdomain.com',
    // Keep localhost for development
    'http://localhost:3003',
    'http://localhost:5173',
  ],
  credentials: true,
};
```

## Step 5: Verify Setup

1. **Test API endpoint:**
   ```bash
   curl https://api.yourdomain.com/api/health
   ```

2. **Test from mobile app:**
   - Rebuild app with new domain
   - Check logs for: `📱 App Configuration:`
   - Verify it shows your domain

3. **Test from web app:**
   - Check browser console for API URL
   - Should show your domain, not localhost

## Step 6: SSL Certificate

Most hosting platforms (Railway, Render, Fly.io) provide automatic SSL:
- ✅ SSL is usually automatic
- ✅ Certificates auto-renew
- ✅ No manual configuration needed

If you need manual SSL:
- Use Let's Encrypt (free)
- Or Cloudflare (free SSL + CDN)

## Troubleshooting

### "SSL handshake failed"
- ✅ Fixed! This was ngrok issue
- Your domain should have proper SSL

### "Connection timeout"
- Check DNS propagation (can take up to 48 hours)
- Verify backend is running
- Check firewall rules

### "CORS error"
- Update backend CORS to include your domain
- Check that credentials are enabled

## Current Configuration

After setup, your app will:
- ✅ Use your domain instead of ngrok
- ✅ Have proper SSL certificates
- ✅ No more ngrok headers needed
- ✅ Stable connections
- ✅ Production-ready

## Next Steps

1. Update `app_config.dart` with your domain
2. Set `VITE_API_URL` for web-user
3. Configure DNS records
4. Update backend CORS
5. Rebuild and test!





