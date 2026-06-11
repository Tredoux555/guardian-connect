# Xcode Restart Guide - Seeing Splash Screen Changes

## ⚠️ Simple Restart May Not Be Enough

If you're running from **Xcode directly** (not `flutter run`), a simple stop/restart might not show layout changes.

## ✅ Proper Reset Steps

### Option 1: Clean Build in Xcode (Recommended)

1. **Stop the app** (if running)

2. **Clean Build Folder:**
   - Press: `Cmd + Shift + K` (or Product → Clean Build Folder)
   - This clears cached build artifacts

3. **Rebuild and Run:**
   - Press: `Cmd + R` (or Product → Run)
   - Xcode will do a full rebuild

### Option 2: Use Flutter Commands (More Reliable)

1. **Stop the app** in Xcode

2. **Open Terminal:**
   ```bash
   cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile
   flutter clean
   flutter run
   ```

3. **Or build for Xcode:**
   ```bash
   flutter clean
   flutter build ios --debug
   ```
   Then run from Xcode

## 🎯 Why This Matters

**Layout changes** (like `Stack` and `Positioned` in splash screen) require:
- ✅ Full rebuild (not just restart)
- ✅ Clearing cached build artifacts
- ❌ Hot reload won't work
- ❌ Simple restart might use cached layout

## ✅ Quick Test

After cleaning and rebuilding:
- Splash screen should show for **5 seconds** (I increased the delay)
- Icon should be in **same position** as home screen button
- Text "Guardian Connect" should be **below the icon**

## 🔍 If Changes Still Don't Show

1. **Verify the code is saved:**
   - Check `mobile/lib/screens/splash_screen.dart`
   - Should have `Stack` with `Positioned` widget

2. **Check build output:**
   - Look for "Building..." not "Hot reload"
   - Should see full compilation

3. **Try Flutter commands:**
   ```bash
   cd mobile
   flutter clean
   flutter pub get
   flutter run
   ```

## 💡 Recommendation

**Use Flutter commands** (`flutter clean` + `flutter run`) - more reliable for layout changes than Xcode's build system.






