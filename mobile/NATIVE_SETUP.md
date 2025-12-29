# Native Mobile App Setup Guide

## Overview

The Guardian Connect mobile app is optimized for **maximum GPS accuracy** using native device GPS. This provides:
- **3-10 meter accuracy** (vs 10-50+ meters in web browsers)
- **Direct GPS access** (not WiFi/cell tower triangulation)
- **Better map integration** (same coordinate system as Google Maps/Apple Maps)
- **Works offline** (GPS doesn't require internet)

## Prerequisites

1. **Flutter SDK** (3.0.0 or higher)
   - Download from: https://flutter.dev/docs/get-started/install
   - Verify installation: `flutter doctor`

2. **Android Studio** (for Android development)
   - Download from: https://developer.android.com/studio
   - Install Android SDK and emulator

3. **Xcode** (for iOS development - macOS only)
   - Download from Mac App Store
   - Install Xcode Command Line Tools: `xcode-select --install`

4. **Google Maps API Key**
   - Get from: https://console.cloud.google.com/
   - Add to `android/app/src/main/AndroidManifest.xml` and iOS configuration

## GPS Configuration

### Current GPS Settings

The app uses **maximum GPS accuracy** with these settings:

- **Standard Location**: `LocationAccuracy.best` (3-10m accuracy)
- **Emergency Location**: `LocationAccuracy.bestForNavigation` (best possible GPS)
- **Update Frequency**: Every 3-5 meters
- **Timeout**: 30 seconds (gives GPS time for cold start)

### Location Service Methods

```dart
// Standard location (good accuracy)
LocationService.getCurrentLocation()

// Emergency location (maximum GPS accuracy)
LocationService.getEmergencyLocation()

// Continuous tracking (standard)
LocationService.getLocationStream()

// Continuous tracking (emergency - maximum accuracy)
LocationService.getEmergencyLocationStream()
```

## Setup Steps

### 1. Install Flutter

```bash
# macOS
brew install --cask flutter

# Or download from https://flutter.dev/docs/get-started/install
```

### 2. Verify Flutter Installation

```bash
flutter doctor
```

Fix any issues reported (install missing dependencies).

### 3. Initialize Flutter Project (if not already done)

```bash
cd mobile
flutter create .
```

This will create the `android/` and `ios/` folders if they don't exist.

### 4. Install Dependencies

```bash
cd mobile
flutter pub get
```

### 5. Configure Android

#### Add Google Maps API Key

Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY"/>
```

#### Verify Permissions

The `AndroidManifest.xml` already includes:
- `ACCESS_FINE_LOCATION` (GPS)
- `ACCESS_COARSE_LOCATION` (Network location)
- `ACCESS_BACKGROUND_LOCATION` (Background tracking)

### 6. Configure iOS

#### Add Google Maps API Key

Edit `ios/Runner/AppDelegate.swift`:

```swift
import GoogleMaps

GMSServices.provideAPIKey("YOUR_GOOGLE_MAPS_API_KEY")
```

#### Verify Permissions

The `Info.plist` already includes:
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `NSLocationAlwaysUsageDescription`

### 7. Configure API Endpoint

Edit `lib/services/api_service.dart`:

```dart
static const String baseUrl = 'YOUR_BACKEND_API_URL';
// Example: 'https://your-backend.railway.app/api'
```

## Running the App

### Android

```bash
# List available devices
flutter devices

# Run on connected device or emulator
flutter run

# Run on specific device
flutter run -d <device-id>

# Build APK
flutter build apk --release
```

### iOS

```bash
# List available devices
flutter devices

# Run on connected device or simulator
flutter run

# Run on specific device
flutter run -d <device-id>

# Build iOS app
flutter build ios --release
```

## Testing GPS Accuracy

### 1. Check Location Accuracy

The app logs GPS accuracy to console:
- `✅ GPS-quality location: X.Xm accuracy` (GPS, good)
- `⚠️ Location accuracy: X.Xm` (may not be GPS)

### 2. Verify GPS Usage

- **GPS Quality**: Accuracy ≤ 20 meters typically indicates GPS
- **WiFi/Cell Tower**: Accuracy > 50 meters typically indicates network location

### 3. Test Emergency Location

1. Trigger emergency from home screen
2. Check console logs for GPS accuracy
3. Verify location appears accurately on map
4. Test navigation to emergency location

## Troubleshooting

### GPS Not Working

1. **Check Permissions**
   - Android: Settings → Apps → Guardian Connect → Permissions → Location → Allow all the time
   - iOS: Settings → Privacy → Location Services → Guardian Connect → Always

2. **Check Location Services**
   - Ensure device location services are enabled
   - Try outdoors (GPS works better with clear sky view)

3. **Check API Configuration**
   - Verify Google Maps API key is correct
   - Check API key restrictions (should allow your app)

### Build Errors

1. **Android**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   flutter clean
   flutter pub get
   flutter run
   ```

2. **iOS**
   ```bash
   cd ios
   pod deintegrate
   pod install
   cd ..
   flutter clean
   flutter pub get
   flutter run
   ```

### Location Accuracy Issues

1. **Use Emergency Location Methods**
   - Use `getEmergencyLocation()` instead of `getCurrentLocation()`
   - Use `getEmergencyLocationStream()` for continuous tracking

2. **Wait for GPS Fix**
   - GPS can take 10-30 seconds for cold start
   - The app waits up to 30 seconds for GPS fix

3. **Check Device GPS**
   - Test with another GPS app to verify device GPS works
   - Try different location (outdoors, clear sky view)

## Development Tips

### Hot Reload

```bash
# Press 'r' in terminal to hot reload
# Press 'R' to hot restart
# Press 'q' to quit
```

### Debug Mode

```bash
# Run in debug mode (default)
flutter run

# Run in release mode (better performance)
flutter run --release
```

### View Logs

```bash
# Android
adb logcat | grep flutter

# iOS
# View logs in Xcode Console
```

## Next Steps

1. ✅ GPS optimized for maximum accuracy
2. ✅ Native platform configuration files created
3. ⏳ Install Flutter SDK
4. ⏳ Configure Google Maps API key
5. ⏳ Test on physical device
6. ⏳ Build release versions for app stores

## App Store Submission

### Android (Google Play)

1. Build release APK/AAB
2. Create app listing
3. Upload to Google Play Console
4. Submit for review

### iOS (App Store)

1. Build release IPA
2. Archive in Xcode
3. Upload to App Store Connect
4. Submit for review

## Support

For issues or questions:
- Check Flutter documentation: https://flutter.dev/docs
- Check geolocator package: https://pub.dev/packages/geolocator
- Check Google Maps Flutter: https://pub.dev/packages/google_maps_flutter





