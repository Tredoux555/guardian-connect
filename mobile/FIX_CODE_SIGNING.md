# Fix Code Signing Issue

## The Problem
Xcode says "Your team has no devices" even though your iPhone is connected.

## Solution: Manual Device Registration

### Option 1: Try Building Directly (Easiest)
Sometimes building directly triggers device registration:

```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile
flutter run -d 00008110-000C71A6112A401E
```

If this fails, try Option 2.

### Option 2: Register Device Manually in Xcode

1. **Open Xcode** (if not already open)
   - Window → Devices and Simulators (Cmd + Shift + 2)

2. **Check Device Status**
   - Your iPhone should appear in the left sidebar
   - If it shows a yellow warning, click on it
   - Look for any error messages

3. **In Xcode Project Settings:**
   - Click "Runner" project (blue icon)
   - Select "Runner" target
   - Go to "Signing & Capabilities" tab
   - Uncheck "Automatically manage signing"
   - Wait 2 seconds
   - Check "Automatically manage signing" again
   - This forces Xcode to re-detect your device

4. **Alternative: Add Device UDID Manually**
   - Your device UDID: `00008110-000C71A6112A401E`
   - In Xcode: Preferences → Accounts
   - Select your Apple ID
   - Click "Manage Certificates"
   - The device should auto-register when you build

### Option 3: Use Simulator Instead (Quick Test)

If you just want to test the app quickly:

```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile
flutter run -d 2C06508F-3A4D-4607-9D50-CB9226EA4835
```

This runs on the iPhone 16 Plus simulator (no code signing needed).

### Option 4: Check Developer Mode on iPhone

1. On your iPhone: Settings → Privacy & Security
2. Scroll all the way down
3. Look for "Developer Mode" - if it's there, enable it
4. Restart your iPhone if prompted

### Option 5: Trust Computer Again

1. Unplug your iPhone
2. Plug it back in
3. On iPhone: Tap "Trust This Computer" if prompted
4. Enter your iPhone passcode
5. Try Xcode again

## What Usually Works

The most common fix is **Option 2** - unchecking and re-checking "Automatically manage signing" in Xcode. This forces Xcode to re-detect and register your device.

## Still Not Working?

If none of these work, the issue might be:
- Your Apple ID needs to accept Apple Developer Terms
- Network connectivity to Apple's servers
- Xcode cache issues

Try restarting Xcode and your Mac if nothing else works.



