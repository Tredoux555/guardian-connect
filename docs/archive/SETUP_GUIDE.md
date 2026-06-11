# Guardian Connect - Setup Guide

## What's Been Built

✅ **Phase 1: Foundation & Authentication**
- Backend API with Express/TypeScript
- PostgreSQL database schema
- JWT authentication system
- Flutter mobile app structure
- React admin panel
- Email verification and password reset

✅ **Phase 2: Core Emergency System** (CRITICAL FEATURE)
- Emergency creation endpoint
- Privacy-first acceptance workflow (location only shared after explicit accept)
- Real-time Socket.io integration
- Location tracking for accepted participants only
- Emergency response screens (accept/reject)
- Real-time map display

✅ **Phase 3: Contact Management**
- Add/list/remove emergency contacts
- Contact invitation system (email/SMS)
- Support for registered and non-registered contacts

✅ **Phase 7: Admin Panel**
- Admin authentication
- User management dashboard
- Individual user messaging
- Group messaging
- Broadcast messaging to all users
- Analytics dashboard

## Next Steps to Get Running

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Mobile:**
```bash
cd mobile
flutter pub get
```

**Admin:**
```bash
cd admin
npm install
```

### 2. Set Up Database

**Easy Way (Recommended for beginners):**
```bash
# Run the automated setup script
./setup-database.sh
```

**Manual Way:**
```bash
# First, check if PostgreSQL is installed
psql --version

# If not installed, install it:
# Option 1: brew install postgresql@14
# Option 2: Download Postgres.app from https://postgresapp.com/

# Create database
createdb guardian_connect

# Run schema
psql guardian_connect < backend/src/database/schema.sql
```

**📖 For detailed step-by-step instructions, see `POSTGRESQL_SETUP.md`**

### 3. Configure Environment Variables

**Backend** (`backend/.env`):
```env
# Your username is: tredouxwillemse
# Use this for DB_USER below
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=guardian_connect
DB_USER=tredouxwillemse
DB_PASSWORD=
# Leave password empty if using default PostgreSQL setup

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@guardianconnect.com

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-client-email

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Twilio (optional for SMS)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

**Admin** (`admin/.env`):
```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Set Up Firebase

1. Create a Firebase project
2. Enable Cloud Messaging
3. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
4. Place them in `mobile/android/app/` and `mobile/ios/Runner/`
5. Update Firebase config in backend `.env`

### 5. Create Admin User

```sql
-- Run in PostgreSQL
INSERT INTO admins (email, password_hash) 
VALUES (
  'admin@guardianconnect.com',
  '$2b$10$YourHashedPasswordHere'
);

-- To generate password hash, use Node.js:
-- const bcrypt = require('bcrypt');
-- bcrypt.hash('your-password', 10).then(hash => console.log(hash));
```

### 6. Start Services

**Backend:**
```bash
cd backend
npm run dev
```

**Admin Panel:**
```bash
cd admin
npm run dev
```

**Mobile App:**
```bash
cd mobile
flutter run
```

## Testing the Emergency Flow

1. **Register two users** (User A and User B)
2. **Verify emails** (check email or manually verify in database)
3. **Add User B as emergency contact** for User A
4. **User A triggers emergency** (long-press emergency button)
5. **User B receives push notification** → Taps "I CAN HELP"
6. **Location sharing starts** → Both users see each other on map
7. **Real-time updates** → Locations update every 5 seconds

## Important Notes

- **Location Privacy**: Location is ONLY shared after explicit "ACCEPT" - this is the core privacy feature
- **Socket.io**: Real-time updates require WebSocket connection
- **Push Notifications**: Requires Firebase setup
- **Maps**: Requires Google Maps API key

## Remaining Phases

- Phase 4: Maps & Navigation (partially done, needs polish)
- Phase 5: Group Chat & Media (needs implementation)
- Phase 6: Additional Features (history, settings, donation)
- Phase 8: Security Hardening (rate limiting, encryption)
- Phase 9: Performance Optimization
- Phase 10: Testing & Deployment

## Troubleshooting

**Backend won't start:**
- Check PostgreSQL is running: `pg_isready`
- Verify database exists: `psql -l | grep guardian_connect`
- Check `.env` file has all required variables

**Mobile app errors:**
- Run `flutter doctor` to check setup
- Ensure Firebase files are in correct locations
- Check API URL in `api_service.dart` matches backend

**Socket.io not connecting:**
- Verify backend is running on port 3000
- Check CORS settings in `server.ts`
- Ensure token is being sent in Socket.io auth

## Security Checklist

Before production:
- [ ] Change all default secrets/passwords
- [ ] Enable HTTPS
- [ ] Set up proper CORS origins
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Enable logging and monitoring
- [ ] Review and test all endpoints
- [ ] Set up error tracking (Sentry, etc.)

