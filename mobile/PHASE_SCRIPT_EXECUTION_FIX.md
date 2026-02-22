# Fix: PhaseScriptExecution Failed with Nonzero Exit Code

## Problem
Xcode build fails with error: "Command PhaseScriptExecution failed with a nonzero exit code"

## Root Causes Identified

1. **CocoaPods Encoding Issue**: Terminal encoding was not set to UTF-8, causing CocoaPods to fail
2. **Pods Out of Sync**: Podfile.lock and Manifest.lock may have been out of sync
3. **Flutter Configuration**: Flutter configuration files needed regeneration

## Fixes Applied

### ✅ Fix 1: CocoaPods Encoding
Set UTF-8 encoding for CocoaPods:
```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

### ✅ Fix 2: Pod Installation
Reinstalled CocoaPods dependencies:
```bash
cd mobile/ios
pod install
```

### ✅ Fix 3: Flutter Configuration Regeneration
Regenerated Flutter configuration files:
```bash
cd mobile
flutter clean
flutter pub get
```

## Verification

✅ Pods are in sync (Podfile.lock matches Manifest.lock)
✅ Flutter backend script exists at correct path
✅ Flutter configuration files regenerated
✅ CocoaPods dependencies installed successfully

## If Build Still Fails

### Step 1: Clean Everything
```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile
flutter clean
cd ios
rm -rf Pods Podfile.lock
pod install
```

### Step 2: Set Encoding in Your Shell Profile
Add to `~/.zshrc` (or `~/.bash_profile` if using bash):
```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

Then reload:
```bash
source ~/.zshrc
```

### Step 3: Clean Xcode Build
1. Open Xcode → `mobile/ios/Runner.xcworkspace`
2. Product → Clean Build Folder (Cmd + Shift + K)
3. Close Xcode
4. Delete derived data:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   ```

### Step 4: Rebuild
```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile
flutter clean
flutter pub get
cd ios
pod install
flutter build ios
```

## Common PhaseScriptExecution Errors

### Error: "The sandbox is not in sync with the Podfile.lock"
**Solution:**
```bash
cd mobile/ios
pod install
```

### Error: "Flutter backend script not found"
**Solution:**
```bash
cd mobile
flutter clean
flutter pub get
```

### Error: "Unicode Normalization not appropriate"
**Solution:**
```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
cd mobile/ios
pod install
```

## Build Script Phases in Xcode

The following script phases run during build:
1. **[CP] Check Pods Manifest.lock** - Verifies Podfile.lock matches Manifest.lock
2. **Run Script** - Runs Flutter backend script (`xcode_backend.sh`)
3. **[CP] Copy Pods Resources** - Copies CocoaPods resources

If any of these fail, you'll see "PhaseScriptExecution failed".

## Status

✅ All fixes applied successfully
✅ Ready to build

## Next Steps

1. Try building in Xcode or with `flutter build ios`
2. If errors persist, check the specific script phase that's failing in Xcode build log
3. Share the specific error message for further troubleshooting

