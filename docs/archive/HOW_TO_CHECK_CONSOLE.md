# How to Check Browser Console - Quick Guide

## 🎯 Why Check Console?

The browser console shows errors and tells you what's happening with your app. It's the easiest way to see if your frontend is connecting to your backend correctly.

## 📱 Step-by-Step: Open Console

### On Desktop (Chrome, Firefox, Edge, Safari)

**Method 1: Keyboard Shortcut**
1. Press **F12** (or **Fn + F12** on some laptops)
2. Console tab should open automatically

**Method 2: Right-Click Menu**
1. Right-click anywhere on the page
2. Click **"Inspect"** or **"Inspect Element"**
3. Click the **"Console"** tab at the top

**Method 3: Menu Bar**
- **Chrome/Edge:** Menu (⋮) → More Tools → Developer Tools
- **Firefox:** Menu (☰) → More Tools → Web Developer Tools
- **Safari:** Safari → Settings → Advanced → Check "Show Develop menu" → Develop → Show JavaScript Console

### On Mobile (iPhone/Android)

**iPhone (Safari):**
1. Settings → Safari → Advanced → Enable "Web Inspector"
2. Connect iPhone to Mac via USB
3. On Mac: Safari → Develop → [Your iPhone] → [Your Website]

**Android (Chrome):**
1. Connect phone to computer via USB
2. Enable USB debugging on phone
3. On computer: Chrome → chrome://inspect → See your device

**Easier for Mobile:** Use desktop browser to test first!

## 🔍 What to Look For

### ✅ Good Signs (Everything Working)

```
✅ Service Worker registered
API Base URL: https://your-backend.railway.app/api
API Request: POST /auth/login
API Response: 200 /auth/login
```

### ❌ Bad Signs (Problems)

```
❌ Error: Cannot find module
❌ XMLHttpRequest cannot load http://localhost:3001/api
❌ [blocked] The page requested insecure content
❌ CORS error
❌ 401 Unauthorized
❌ 500 Internal Server Error
```

## 🧪 Quick Test: Check API URL

1. **Open Console** (F12)
2. **Click the Console tab** (if not already there)
3. **Type this command** and press Enter:

```javascript
console.log('API URL:', import.meta.env.VITE_API_URL)
```

### What You Should See:

**✅ If Working:**
```
API URL: https://your-backend-url.railway.app/api
```

**❌ If Not Set:**
```
API URL: undefined
```

**❌ If Wrong:**
```
API URL: http://localhost:3001/api
```

## 🐛 Common Errors & What They Mean

### Error: "requested insecure content from http://localhost"
**Problem:** Frontend is trying to use localhost instead of Railway backend  
**Fix:** Set `VITE_API_URL` in Railway to your backend URL

### Error: "CORS" or "Access-Control-Allow-Origin"
**Problem:** Backend isn't allowing your frontend domain  
**Fix:** Add frontend URL to backend's `ALLOWED_ORIGINS` environment variable

### Error: "401 Unauthorized"
**Problem:** Login credentials wrong, or token expired  
**Fix:** Try logging in again, or check if backend is running

### Error: "500 Internal Server Error"
**Problem:** Backend crashed or database issue  
**Fix:** Check backend logs in Railway

### Error: "Cannot find module" or "Module not found"
**Problem:** Build error or missing files  
**Fix:** Check Railway deployment logs

## 📋 Quick Checklist

When checking console:

- [ ] Console is open (F12)
- [ ] No red errors visible
- [ ] API URL shows Railway backend (not localhost)
- [ ] Login attempt shows API request in console
- [ ] API response shows 200 (success) or helpful error code

## 🎯 What to Do Next

1. **Open Console** (F12)
2. **Try to log in**
3. **Look at console messages**
4. **Share what you see** - especially any red errors!

---

## 🔧 Step-by-Step: Fix API Connection

### If API URL shows `undefined` or `localhost`:

1. **Get Your Backend URL:**
   - Go to Railway → Backend Service → Settings → Domains
   - Copy the URL (e.g., `https://xxx.up.railway.app`)

2. **Set Environment Variable:**
   - Go to Railway → Frontend Service → Variables
   - Click "New Variable"
   - Name: `VITE_API_URL`
   - Value: `https://your-backend-url.railway.app/api`
   - Save

3. **Redeploy:**
   - Railway should auto-redeploy
   - Or go to Deployments → Redeploy

4. **Test Again:**
   - Refresh your frontend page
   - Open console (F12)
   - Check API URL again
   - Should now show your Railway backend URL

---

**Tip:** Console messages are color-coded:
- 🔴 **Red** = Errors (bad, needs fixing)
- 🟡 **Yellow** = Warnings (might be okay, but check)
- 🔵 **Blue/White** = Info (usually fine)

