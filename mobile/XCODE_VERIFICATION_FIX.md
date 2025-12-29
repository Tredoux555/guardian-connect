# Fix: App Verified on iPhone but Xcode Says "Not Verified"

## The Problem
Your app runs fine on your iPhone (shows as "verified"), but Xcode shows it as "not verified" or has signing warnings.

## Why This Happens
- App was installed with one signing identity
- Xcode is using a different signing identity
- Xcode's device cache is out of sync
- Provisioning profile changed

## Quick Fix (Try This First)

### Step 1: Clean Build in Xcode
1. **Open Xcode** → `mobile/ios/Runner.xcworkspace`
2. **Product → Clean Build Folder** (Cmd + Shift + K)
3. **Close Xcode**

### Step 2: Clean Flutter Build
```bash
cd ~/Desktop/guardian-connect/mobile
flutter clean
flutter pub get
```

### Step 3: Rebuild and Install
```bash
flutter run -d 00008110-000C71A6112A401E
```

This will re-sign the app with the current Xcode signing identity.

---

## If That Doesn't Work

### Option A: Fix Signing in Xcode

1. **Open Xcode** → `mobile/ios/Runner.xcworkspace`

2. **Select "Runner" project** (blue icon in left sidebar)

3. **Select "Runner" target** (under TARGETS)

4. **Go to "Signing & Capabilities" tab**

5. **Check "Automatically manage signing"**

6. **Select your Team** (should show your Apple ID)

7. **If you see errors:**
   - Click "Try Again" button
   - Or uncheck "Automatically manage signing"
   - Wait 2 seconds
   - Check it again

8. **Build the app:**
   - Product → Build (Cmd + B)
   - Wait for it to complete

9. **Run from Xcode:**
   - Select your iPhone as target
   - Press Play button (▶️) or Cmd + R

### Option B: Delete App and Reinstall

1. **On your iPhone:**
   - Long-press the app icon
   - Tap "Remove App" → "Delete App"
   - Confirm deletion

2. **In Xcode:**
   - Window → Devices and Simulators (Cmd + Shift + 2)
   - Select your iPhone
   - If you see the old app listed, right-click → "Delete"

3. **Rebuild and install:**
   ```bash
   cd ~/Desktop/guardian-connect/mobile
   flutter clean
   flutter run -d 00008110-000C71A6112A401E
   ```

### Option C: Reset Xcode Device Cache

1. **Close Xcode completely**

2. **Delete Xcode derived data:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   ```

3. **Delete device support files:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/iOS\ DeviceSupport/*
   ```

4. **Restart Xcode**

5. **Reconnect iPhone:**
   - Unplug and replug iPhone
   - Trust computer if prompted

6. **Rebuild:**
   ```bash
   cd ~/Desktop/guardian-connect/mobile
   flutter clean
   flutter run -d 00008110-000C71A6112A401E
   ```

---

## Check Your Signing Status

### In Xcode:
1. Window → Devices and Simulators (Cmd + Shift + 2)
2. Select your iPhone
3. Look at the app list
4. Check if "Guardian Connect" shows:
   - ✅ Green checkmark = Verified
   - ⚠️ Yellow warning = Needs attention
   - ❌ Red X = Not verified

### On iPhone:
1. Settings → General → VPN & Device Management
2. Look for your developer certificate
3. Tap it → "Trust [Your Name]"
4. Confirm trust

---

## Common Issues

### "No devices available"
- Make sure iPhone is unlocked
- Check USB cable connection
- Try different USB port
- Restart both devices

### "Provisioning profile expired"
- Xcode → Preferences → Accounts
- Select your Apple ID
- Click "Download Manual Profiles"
- Or let Xcode auto-manage signing

### "Code signing failed"
- Make sure you're signed in to Xcode with your Apple ID
- Xcode → Preferences → Accounts
- Add your Apple ID if not there
- Select your team in Signing & Capabilities

---

## Verify It's Fixed

After rebuilding, check:

1. **Xcode Devices window:**
   - App should show with green checkmark ✅

2. **Run the app:**
   - Should launch without "Untrusted Developer" popup

3. **Check logs:**
   - App should run normally
   - No signing errors in console

---

## Still Not Working?

If none of the above works:

1. **Check Apple Developer account:**
   - Go to developer.apple.com
   - Make sure your account is active
   - Accept any pending agreements

2. **Update Xcode:**
   - App Store → Updates
   - Install latest Xcode version

3. **Contact Apple Support:**
   - If your developer account has issues
   - Or provisioning is completely broken

---

## Quick Command Reference

```bash
# Clean everything
cd ~/Desktop/guardian-connect/mobile
flutter clean
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Rebuild
flutter pub get
flutter run -d 00008110-000C71A6112A401E
```

---

**Most Common Fix:** Option A (Fix Signing in Xcode) usually resolves this in 2 minutes.


