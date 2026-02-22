# Guardian Connect Backend

Node.js/TypeScript backend API for Guardian Connect emergency alert system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up PostgreSQL database:
```bash
createdb guardian_connect
psql guardian_connect < src/database/schema.sql
```

3. Set up Redis (optional for development, required for production):
```bash
redis-server
```

4. Create `.env` file (copy from `.env.example` and fill in values)

5. Run migrations (if needed):
```bash
npm run migrate
```

6. Start development server:
```bash
npm run dev
```

## Environment Variables

See `.env.example` for required environment variables.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/verify-email?token=...` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server






