# VAPID Keys Setup

## Generated VAPID Keys

Add these to your `backend/.env` file:

```env
# Web Push API VAPID Keys
VAPID_PUBLIC_KEY=BMyjEmeq3DB-hcL7pFKSWlSIkmhNl8Z3zPT__1lBTm7JeKks47d5ytdq5f1rBdToOmyF6cDJ68QbpWD_BRMn3tM
VAPID_PRIVATE_KEY=ZfnkvwmkPfrCSp6SH0VCOLvI8eLPGWJ-L0y0m_fIEYM
VAPID_SUBJECT=mailto:admin@guardianconnect.com
```

**Important**: 
- Keep the private key SECRET - never commit it to version control
- The public key is safe to expose (it's used by the frontend)
- Update `VAPID_SUBJECT` with your actual contact email

## Database Migration

Run this SQL to add the push_subscription column:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription TEXT;
```

Or run the migration file:
```bash
psql -d your_database -f backend/src/database/migrations/add_push_subscription.sql
```

## Testing

1. Start the backend server
2. Log in to the web app
3. The app will automatically:
   - Request notification permission
   - Subscribe to push notifications
   - Save subscription to database

4. Test by triggering an emergency from another user
5. You should receive a push notification even if the app is closed!

