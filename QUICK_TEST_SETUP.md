# Quick Test Setup - Two Accounts

## 🚀 Fastest Way to Test

### Step 1: Start Backend
```bash
cd backend
npm run dev
```
✅ Backend runs on: `http://localhost:3001` (or `http://172.27.51.220:3001` from network)

### Step 2: Start Web User (Account 2)
```bash
cd web-user
npm run dev
```
✅ Web app runs on: `http://localhost:3003`
✅ Open in browser: `http://localhost:3003`

### Step 3: Start Mobile App (Account 1)
```bash
cd mobile
flutter run
```
✅ App runs on iOS Simulator
✅ Uses: `http://localhost:3001` (already configured)

## 📱 Testing Flow

### Account 1 (Mobile Simulator):
1. Register/Login: `user1@example.com` / `password123`
2. Add Account 2 as emergency contact
3. Long-press emergency button
4. Confirm emergency

### Account 2 (Web Browser):
1. Register/Login: `user2@example.com` / `password123`
2. Add Account 1 as emergency contact
3. Wait for emergency notification
4. Click "I CAN HELP"
5. See map with both locations

## 🔍 Verify It's Working

**Check Mobile Logs:**
```
✅ Emergency created successfully
✅ Location shared successfully
```

**Check Web Browser Console:**
```
🚨 NEW EMERGENCY DETECTED
✅ Location shared successfully
```

**Check Backend Logs:**
```
POST /emergencies/create - 201
POST /emergencies/:id/location - 200
```

## 🎯 Your Mac's Network IP

If you need to test with a physical device:
- **IP Address:** `172.27.51.220`
- **Backend URL:** `http://172.27.51.220:3001`
- **Web URL:** `http://172.27.51.220:3003`

To update mobile app for physical device testing:
```dart
// In mobile/lib/config/app_config.dart
defaultValue: 'http://172.27.51.220:3001',
```

## ✅ Current Configuration

- ✅ Mobile app uses `localhost:3001` (works with simulator)
- ✅ Backend listens on `0.0.0.0:3001` (accessible from network)
- ✅ Web-user uses environment variable (defaults to localhost)
- ✅ CORS allows all origins in development

## 🐛 Quick Troubleshooting

**"Cannot connect" on Simulator:**
- ✅ Backend must be running
- ✅ Check: `curl http://localhost:3001/api/health`

**"Cannot connect" on Physical Device:**
- ✅ Use Mac's IP: `172.27.51.220`
- ✅ Both devices on same WiFi
- ✅ Check firewall allows port 3001

**"No emergency received":**
- ✅ Both accounts must be emergency contacts
- ✅ Check socket connection in logs
- ✅ Check polling: `GET /emergencies/pending`






