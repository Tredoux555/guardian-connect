# First Time Setup Guide - Native Mobile App

This guide will walk you through setting up and running the Guardian Connect native app on your iPhone for the first time.

## Prerequisites Checklist

Before starting, make sure you have:

- [ ] Mac computer (required for iOS development)
- [ ] iPhone with USB cable
- [ ] iPhone and Mac on the same WiFi network
- [ ] Xcode installed (from App Store)
- [ ] Flutter installed (we'll check this)
- [ ] Backend server running (we'll set this up)

---

## Step 1: Verify Flutter Installation

Open Terminal and run:

```bash
flutter doctor
```

**What to look for:**
- ✅ Flutter (Channel stable) - Should be installed
- ✅ Xcode - Should be installed
- ⚠️ Android toolchain - Can ignore (we're using iOS)

**If Flutter is NOT installed:**
```bash
# Install Flutter
brew install --cask flutter

# Verify installation
flutter doctor
```

---

## Step 2: Get Your Mac's IP Address

Your iPhone needs to know your Mac's IP address to connect to the backend.

1. Open Terminal
2. Run this command:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'
```

3. **Write down this IP address** (example: `192.168.1.12`)
   - You'll need it in Step 4

**Note:** This IP might change if you reconnect to WiFi. If the app stops working, check this IP again.

---

## Step 3: Start the Backend Server

The mobile app needs the backend server running on your Mac.

1. Open Terminal
2. Navigate to the backend folder:
```bash
cd ~/Desktop/guardian-connect/backend
```

3. Install dependencies (first time only):
```bash
npm install
```

4. Start the backend server:
```bash
npm run dev
```

**What you should see:**
```
🚀 Server running on port 3001
🌐 Accessible on all network interfaces (0.0.0.0:3001)
```

5. **Keep this terminal window open** - the server must stay running

6. Test the backend is working:
   - Open a new terminal window
   - Run: `curl http://localhost:3001/health`
   - You should see: `{"status":"ok","timestamp":"..."}`

---

## Step 4: Configure the Mobile App

The mobile app needs to know your Mac's IP address.

1. Open the file: `mobile/lib/services/api_service.dart`
2. Find this line (around line 6):
```dart
static const String baseUrl = 'http://192.168.1.12:3001/api';
```
3. **Replace `192.168.1.12` with YOUR Mac's IP address** from Step 2

4. Open the file: `mobile/lib/services/socket_service.dart`
5. Find this line (around line 7):
```dart
static const String socketUrl = 'http://192.168.1.12:3001';
```
6. **Replace `192.168.1.12` with YOUR Mac's IP address** from Step 2

---

## Step 5: Connect Your iPhone

1. **Connect your iPhone to your Mac** using a USB cable
2. **Unlock your iPhone**
3. If prompted, tap **"Trust This Computer"** on your iPhone
4. Enter your iPhone passcode if asked

---

## Step 6: Enable Developer Mode on iPhone (iOS 16+)

If you're using iOS 16 or later:

1. On your iPhone: **Settings → Privacy & Security → Developer Mode**
2. Toggle **Developer Mode** to ON
3. Restart your iPhone if prompted
4. After restart, confirm you want to enable Developer Mode

---

## Step 7: Verify iPhone is Connected

1. Open Terminal
2. Run:
```bash
cd ~/Desktop/guardian-connect/mobile
flutter devices
```

**You should see your iPhone listed:**
```
Tredoux's iPhone (mobile) • 00008110-... • ios • iOS 26.2
```

If you don't see your iPhone:
- Check USB cable connection
- Make sure iPhone is unlocked
- Try a different USB port
- Open Xcode → Window → Devices and Simulators to verify connection

---

## Step 8: Install Mobile App Dependencies

1. Open Terminal
2. Navigate to mobile folder:
```bash
cd ~/Desktop/guardian-connect/mobile
```

3. Install Flutter dependencies:
```bash
flutter pub get
```

**What you should see:**
```
Resolving dependencies...
Got dependencies!
```

---

## Step 9: Open Xcode

1. Open Terminal
2. Run:
```bash
cd ~/Desktop/guardian-connect/mobile/ios
open Runner.xcworkspace
```

**Important:** Use `.xcworkspace` NOT `.xcodeproj`

Xcode should open with your project.

---

## Step 10: Configure Xcode

1. **Select your iPhone as the target:**
   - At the top of Xcode, click the device selector (next to the Play button)
   - Choose your iPhone (e.g., "Tredoux's iPhone")

2. **Open the Console (for debugging):**
   - Go to: **View → Debug Area → Activate Console**
   - Or press: `Cmd + Shift + Y`
   - This shows error messages and logs

3. **Check Signing (if needed):**
   - Click on "Runner" in the left sidebar
   - Select "Signing & Capabilities" tab
   - If you see signing errors, select your Apple ID team
   - Xcode will automatically create a development certificate

---

## Step 11: Run the App

**Option A: From Xcode (Recommended for first time)**
1. Click the **Play button** (▶️) in Xcode
2. Or press: `Cmd + R`
3. Wait for the app to build and install (first time takes 2-5 minutes)
4. The app should launch on your iPhone

**Option B: From Terminal**
```bash
cd ~/Desktop/guardian-connect/mobile
flutter run -d "00008110-000C71A6112A401E"
```
(Replace with your device ID from `flutter devices`)

---

## Step 12: Check for Errors

### If the app shows a white screen and crashes:

1. **Check Xcode Console:**
   - Look for red error messages
   - Common errors:
     - `Firebase initialization error` - This is OK, app continues without Firebase
     - `Socket connection error` - Backend might not be running
     - `Network error` - Check IP address is correct

2. **Check Backend is Running:**
   - Go back to the terminal where you ran `npm run dev`
   - Make sure it's still running
   - You should see: `🚀 Server running on port 3001`

3. **Check IP Address:**
   - Your Mac's IP might have changed
   - Run Step 2 again to get current IP
   - Update the IP in `api_service.dart` and `socket_service.dart`

### If you see permission errors:

1. **Location Permission:**
   - The app will ask for location permission
   - Tap "Allow While Using App" or "Allow Always"

2. **Network Permission:**
   - Make sure your Mac's firewall allows connections
   - System Settings → Network → Firewall
   - Or temporarily disable firewall for testing

---

## Step 13: Test the App

Once the app launches:

1. **You should see:**
   - Splash screen with "Guardian Connect" logo
   - Then either:
     - Login screen (if not logged in)
     - Home screen (if already logged in)

2. **If you see the login screen:**
   - You can create an account or log in
   - The backend must be running for this to work

3. **Test features:**
   - Login/Register
   - Emergency button
   - Location sharing
   - Contacts

---

## Troubleshooting Common Issues

### Issue: "Backend not accessible"
**Solution:**
- Make sure backend is running (`npm run dev` in backend folder)
- Check Mac's IP address hasn't changed
- Verify iPhone and Mac are on same WiFi network
- Test: Open Safari on iPhone, go to `http://YOUR_IP:3001/health`

### Issue: "Device not found"
**Solution:**
- Reconnect USB cable
- Unlock iPhone
- Trust computer if prompted
- Run `flutter devices` again

### Issue: "Signing errors in Xcode"
**Solution:**
- Xcode → Preferences → Accounts
- Add your Apple ID
- Select your team in Signing & Capabilities

### Issue: "App crashes immediately"
**Solution:**
- Check Xcode console for error messages
- Make sure Firebase is optional (we fixed this)
- Check network connection
- Verify backend is running

### Issue: "Can't connect to backend"
**Solution:**
- Check Mac's firewall settings
- Verify IP address is correct
- Make sure both devices on same WiFi
- Test backend: `curl http://YOUR_IP:3001/health` from iPhone's network

---

## Quick Reference Commands

```bash
# Get Mac's IP address
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'

# Start backend
cd ~/Desktop/guardian-connect/backend
npm run dev

# Check connected devices
cd ~/Desktop/guardian-connect/mobile
flutter devices

# Run app
flutter run -d "YOUR_DEVICE_ID"

# View logs
flutter logs -d "YOUR_DEVICE_ID"

# Open Xcode
cd ~/Desktop/guardian-connect/mobile/ios
open Runner.xcworkspace
```

---

## Next Steps After First Run

1. **Keep backend running** - The app needs it to work
2. **Note your Mac's IP** - It might change when you reconnect to WiFi
3. **Check Xcode console** - For any errors or warnings
4. **Test all features** - Login, emergency, contacts, etc.

---

## Need Help?

If you're stuck:
1. Check the Xcode console for specific error messages
2. Verify backend is running and accessible
3. Check your Mac's IP address hasn't changed
4. Make sure iPhone and Mac are on the same WiFi network

Share the specific error message and I can help fix it!

