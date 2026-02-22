# Testing on Physical Device

## Quick Setup Guide

### Step 1: Connect Your iPhone/iPad

1. **Connect via USB:**
   - Plug your iPhone/iPad into your Mac with a USB cable
   - Unlock your device
   - Tap "Trust This Computer" if prompted

2. **Enable Developer Mode (iOS 16+):**
   - On your iPhone: Settings → Privacy & Security → Developer Mode → Enable
   - Restart your iPhone if prompted

### Step 2: Verify Device is Connected

Run this command to see your device:
```bash
cd mobile
flutter devices
```

You should see your iPhone listed (not just simulator).

### Step 3: Make Sure Backend is Running

The backend must be running on your Mac:
```bash
cd backend
npm run dev
```

The backend should be accessible at: `http://192.168.1.12:3001`

### Step 4: Check Firewall

Make sure your Mac's firewall allows connections on port 3001:
- System Settings → Network → Firewall
- Or temporarily disable firewall for testing

### Step 5: Run on Your Device

```bash
cd mobile
flutter run
```

Flutter will ask you to select a device - choose your physical iPhone.

## Troubleshooting

### Device Not Showing Up

1. **Check USB connection:**
   - Try a different USB cable
   - Try a different USB port
   - Make sure device is unlocked

2. **Check Xcode:**
   - Open Xcode
   - Window → Devices and Simulators
   - Your device should appear here
   - If it shows "Unpaired", click "Trust" on your iPhone

3. **Restart Flutter:**
   ```bash
   flutter doctor
   flutter devices
   ```

### Can't Connect to Backend

1. **Check IP address:**
   - Make sure your Mac and iPhone are on the same WiFi network
   - Verify Mac's IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`

2. **Test connection from iPhone:**
   - Open Safari on iPhone
   - Go to: `http://192.168.1.12:3001/api/health` (if you have a health endpoint)
   - Or test: `http://192.168.1.12:3001`

3. **Check backend is listening on all interfaces:**
   - Backend should be running with `host: '0.0.0.0'` (already configured)

### GPS Not Working

- Physical devices have much better GPS than simulators
- Make sure Location Services are enabled on iPhone
- Grant location permission when app asks
- For best accuracy, test outdoors with clear sky view

## What to Test

1. ✅ **Login/Register** - Authentication works
2. ✅ **Emergency Alert** - Long press red button triggers emergency
3. ✅ **GPS Accuracy** - Should get 3-10 meter accuracy (much better than simulator)
4. ✅ **Contacts** - Add/view/remove contacts
5. ✅ **Receive Alerts** - Have another user trigger emergency, you should receive it
6. ✅ **Location Sharing** - Your location updates in real-time on map

## Switching Back to Simulator

If you want to test on simulator again, change these files back to `localhost`:

- `lib/services/api_service.dart` - Change `baseUrl` to `'http://localhost:3001/api'`
- `lib/services/socket_service.dart` - Change `socketUrl` to `'http://localhost:3001'`

Or create a configuration file to switch between them easily.



