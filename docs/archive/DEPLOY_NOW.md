# Guardian Connect - Deploy NOW Guide

## Option A: Quick Script (Terminal)

Open Terminal on your Mac and run:

```bash
cd ~/Desktop/ACTIVE/guardian-connect
./deploy-railway.sh
```

Follow the prompts. Done!

---

## Option B: Railway Dashboard (Easier - Recommended)

Since your code is already on GitHub at `Tredoux555/guardian-connect`, Railway can deploy directly from there.

### Step 1: Create Railway Project

1. Go to [railway.com/new](https://railway.com/new)
2. Click **"Deploy from GitHub Repo"**
3. Select **Tredoux555/guardian-connect**
4. Railway will create a project

### Step 2: Add PostgreSQL

1. In your project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Wait for it to provision (30 seconds)
3. Railway auto-injects `DATABASE_URL` into linked services

### Step 3: Deploy Backend Service

1. Click **"+ New"** → **"GitHub Repo"** → select **guardian-connect**
2. Click the new service → **Settings**:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/src/server.js`
3. Go to **Variables** tab, add:
   ```
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=<generate with: openssl rand -hex 32>
   JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>
   ```
4. Link the PostgreSQL database:
   - In Variables, click **"Add Reference"** → select your PostgreSQL service
   - This auto-adds DATABASE_URL
5. Go to **Settings** → **Domains** → click **"Generate Domain"**
6. Copy the URL (e.g., `backend-xxx.up.railway.app`)

### Step 4: Deploy Web User Frontend

1. Click **"+ New"** → **"GitHub Repo"** → select **guardian-connect**
2. Click the new service → **Settings**:
   - **Root Directory**: `web-user`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve -s dist -l $PORT`
3. Go to **Variables** tab, add:
   ```
   VITE_API_URL=https://backend-xxx.up.railway.app/api
   ```
   (Replace with your actual backend URL from Step 3)
4. Go to **Settings** → **Domains** → click **"Generate Domain"**
5. Copy the URL

### Step 5: Deploy Admin Panel

1. Click **"+ New"** → **"GitHub Repo"** → select **guardian-connect**
2. Click the new service → **Settings**:
   - **Root Directory**: `admin`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve -s dist -l $PORT`
3. Go to **Variables** tab, add:
   ```
   VITE_API_URL=https://backend-xxx.up.railway.app/api
   ```
4. Go to **Settings** → **Domains** → click **"Generate Domain"**

### Step 6: Update Backend CORS

1. Go back to your **backend** service → **Variables**
2. Add/update:
   ```
   ALLOWED_ORIGINS=https://web-user-xxx.up.railway.app,https://admin-xxx.up.railway.app
   ```
   (Use your actual frontend URLs from Steps 4 & 5)

### Step 7: Initialize Database

1. Click your **PostgreSQL** service in Railway
2. Go to the **"Data"** tab or **"Query"** tab
3. Copy-paste the contents of `backend/src/database/schema.sql` and run it
4. Then run each migration file from `backend/src/database/migrations/`

### Step 8: Verify

- Backend: Visit `https://backend-xxx.up.railway.app/` → should show JSON
- Backend health: `https://backend-xxx.up.railway.app/health` → should show "ok"
- Web User: Visit `https://web-user-xxx.up.railway.app/` → should show login page
- Admin: Visit `https://admin-xxx.up.railway.app/` → should show admin login

---

## Optional: Custom Domain (guardianconnect.icu)

After Railway services are running:

1. **Backend**: Settings → Domains → Custom Domain → `api.guardianconnect.icu`
2. **Web User**: Settings → Domains → Custom Domain → `app.guardianconnect.icu`
3. **Admin**: Settings → Domains → Custom Domain → `admin.guardianconnect.icu`

In GoDaddy DNS:
- CNAME `api` → your Railway backend domain
- CNAME `app` → your Railway web-user domain
- CNAME `admin` → your Railway admin domain

---

## Environment Variables Reference

### Backend
| Variable | Value |
|----------|-------|
| NODE_ENV | production |
| PORT | 3001 |
| JWT_SECRET | (generate: `openssl rand -hex 32`) |
| JWT_REFRESH_SECRET | (generate: `openssl rand -hex 32`) |
| DATABASE_URL | (auto from PostgreSQL service) |
| ALLOWED_ORIGINS | (your frontend URLs, comma-separated) |

### Web User & Admin
| Variable | Value |
|----------|-------|
| VITE_API_URL | https://your-backend-url.up.railway.app/api |
