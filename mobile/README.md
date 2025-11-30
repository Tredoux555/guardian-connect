# Guardian Connect Mobile App

Flutter mobile app for iOS and Android with optimized native GPS support.

## Setup Instructions

### Prerequisites

1. **Flutter SDK** (3.0.0 or higher)
   ```bash
   flutter --version
   ```

2. **Android Studio** (for Android development)
3. **Xcode** (for iOS development, macOS only)

### Installation

1. **Install dependencies:**
   ```bash
   cd mobile
   flutter pub get
   ```

2. **Platform-specific setup:**

   #### Android
   - Ensure `android/app/src/main/AndroidManifest.xml` has location permissions (see below)
   - Add Google Maps API key to `android/app/src/main/AndroidManifest.xml`

   #### iOS
   - Ensure `ios/Runner/Info.plist` has location usage descriptions (see below)
   - Add Google Maps API key to `ios/Runner/AppDelegate.swift`

### GPS Configuration

The app is configured for **maximum GPS accuracy**:

- **Standard location**: `LocationAccuracy.best` (3-10m accuracy)
- **Emergency location**: `LocationAccuracy.bestForNavigation` (best possible GPS)
- **Location streaming**: Updates every 3-5 meters
- **GPS quality validation**: Only sends locations with ≤20m accuracy (GPS-quality)

### Running the App

#### Android
```bash
flutter run -d android
```

#### iOS
```bash
flutter run -d ios
```

#### Preview/Test
```bash
flutter run
```

### Building for Production

#### Android APK
```bash
flutter build apk --release
```

#### Android App Bundle (for Play Store)
```bash
flutter build appbundle --release
```

#### iOS (requires macOS and Xcode)
```bash
flutter build ios --release
```

## GPS Accuracy Features

- ✅ Native GPS access (not browser-based)
- ✅ Maximum accuracy settings (`bestForNavigation`)
- ✅ GPS quality validation (≤20m accuracy)
- ✅ Continuous location streaming during emergencies
- ✅ Works offline (GPS doesn't require internet)
- ✅ Better map integration (same coordinate system as Google Maps)

## Platform Configuration Files

### Android: `android/app/src/main/AndroidManifest.xml`

Add these permissions inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### iOS: `ios/Runner/Info.plist`

Add these keys inside `<dict>`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to share your emergency location with responders</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location to continuously track your position during emergencies</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>We need your location to continuously track your position during emergencies</string>
```

## Troubleshooting

### GPS not working
1. Check device location services are enabled
2. Verify app has location permissions
3. Check AndroidManifest.xml / Info.plist permissions
4. Ensure device has GPS enabled (not just WiFi/cell tower location)

### Location accuracy issues
- The app uses `LocationAccuracy.bestForNavigation` for maximum GPS accuracy
- First location fix may take 10-30 seconds (GPS cold start)
- Ensure device has clear view of sky for best GPS accuracy

### Build errors
- Run `flutter clean` then `flutter pub get`
- Ensure Flutter SDK is up to date: `flutter upgrade`
- Check platform-specific requirements (Android SDK, Xcode)

