# Guardian Connect - Web User Interface

Simple web interface for testing the emergency system without needing Flutter.

## Quick Start

1. Install dependencies (already done):
```bash
npm install
```

2. Start the server:
```bash
npm run dev
```

3. Open in browser:
```
http://localhost:3003
```

## Test Users

- user1@example.com / password123
- user2@example.com / password123

## How to Test Emergency Flow

1. **Login as User 1:**
   - Go to http://localhost:3003
   - Login with: user1@example.com / password123

2. **Add Emergency Contact:**
   - Click "Contacts"
   - Add user2@example.com as a contact

3. **Trigger Emergency:**
   - Go back to Home
   - Click the "🚨 EMERGENCY" button
   - Emergency is created!

4. **Login as User 2 (in another browser/incognito):**
   - Go to http://localhost:3003
   - Login with: user2@example.com / password123
   - You should see the emergency alert (or check the emergency response page)

5. **Accept Emergency:**
   - Click "I CAN HELP"
   - User 2 is now responding!

6. **View Emergency:**
   - User 1 can see User 2's status change to "Responding"


