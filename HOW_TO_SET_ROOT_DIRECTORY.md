# How to Set Root Directory in Railway - Beginner Guide

## 🎯 What is Root Directory?

**Root Directory** tells Railway which folder contains your code.

- Your project has multiple folders: `backend/`, `web-user/`, `admin/`
- Railway needs to know which folder to build
- **Backend service** needs Root Directory = `backend`
- **Frontend service** needs Root Directory = `web-user`

## 📋 Step-by-Step Instructions

### Step 1: Click on Your Service

1. In Railway, you should see service cards (like "overflowing-reprieve" or "guardian-connect")
2. **Click on the service** you want to configure
3. This opens the service details page

### Step 2: Open Settings

1. Look at the **left sidebar** (or tabs at the top)
2. Find and **click "Settings"**
3. This opens the settings page for that service

### Step 3: Find Root Directory

1. **Scroll down** on the Settings page
2. Look for a section called **"Source"** or **"Build"**
3. Find a field labeled **"Root Directory"**
4. It might be empty or have some text in it

### Step 4: Set the Root Directory

**For Backend Service:**
1. Click in the **"Root Directory"** field
2. **Type exactly:** `backend` (lowercase, no quotes, no slashes)
3. Click **"Update"** or **"Save"** button
4. Railway will automatically redeploy

**For Frontend Service:**
1. Click in the **"Root Directory"** field
2. **Type exactly:** `web-user` (lowercase, no quotes, no slashes)
3. Click **"Update"** or **"Save"** button
4. Railway will automatically redeploy

## 🔍 Visual Guide

```
Railway Dashboard
└── Your Service (click this)
    └── Settings Tab (click this)
        └── Scroll down...
            └── Root Directory: [backend] ← Type here
                └── [Update] button ← Click this
```

## ✅ How to Verify It's Set

1. Go back to Settings
2. Check the Root Directory field
3. It should show: `backend` or `web-user`
4. If it's empty or wrong, set it again

## ⚠️ Common Mistakes

- ❌ Don't use: `/backend` (no leading slash)
- ❌ Don't use: `./backend` (no dot-slash)
- ❌ Don't use: `backend/` (no trailing slash)
- ✅ Use: `backend` (just the folder name)

## 🎓 Why This Matters

Without Root Directory set:
- Railway tries to build from the root folder
- It can't find `package.json`
- Build fails with errors

With Root Directory set:
- Railway knows where your code is
- It finds `package.json` correctly
- Build succeeds! ✅

---

**Remember:** Root Directory is just the folder name where your code lives!

