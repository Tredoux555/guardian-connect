# APNS (Apple Push Notification Service) Setup Guide

## Issue
The app is showing this error:
```
no valid "aps-environment" entitlement string found for application
❌ Failed to initialize push notifications: [firebase_messaging/apns-token-not-set]
```

## Solution

The `Runner.entitlements` file exists and contains the correct configuration, but Xcode needs to be configured to recognize it.

### Steps to Fix:

1. **Open Xcode Project**
   ```bash
   cd mobile/ios
   open Runner.xcworkspace
   ```
   (Note: Open `.xcworkspace`, NOT `.xcodeproj`)

2. **Select the Runner Target**
   - In the left sidebar, click on "Runner" (blue icon)
   - Select the "Runner" target (not the project)

3. **Go to Signing & Capabilities Tab**
   - Click on the "Signing & Capabilities" tab at the top

4. **Add Push Notifications Capability**
   - Click the "+ Capability" button
   - Search for "Push Notifications"
   - Double-click to add it
   - This will automatically add the `aps-environment` entitlement

5. **Verify Entitlements File**
   - In the "Signing & Capabilities" tab, you should see:
     - Push Notifications capability
     - Entitlements File: `Runner/Runner.entitlements`
   - If the entitlements file is not listed, click the "+" next to "Entitlements File" and select `Runner.entitlements`

6. **Verify Entitlements File Contents**
   - In Xcode, open `Runner/Runner.entitlements`
   - It should contain:
     ```xml
     <key>aps-environment</key>
     <string>development</string>
     ```
   - For production builds, change `development` to `production`

7. **Clean and Rebuild**
   ```bash
   cd mobile
   flutter clean
   flutter pub get
   cd ios
   pod install
   flutter build ios --simulator --debug
   ```

## For Production Builds

When building for App Store or TestFlight:
1. Change `aps-environment` from `development` to `production` in `Runner.entitlements`
2. Ensure your Apple Developer account has Push Notifications enabled
3. Upload your APNs certificate to Firebase Console

## Testing

After fixing:
1. Run the app on a **physical iOS device** (simulator doesn't support push notifications)
2. Check logs for: `✅ APNS token received`
3. Check logs for: `✅ FCM token registered with backend`

## Notes

- Push notifications **do not work on iOS Simulator** - you must test on a physical device
- The `aps-environment` entitlement must match your build configuration:
  - `development` for debug builds
  - `production` for release/App Store builds



