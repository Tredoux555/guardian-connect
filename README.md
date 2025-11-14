# Guardian Connect

Emergency alert system with real-time location sharing and group coordination.

## Project Structure

- `backend/` - Node.js/TypeScript API server
- `mobile/` - Flutter mobile app (iOS & Android)
- `admin/` - React admin panel
- `shared/` - Shared TypeScript types

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional for development)
- Flutter 3.0+
- Firebase account (for push notifications)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up PostgreSQL database:
```bash
createdb guardian_connect
psql guardian_connect < src/database/schema.sql
```

4. Create `.env` file (copy from `.env.example` and fill in values)

5. Start development server:
```bash
npm run dev
```

### Mobile App Setup

1. Navigate to mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
flutter pub get
```

3. Configure Firebase:
   - Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
   - Update Firebase configuration in `main.dart`

4. Run on device/emulator:
```bash
flutter run
```

### Admin Panel Setup

1. Navigate to admin directory:
```bash
cd admin
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```
VITE_API_URL=http://localhost:3000/api
```

4. Start development server:
```bash
npm run dev
```

## Environment Variables

See `backend/.env.example` for required environment variables.

## Key Features

- **Emergency Alert System**: One-tap emergency alerts to all contacts
- **Privacy-First Acceptance**: Location only shared after explicit acceptance
- **Real-Time Location**: Live location tracking during emergencies
- **Group Chat**: Real-time messaging for emergency coordination
- **Admin Panel**: User management and messaging system

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Emergencies
- `POST /api/emergencies/create` - Create emergency
- `POST /api/emergencies/:id/accept` - Accept emergency (respondent)
- `POST /api/emergencies/:id/reject` - Reject emergency
- `POST /api/emergencies/:id/location` - Update location
- `GET /api/emergencies/:id` - Get emergency details
- `POST /api/emergencies/:id/end` - End emergency

### Contacts
- `GET /api/contacts` - Get all contacts
- `POST /api/contacts/add` - Add contact
- `DELETE /api/contacts/:id` - Remove contact

### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users/:id/message` - Send message to user
- `POST /api/admin/messages/broadcast` - Broadcast to all users
- `POST /api/admin/messages/group` - Send group message
- `GET /api/admin/analytics` - Get analytics

## Development Status

✅ Phase 1: Foundation & Authentication
✅ Phase 2: Core Emergency System
🔄 Phase 3: Contact Management (in progress)
⏳ Phase 4-10: Remaining phases

## Security

- JWT-based authentication
- Rate limiting on auth endpoints
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- HTTPS required in production
- End-to-end encryption for sensitive data

## License

Proprietary - All rights reserved


