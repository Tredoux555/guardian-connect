# 🚀 Railway Deployment - Quick Start

## ✅ Everything is Ready!

All configuration files have been created and pushed to GitHub.

## 📋 What You Need to Do in Railway

### 1. Sign In to Railway
- Go to: https://railway.app
- Login with GitHub

### 2. Create Project
- Click "+ New Project"
- Select "Deploy from GitHub repo"
- Choose: `guardian-connect`

### 3. Deploy Backend
- Set **Root Directory**: `backend`
- Add PostgreSQL database
- Add environment variables (see `RAILWAY_ENV_BACKEND.txt`)
- Generate domain

### 4. Deploy Frontend
- Create new service from same repo
- Set **Root Directory**: `web-user`
- Add environment variables (see `RAILWAY_ENV_FRONTEND.txt`)
- Update `VITE_API_URL` with backend URL
- Generate domain

### 5. Update CORS
- Update backend `ALLOWED_ORIGINS` with frontend URL

## 📖 Full Instructions

See **`RAILWAY_STEP_BY_STEP.md`** for complete detailed instructions.

## 🔑 Generated Secrets

JWT secrets have been generated and are in `RAILWAY_ENV_BACKEND.txt`:
- JWT_SECRET: `61bf5370182a805f83f0d6bf87d8d889b11bbcb18835fd6dc7d37556b6ad88dd`
- JWT_REFRESH_SECRET: `9c02d547c65ce680382ddb6de36a1f22834edfb5a934340f7f9b1e483527b19b`

## ✅ Files Created

- ✅ `backend/railway.json` - Backend build config
- ✅ `web-user/railway.json` - Frontend build config
- ✅ `railway.toml` - Root config
- ✅ `RAILWAY_ENV_BACKEND.txt` - Backend env vars template
- ✅ `RAILWAY_ENV_FRONTEND.txt` - Frontend env vars template
- ✅ `RAILWAY_STEP_BY_STEP.md` - Complete guide
- ✅ Database SSL support added

**Everything is ready! Just follow the steps in Railway!**

