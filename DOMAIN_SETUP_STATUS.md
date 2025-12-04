# Custom Domain Setup Status - guardianconnect.icu

## ✅ What's Already Done

### 1. Mobile App Configuration ✅
- **File:** `mobile/lib/config/app_config.dart`
- **Status:** Configured
- **Domain:** `https://api.guardianconnect.icu`
- **Ngrok headers:** Disabled (set to `false` for production)

### 2. Backend CORS Configuration ✅
- **File:** `backend/src/server.ts`
- **Status:** Configured
- **Allowed domains:**
  - `https://app.guardianconnect.icu`
  - `https://admin.guardianconnect.icu`
  - `https://guardianconnect.icu`
- **Socket.io CORS:** Also configured for same domains

### 3. Documentation ✅
- Multiple setup guides created
- Step-by-step instructions available

---

## ⏳ What Still Needs to Be Done

### Step 1: Add Custom Domain in Railway (REQUIRED)

**Action Required:**
1. Go to https://railway.app
2. Navigate to: **Project → Backend Service → Settings → Domains**
3. Click **"Add Custom Domain"**
4. Enter: `api.guardianconnect.icu`
5. Railway will show you DNS instructions (CNAME value)

**What to look for:**
- Railway will provide a CNAME target (e.g., `xxxxx.railway.app`)
- Write down this value - you'll need it for GoDaddy DNS

**Status:** ⏳ **NOT DONE** - Need to verify if this is already configured

---

### Step 2: Configure DNS in GoDaddy (REQUIRED)

**Action Required:**
1. Go to https://dcc.godaddy.com
2. Click on **guardianconnect.icu**
3. Click **"DNS"** or **"Manage DNS"**
4. Add a new DNS record:

```
Type: CNAME
Name: api
Value: [Railway CNAME value from Step 1]
TTL: 600 (10 minutes)
```

**Example:**
```
Type: CNAME
Name: api
Value: your-backend-name.railway.app
TTL: 600
```

**Status:** ⏳ **NOT DONE** - Need Railway CNAME value first

---

### Step 3: Set Web User Environment Variable (REQUIRED)

**Action Required:**
1. Go to Railway → Web User Service → Settings → Variables
2. Add environment variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://api.guardianconnect.icu/api`
3. Redeploy the web-user service

**Status:** ⏳ **NOT DONE** - Need to verify current value

---

### Step 4: Wait for DNS Propagation (AUTOMATIC)

**Timeline:**
- Usually: 10-30 minutes
- Can take: Up to 48 hours
- Check status in Railway (will show "Pending" → "Active")

**How to check:**
```bash
# In terminal:
nslookup api.guardianconnect.icu

# Or visit in browser:
https://api.guardianconnect.icu/api/health
```

**Status:** ⏳ **WAITING** - Can't proceed until Steps 1-2 are done

---

### Step 5: Test Everything (VERIFICATION)

**Tests to run:**

1. **Test API endpoint:**
   ```bash
   curl https://api.guardianconnect.icu/api/health
   ```
   Should return: `{"message":"Guardian Connect API",...}`

2. **Test in browser:**
   - Visit: `https://api.guardianconnect.icu`
   - Should show API information
   - Check for SSL certificate (green lock icon)

3. **Test mobile app:**
   - Rebuild app (or it will use default domain)
   - Check logs for: `📱 App Configuration:`
   - Should show: `API Base URL: https://api.guardianconnect.icu`

4. **Test web app:**
   - Check browser console
   - Should show: `API URL: https://api.guardianconnect.icu/api`

**Status:** ⏳ **WAITING** - Can't test until domain is active

---

## 📋 Quick Checklist

- [ ] **Step 1:** Add `api.guardianconnect.icu` as custom domain in Railway
- [ ] **Step 2:** Add CNAME record in GoDaddy DNS
- [ ] **Step 3:** Set `VITE_API_URL` in web-user service
- [ ] **Step 4:** Wait for DNS propagation (10-30 min)
- [ ] **Step 5:** Test API endpoint
- [ ] **Step 6:** Test web app
- [ ] **Step 7:** Rebuild mobile app (optional - already configured)

---

## 🎯 Next Actions

**To complete setup, I need:**

1. **Railway Backend URL:**
   - What's your Railway backend service URL?
   - (e.g., `your-backend-name.railway.app`)
   - This will help me give you exact DNS values

2. **Current Railway Domain Status:**
   - Is `api.guardianconnect.icu` already added in Railway?
   - If yes, what's the status? (Pending/Active/Failed)

3. **GoDaddy DNS Status:**
   - Have you added any DNS records yet?
   - If yes, what records exist?

4. **Web User Service:**
   - What's the current `VITE_API_URL` value?
   - Is it still pointing to ngrok/localhost?

---

## 📚 Reference Files

- **Main Setup Guide:** `GUARDIANCONNECT_ICU_SETUP.md`
- **Railway + GoDaddy:** `RAILWAY_GODADDY_SETUP.md`
- **General Domain Setup:** `DOMAIN_SETUP.md`
- **Find Railway Domains:** `FIND_SERVICE_DOMAINS.md`

---

## 🆘 Troubleshooting

### Domain not working?
1. Check Railway domain status (should be "Active")
2. Verify DNS record in GoDaddy (CNAME, name: `api`)
3. Wait longer (DNS can take up to 48 hours)

### SSL not working?
- Railway automatically provisions SSL
- Wait for domain to be "Active" in Railway
- Can take a few minutes after DNS propagates

### CORS errors?
- Backend CORS is already configured ✅
- Make sure domain is in allowed origins (already done ✅)
- Check that `VITE_API_URL` is set correctly

---

**Ready to proceed?** Let me know your Railway backend URL and I'll give you exact DNS values!





