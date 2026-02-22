# Fix: Login 500 Error - Backend Database Issue

## 🔍 The Problem

Login is returning **500 Internal Server Error**. This means the backend is crashing when processing the login request.

**Most likely causes:**
1. ❌ Database connection failing
2. ❌ Database tables don't exist (schema not run)
3. ❌ Missing environment variables (JWT_SECRET, database credentials)
4. ❌ Database query error

## ✅ Step 1: Check Backend Logs (CRITICAL!)

**This will tell you exactly what's wrong:**

1. **Go to Railway:** https://railway.app
2. **Click on your BACKEND service** (`overflowing-reprieve-production-4619`)
3. **Click "Logs" tab**
4. **Try logging in from frontend**
5. **Look for errors** - especially:
   - `Database connection error`
   - `Database query error`
   - `relation "users" does not exist`
   - `JWT_SECRET` errors
   - Any red error messages

**Share the error message you see!**

## 🔧 Step 2: Check Database Connection

### Verify Database Service Exists:

1. **Railway → Your Project**
2. **Look for PostgreSQL service** (should be listed)
3. **If missing:** Click "+ New" → Add PostgreSQL

### Verify Database Variables:

1. **Railway → Backend Service → Variables tab**
2. **Check these variables exist:**
   - `PGHOST` (or `DB_HOST`)
   - `PGPORT` (or `DB_PORT`)
   - `PGDATABASE` (or `DB_NAME`)
   - `PGUSER` (or `DB_USER`)
   - `PGPASSWORD` (or `DB_PASSWORD`)

3. **If missing:**
   - Railway should auto-inject these when you add PostgreSQL
   - Or manually set them from PostgreSQL service → Variables

## 🗄️ Step 3: Check Database Tables Exist

The database might not have the required tables. Check if schema was run:

### Option A: Check via Railway PostgreSQL

1. **Railway → PostgreSQL Service → Data tab**
2. **Click "Query" or "Connect"**
3. **Run this query:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```
4. **Should see tables like:**
   - `users`
   - `sessions`
   - `emergencies`
   - etc.

### Option B: Run Schema Manually

If tables don't exist:

1. **Get your database connection string:**
   - Railway → PostgreSQL Service → Variables
   - Copy connection details

2. **Connect and run schema:**
   - Use Railway's built-in query tool
   - Or connect via psql
   - Run the SQL from `backend/src/database/schema.sql`

## 🔑 Step 4: Check JWT Secrets

1. **Railway → Backend Service → Variables**
2. **Verify these are set:**
   - `JWT_SECRET` (should be a long random string)
   - `JWT_REFRESH_SECRET` (should be a long random string)
3. **If missing:** Add them (see `RAILWAY_ENV_BACKEND.txt` for values)

## 🧪 Step 5: Test Backend Health

1. **Open:** `https://overflowing-reprieve-production-4619.up.railway.app/health`
2. **Should see:** `{"status":"ok","timestamp":"..."}`
3. **If fails:** Backend isn't running properly

## 📋 Quick Checklist

- [ ] Backend service is "Active" in Railway
- [ ] Backend health check works (`/health` endpoint)
- [ ] PostgreSQL service exists in Railway
- [ ] Database variables are set (PGHOST, PGPORT, etc.)
- [ ] Database tables exist (users, sessions, etc.)
- [ ] `JWT_SECRET` is set in backend variables
- [ ] `JWT_REFRESH_SECRET` is set in backend variables
- [ ] Backend logs show no database connection errors
- [ ] Backend logs show no "table does not exist" errors

## 🎯 Most Common Fix

**90% of the time, it's one of these:**

1. **Database tables don't exist** → Run schema.sql
2. **Database connection failing** → Check database variables are set
3. **JWT_SECRET not set** → Add JWT_SECRET variable

## 🔍 What to Share

If still not working, share:
1. **Backend logs** (especially the error when you try to login)
2. **Database variables** (are they set?)
3. **Health check result** (does `/health` work?)
4. **Database tables** (do they exist?)

---

**Next Step:** Check backend logs first - that will tell you exactly what's wrong!

