# Quick Start - Native Mobile App

## ✅ What's Already Done

1. **GPS Optimized** - Using `LocationAccuracy.best` and `bestForNavigation`
2. **Android Configuration** - AndroidManifest.xml with GPS permissions
3. **iOS Configuration** - Info.plist with location permissions
4. **Emergency Screens** - Using maximum GPS accuracy
5. **Home Screen** - Updated to use emergency location

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Flutter

```bash
# macOS
brew install --cask flutter

# Or download from https://flutter.dev/docs/get-started/install
```

### Step 2: Verify Installation

```bash
flutter doctor
```

### Step 3: Navigate to Mobile Folder

```bash
cd mobile
```

### Step 4: Get Dependencies

```bash
flutter pub get
```

### Step 5: Initialize Platforms (if needed)

```bash
flutter create .
```

### Step 6: Configure API Endpoint

Edit `lib/services/api_service.dart`:

```dart
static const String baseUrl = 'YOUR_BACKEND_URL';
// Example: 'https://your-backend.railway.app/api'
```

### Step 7: Add Google Maps API Key

**Android**: Edit `android/app/src/main/AndroidManifest.xml`
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY"/>
```

**iOS**: Edit `ios/Runner/AppDelegate.swift`
```swift
import GoogleMaps
GMSServices.provideAPIKey("YOUR_GOOGLE_MAPS_API_KEY")
```

### Step 8: Run the App

```bash
# List devices
flutter devices

# Run on device/emulator
flutter run
```

## 📱 Testing GPS

1. **Trigger Emergency** - Long press the emergency button
2. **Check Console** - Look for GPS accuracy logs:
   - `✅ GPS-quality location: X.Xm accuracy` = GPS working
   - `⚠️ Location accuracy: X.Xm` = May not be GPS
3. **Verify Map** - Location should appear accurately on map

## 🎯 GPS Accuracy Levels

- **Standard**: `LocationAccuracy.best` (3-10m)
- **Emergency**: `LocationAccuracy.bestForNavigation` (best possible)

## 📋 Next Steps

1. Install Flutter SDK
2. Configure Google Maps API key
3. Set backend API URL
4. Test on physical device
5. Build release versions

See `NATIVE_SETUP.md` for detailed instructions.





