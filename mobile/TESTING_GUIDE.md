# Testing Guide - Guardian Connect Mobile App

## 🎯 Testing Options

You have several ways to test the app:

### Option 1: iOS Simulator (Recommended for GPS Testing)
### Option 2: Physical iPhone/iPad (Best for Real GPS)
### Option 3: Physical Android Device (Best for Real GPS)
### Option 4: Web Browser (Limited - GPS won't work)

## 📱 Option 1: iOS Simulator

### Step 1: Install CocoaPods
```bash
sudo gem install cocoapods
```
Enter your Mac password when prompted.

### Step 2: Install iOS Dependencies
```bash
cd mobile/ios
pod install
cd ..
```

### Step 3: Open iOS Simulator
```bash
# Open Simulator app
open -a Simulator

# Or use Flutter to open it
flutter emulators --launch apple_ios_simulator
```

### Step 4: Run the App
```bash
cd mobile
flutter run
```

**Note**: iOS Simulator has limited GPS capabilities. For real GPS testing, use a physical device.

## 📱 Option 2: Physical iPhone/iPad (Best for GPS)

### Step 1: Connect Your iPhone
1. Connect iPhone to Mac via USB cable
2. Unlock your iPhone
3. Tap "Trust This Computer" on iPhone if prompted

### Step 2: Enable Developer Mode (iOS 16+)
1. On iPhone: Settings → Privacy & Security → Developer Mode → Enable
2. Restart iPhone if prompted

### Step 3: Install CocoaPods (if not done)
```bash
sudo gem install cocoapods
cd mobile/ios
pod install
cd ..
```

### Step 4: Run the App
```bash
cd mobile
flutter devices  # Should show your iPhone
flutter run -d <device-id>  # Replace with your device ID
```

## 📱 Option 3: Physical Android Device

### Step 1: Enable Developer Options
1. On Android: Settings → About Phone
2. Tap "Build Number" 7 times
3. Go back to Settings → Developer Options
4. Enable "USB Debugging"

### Step 2: Connect Android Device
1. Connect Android to Mac via USB
2. Accept "Allow USB Debugging" prompt on Android

### Step 3: Run the App
```bash
cd mobile
flutter devices  # Should show your Android device
flutter run -d <device-id>
```

## 🌐 Option 4: Web Browser (Limited Testing)

### Run on Chrome
```bash
cd mobile
flutter run -d chrome
```

**Limitations**:
- GPS won't work (browser geolocation only)
- Maps may not work properly
- Good for UI testing only

## 🧪 What to Test

### 1. GPS Accuracy Test
1. **Trigger Emergency** - Long press the emergency button
2. **Check Console Logs** - Look for:
   - `✅ GPS-quality location: X.Xm accuracy` (GPS working)
   - `⚠️ Location accuracy: X.Xm` (may not be GPS)
3. **Expected**: 3-10 meter accuracy (GPS quality)

### 2. Map Display Test
1. **View Emergency** - Navigate to active emergency
2. **Check Map** - Google Maps should display
3. **Check Markers** - Location markers should appear
4. **Check Accuracy** - Pin should be at exact location

### 3. API Connection Test
1. **Login** - Test user authentication
2. **Create Emergency** - Test emergency creation
3. **Share Location** - Test location sharing
4. **Check Backend** - Verify data reaches backend

### 4. Navigation Test
1. **Open Maps** - Tap navigation buttons
2. **Google Maps** - Should open with exact coordinates
3. **Apple Maps** (iOS) - Should open with exact coordinates
4. **Waze** - Should open with exact coordinates

## 🔍 Debugging Tips

### View Logs
```bash
# Flutter logs
flutter logs

# Or run with verbose output
flutter run -v
```

### Check GPS Status
Look for these console messages:
- `📍 Requesting location with maximum GPS accuracy...`
- `✅ GPS-quality location: X.Xm accuracy`
- `🚨 Requesting emergency location with best-for-navigation accuracy...`

### Common Issues

#### "Location permission denied"
- Go to device Settings → Privacy → Location Services
- Enable for Guardian Connect app
- Set to "Always" for background tracking

#### "Google Maps not loading"
- Check API key is correct in AndroidManifest.xml / AppDelegate.swift
- Verify API key has Maps SDK enabled in Google Cloud Console

#### "API connection failed"
- Check backend is running: `http://localhost:3001/api`
- For physical device, update API URL to your Mac's IP: `http://192.168.1.3:3001/api`
- Check firewall isn't blocking connections

## 📝 Quick Test Checklist

- [ ] App launches successfully
- [ ] Login/Registration works
- [ ] GPS permission requested
- [ ] Emergency can be triggered
- [ ] Location accuracy ≤ 20m (GPS quality)
- [ ] Map displays correctly
- [ ] Location markers appear
- [ ] Navigation buttons work
- [ ] Backend API connects
- [ ] Location updates in real-time

## 🚀 Quick Start Commands

```bash
# Navigate to mobile folder
cd mobile

# Check available devices
flutter devices

# Run on first available device
flutter run

# Run on specific device
flutter run -d <device-id>

# View logs
flutter logs

# Hot reload (press 'r' while app is running)
# Hot restart (press 'R' while app is running)
# Quit (press 'q' while app is running)
```

## 🎯 Recommended Testing Flow

1. **Start with iOS Simulator** - Test basic functionality
2. **Test on Physical iPhone** - Test real GPS accuracy
3. **Test on Physical Android** - Test cross-platform
4. **Verify GPS Accuracy** - Should be 3-10 meters
5. **Test Map Integration** - Verify coordinates match
6. **Test Navigation** - Verify maps open correctly

## 📞 Need Help?

- Check `CONFIGURATION_COMPLETE.md` for setup status
- Check `NATIVE_SETUP.md` for detailed setup
- Check Flutter logs for error messages
- Verify backend is running and accessible





