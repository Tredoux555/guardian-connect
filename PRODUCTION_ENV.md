# Production Environment Variables

## 🔐 Backend Environment Variables (`backend/.env`)

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Database
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=guardian_connect
DB_USER=your-db-user
DB_PASSWORD=your-secure-db-password
DB_SSL=true

# JWT Secrets (GENERATE NEW ONES FOR PRODUCTION!)
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-min-32-chars

# CORS - Add your production domains
ALLOWED_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com

# Firebase Cloud Messaging (Optional)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Redis (Optional - for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Application URL
APP_URL=https://app.yourdomain.com
```

## 🌐 Web User Environment Variables (`web-user/.env.production`)

```env
# API Configuration
VITE_API_URL=https://api.yourdomain.com/api

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

## 👨‍💼 Admin Panel Environment Variables (`admin/.env.production`)

```env
# API Configuration
VITE_API_URL=https://api.yourdomain.com/api
```

## 🔑 Generating Secure Secrets

### JWT Secrets
```bash
# Generate secure random strings
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Password
Use a strong password generator or:
```bash
openssl rand -base64 32
```

## ⚠️ Important Security Notes

1. **Never commit `.env` files to Git**
2. **Use different secrets for production vs development**
3. **Rotate secrets regularly**
4. **Use environment-specific configuration**
5. **Enable SSL/TLS for all database connections**
6. **Restrict CORS to production domains only**

## 📝 Environment-Specific Files

- Development: `.env` (already configured)
- Production: `.env.production` (create these)
- Staging: `.env.staging` (optional)

## 🔄 Migration from Development

When moving to production:
1. Copy `.env` to `.env.production`
2. Update all values with production credentials
3. Generate new JWT secrets
4. Update database connection strings
5. Update API URLs to production domains
6. Configure CORS for production domains only

