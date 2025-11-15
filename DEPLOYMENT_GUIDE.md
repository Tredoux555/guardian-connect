# Guardian Connect - Production Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ Core Functionality
- [x] Emergency creation and management
- [x] Real-time location tracking
- [x] Google Maps integration
- [x] Apple Maps support (iOS/macOS)
- [x] User authentication
- [x] Contact management
- [x] Admin panel

### 🔧 Configuration Required

1. **Environment Variables** - See `PRODUCTION_ENV.md`
2. **Database** - PostgreSQL production database
3. **API Keys** - Google Maps API key configured
4. **Domain/URLs** - Production URLs for frontend and backend

## 🚀 Build Process

### 1. Build All Applications

```bash
# Build backend
cd backend
npm run build

# Build web-user interface
cd ../web-user
npm run build

# Build admin panel
cd ../admin
npm run build
```

### 2. Production Build Script

Run the provided build script:
```bash
./build-production.sh
```

## 📦 Deployment Options

### Option 1: Traditional Hosting (VPS/Cloud)

#### Backend Deployment
1. Upload `backend/dist/` to server
2. Install dependencies: `npm install --production`
3. Set environment variables (see `PRODUCTION_ENV.md`)
4. Start with PM2: `pm2 start dist/server.js --name guardian-backend`

#### Frontend Deployment
1. Upload `web-user/dist/` to web server (nginx, Apache)
2. Configure reverse proxy for API calls
3. Set environment variables in `.env.production`

### Option 2: Platform-as-a-Service

#### Vercel/Netlify (Frontend)
- Connect GitHub repository
- Set build command: `cd web-user && npm run build`
- Set output directory: `web-user/dist`
- Configure environment variables in dashboard

#### Railway/Render (Backend)
- Connect GitHub repository
- Set start command: `cd backend && npm start`
- Configure environment variables in dashboard
- Set up PostgreSQL database

### Option 3: Docker Deployment

See `docker-compose.yml` (if created) for containerized deployment.

## 🔐 Security Checklist

- [ ] Enable rate limiting in production
- [ ] Configure CORS for production domains only
- [ ] Use HTTPS for all connections
- [ ] Set secure JWT secrets
- [ ] Enable database SSL connections
- [ ] Configure firewall rules
- [ ] Set up monitoring and logging

## 📊 Monitoring

### Recommended Tools
- **Backend**: PM2 monitoring, Sentry for error tracking
- **Frontend**: Google Analytics, error boundary logging
- **Database**: PostgreSQL monitoring tools

## 🔄 Updates & Maintenance

### Updating the Application
1. Pull latest code
2. Run `npm install` in each directory
3. Run build scripts
4. Restart services
5. Test thoroughly

### Database Migrations
```bash
cd backend
npm run migrate
```

## 📞 Support & Troubleshooting

See `TROUBLESHOOTING.md` for common issues and solutions.

## 🌐 Production URLs

After deployment, update these in your environment variables:
- **Backend API**: `https://api.yourdomain.com`
- **Web User**: `https://app.yourdomain.com`
- **Admin Panel**: `https://admin.yourdomain.com`

---

**Note**: Always test in a staging environment before deploying to production!





