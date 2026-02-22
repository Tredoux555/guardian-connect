# Connect GoDaddy Domain to Railway - Step by Step

## 🎯 Goal
Connect `api.guardianconnect.icu` to your Railway backend.

## 📋 Step 1: Get Your Railway URL

### In Railway Dashboard:

1. **Go to Railway:** https://railway.app
2. **Login** (if not already)
3. **Click on your project** (guardian-connect or similar)
4. **Click on your backend service**
5. **Go to Settings tab**
6. **Scroll to "Domains" section**
7. **Copy the Railway URL** - it looks like:
   - `your-backend-name.railway.app`
   - Or `your-backend-name-production.up.railway.app`

**Write it down here:** `___________________________`

## 📋 Step 2: Add Custom Domain in Railway

### Still in Railway (Settings → Domains):

1. **Look for "Custom Domain" section**
2. **Click "Add Custom Domain"** or **"Custom Domain"** button
3. **Enter:** `api.guardianconnect.icu`
4. **Click "Add"** or **"Save"**
5. **Railway will show you DNS instructions** - we'll do this next!

**Important:** Railway will show you a **CNAME value** or **A record value**. Write it down!

## 📋 Step 3: Configure DNS in GoDaddy

### In GoDaddy DNS Manager:

1. **Go to:** https://dcc.godaddy.com
2. **Click on:** `guardianconnect.icu`
3. **Click:** **"DNS"** or **"Manage DNS"**
4. **Find the DNS Records table**

### Add CNAME Record:

1. **Click "Add"** or **"+"** button
2. **Select Type:** `CNAME`
3. **Name/Host:** `api`
4. **Value/Points to:** 
   - This is the Railway URL from Step 1
   - Or the CNAME value Railway gave you
   - Example: `your-backend-name.railway.app`
5. **TTL:** `600` (10 minutes) or `3600` (1 hour)
6. **Click "Save"**

### What it should look like:

```
Type    Name    Value                          TTL
CNAME   api     your-backend-name.railway.app 600
```

## 📋 Step 4: Wait for DNS Propagation

- **Can take:** 5 minutes to 48 hours
- **Usually:** 10-30 minutes
- **Check status:** Railway will show "Pending" then "Active"

### Check if it's working:

```bash
# In terminal, run:
nslookup api.guardianconnect.icu

# Or visit in browser:
https://api.guardianconnect.icu
```

## 📋 Step 5: Verify in Railway

1. **Go back to Railway**
2. **Settings → Domains**
3. **Check custom domain status:**
   - ✅ **"Active"** = Working! SSL is ready!
   - ⏳ **"Pending"** = Still propagating (wait)
   - ❌ **"Failed"** = Check DNS settings

## 📋 Step 6: Test Your Domain

### Test API:

```bash
curl https://api.guardianconnect.icu/api/health
```

Should return:
```json
{"message":"Guardian Connect API","version":"1.0.0",...}
```

### Test in Browser:

Visit: `https://api.guardianconnect.icu`

Should show API information.

## ✅ Success Indicators

- ✅ DNS record added in GoDaddy
- ✅ Custom domain shows "Active" in Railway
- ✅ `https://api.guardianconnect.icu` loads in browser
- ✅ SSL certificate is active (green lock icon)
- ✅ API responds correctly

## 🎯 Next Steps After Domain is Active

1. **Mobile app is already configured** ✅
   - Uses: `https://api.guardianconnect.icu`
   - Just rebuild the app!

2. **Web-user app:**
   - Set environment variable: `VITE_API_URL=https://api.guardianconnect.icu/api`

3. **Test everything:**
   - Mobile app connects to domain
   - Web app connects to domain
   - Socket.io works
   - No more connection errors!

## 🆘 Troubleshooting

### Domain not working?

1. **Check DNS record:**
   - Name should be: `api` (not `api.guardianconnect.icu`)
   - Type should be: `CNAME`
   - Value should match Railway URL exactly

2. **Check Railway:**
   - Custom domain added?
   - Status shows "Active"?
   - Check logs for errors

3. **Wait longer:**
   - DNS can take up to 48 hours
   - Usually works in 10-30 minutes

### SSL not working?

- Railway automatically provisions SSL
- Wait for domain to be "Active"
- Can take a few minutes after DNS propagates

## 📝 Quick Reference

**GoDaddy DNS:**
- Type: `CNAME`
- Name: `api`
- Value: `[Your Railway URL]`
- TTL: `600`

**Railway:**
- Custom Domain: `api.guardianconnect.icu`
- Status: Should be "Active"

**Test:**
- `https://api.guardianconnect.icu/api/health`

---

**Once your Railway URL is active, everything will work!**






