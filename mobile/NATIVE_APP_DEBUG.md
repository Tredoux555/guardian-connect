# Native App Debugging Guide

## You're Using the Native Flutter App ✅

The native app is in the `mobile/` directory and is built with Flutter. This is different from the web versions.

## Key Differences for Native App

### 1. **Network Configuration**
- Native app connects to: `http://192.168.1.12:3001/api`
- This is your Mac's local IP address
- Both devices must be on the same WiFi network

### 2. **Debugging Method**
- Use **Xcode** for iOS native app debugging
- Console logs appear in Xcode's debug area
- Can also use `flutter logs` command

### 3. **Common Native App Issues**

#### White Screen Crash
- Usually caused by:
  - Firebase not configured (we made it optional)
  - Network connection failure
  - Missing permissions
  - Unhandled exceptions

#### How to Debug:
1. Open Xcode: `mobile/ios/Runner.xcworkspace`
2. Select your iPhone as target
3. Press `Cmd + Shift + Y` to open console
4. Run the app (`Cmd + R`)
5. Watch for red error messages

### 4. **Fixes Already Applied**
✅ Firebase initialization is now optional (won't crash if missing)
✅ Added error handling to splash screen
✅ Added error handling to home screen
✅ Improved socket connection error handling
✅ Added global error handler

### 5. **What to Check in Xcode Console**

Look for these messages:
- `✅ Firebase initialized successfully` - Firebase working
- `⚠️ Firebase initialization error` - Firebase missing (OK, app continues)
- `✅ Socket connected` - Socket working
- `❌ Socket error` - Socket connection failed
- `❌ Flutter Error` - App error occurred

### 6. **Next Steps**

1. **Open Xcode** and check the console
2. **Run the app** from Xcode (not Flutter CLI)
3. **Share the error message** you see in the console
4. I'll help fix the specific issue

## Quick Test

To verify the app can at least start:
```bash
cd mobile
flutter run -d "00008110-000C71A6112A401E" --verbose
```

This will show detailed logs of what's happening.

