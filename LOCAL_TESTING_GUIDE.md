# Local Testing Guide - Two Account Connectivity

## 🎯 Goal
Test emergency connectivity between two accounts using local server.

## 📋 Prerequisites

1. **Backend running locally:**
   ```bash
   cd backend
   npm run dev
   ```
   Backend should be running on `http://localhost:3001`

2. **Database running:**
   - PostgreSQL should be running
   - Database should be accessible

## 🧪 Testing Setup Options

### Option 1: Simulator + Web Browser (Easiest)

**Best for:** Quick testing, no physical devices needed

#### Setup:
1. **Account 1 - iOS Simulator:**
   ```bash
   cd mobile
   flutter run
   ```
   - App will use `http://localhost:3001` (already configured)
   - Login as: `user1@example.com` / `password123`

2. **Account 2 - Web Browser:**
   ```bash
   cd web-user
   npm run dev
   ```
   - Open browser to: `http://localhost:3003`
   - Login as: `user2@example.com` / `password123`

#### Test Flow:
1. **Account 1 (Simulator):** Trigger emergency
2. **Account 2 (Browser):** Should receive emergency notification
3. **Account 2:** Click "I CAN HELP"
4. **Both:** Should see each other's locations on map

### Option 2: Two Simulators (Advanced)

**Best for:** Testing mobile-to-mobile

#### Setup:
1. **Open two iOS Simulators:**
   ```bash
   # Terminal 1
   open -a Simulator
   
   # Terminal 2  
   open -a Simulator
   ```

2. **Run app on both:**
   ```bash
   # Terminal 1 - Simulator 1
   cd mobile
   flutter run -d <simulator-1-id>
   
   # Terminal 2 - Simulator 2
   cd mobile
   flutter run -d <simulator-2-id>
   ```

3. **Login with different accounts:**
   - Simulator 1: `user1@example.com`
   - Simulator 2: `user2@example.com`

### Option 3: Simulator + Physical Device

**Best for:** Testing real GPS accuracy

#### Setup:
1. **Find your Mac's IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Example output: `inet 192.168.1.12`

2. **Update mobile config for physical device:**
   Edit `mobile/lib/config/app_config.dart`:
   ```dart
   static const String apiBaseUrl = String.fromEnvironment(
     'API_BASE_URL',
     defaultValue: 'http://192.168.1.12:3001', // Your Mac's IP
   );
   ```

3. **Account 1 - Simulator:**
   - Uses `localhost:3001` (default)
   - Login as: `user1@example.com`

4. **Account 2 - Physical Device:**
   - Uses `192.168.1.12:3001` (your Mac's IP)
   - Login as: `user2@example.com`
   - Must be on same WiFi network

## 🔍 Testing Checklist

### Step 1: Verify Backend is Running
```bash
curl http://localhost:3001/api/health
# Should return success
```

### Step 2: Create Test Accounts
If accounts don't exist:
1. Open web-user: `http://localhost:3003`
2. Register two accounts:
   - `user1@example.com` / `password123`
   - `user2@example.com` / `password123`
3. Add each other as emergency contacts

### Step 3: Test Emergency Flow

#### Account 1 (Sender):
1. ✅ Login successfully
2. ✅ See home screen
3. ✅ Long-press emergency button
4. ✅ Confirm emergency creation
5. ✅ See "Emergency Active" screen
6. ✅ Location shared (check logs)

#### Account 2 (Receiver):
1. ✅ Login successfully
2. ✅ See home screen
3. ✅ Receive emergency notification (if socket connected)
4. ✅ See "Pending Emergency" alert
5. ✅ Click "I CAN HELP"
6. ✅ Location shared
7. ✅ See emergency map with both locations

### Step 4: Verify Connectivity

**Check Logs:**
- Account 1 logs: `✅ Emergency created successfully`
- Account 2 logs: `🚨 NEW EMERGENCY DETECTED`
- Both logs: `✅ Location shared successfully`

**Check Map:**
- Both accounts should see two markers
- Sender: Red marker
- Receiver: Blue marker

## 🐛 Troubleshooting

### "Cannot connect to backend"
**Simulator:**
- ✅ Simulator can access `localhost:3001` directly
- ✅ No IP address needed
- ✅ Check backend is running: `curl http://localhost:3001/api/health`

**Physical Device:**
- ❌ Cannot use `localhost` (that's the device itself!)
- ✅ Must use Mac's IP address: `192.168.1.12:3001`
- ✅ Both devices must be on same WiFi

### "Socket connection failed"
**For Simulator:**
- ✅ Socket should work with `localhost:3001`
- ✅ Check backend logs for socket connection

**For Physical Device:**
- ✅ Use Mac's IP: `192.168.1.12:3001`
- ✅ Check firewall allows port 3001

### "No emergency received"
1. **Check contacts:**
   - Account 1 must have Account 2 as emergency contact
   - Account 2 must have Account 1 as emergency contact

2. **Check socket connection:**
   - Look for: `✅ Socket connected successfully`
   - If failed, check backend is running

3. **Check polling:**
   - Account 2 polls `/emergencies/pending` every 3 seconds
   - Check logs: `📡 GET /emergencies/pending`

### "Location not showing"
1. **Check permissions:**
   - Simulator: Settings → Privacy → Location Services
   - Physical device: Allow location access

2. **Check logs:**
   - Look for: `✅ Location shared successfully`
   - Check coordinates are valid

## 📱 Quick Test Commands

### Start Everything:
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Web User (for Account 2)
cd web-user && npm run dev

# Terminal 3 - Mobile App (for Account 1)
cd mobile && flutter run
```

### Check Backend Health:
```bash
curl http://localhost:3001/api/health
```

### Check Mac IP (for physical device):
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

## 🎯 Recommended Testing Flow

1. **Start with Simulator + Browser** (easiest)
   - Quick to set up
   - No network configuration needed
   - Good for basic functionality

2. **Then test Simulator + Physical Device**
   - Real GPS accuracy
   - Network connectivity
   - Production-like testing

3. **Finally test Physical + Physical**
   - Full production test
   - Real-world conditions
   - Best for final validation

## ✅ Success Indicators

You'll know it's working when:
- ✅ Account 1 creates emergency
- ✅ Account 2 sees pending emergency alert
- ✅ Account 2 can accept emergency
- ✅ Both see each other's locations on map
- ✅ Real-time location updates work
- ✅ No SSL/connection errors in logs






