# Quick Start Checklist - First Time Setup

Follow these steps in order. Check off each item as you complete it.

## Before You Start

- [ ] Mac computer ready
- [ ] iPhone with USB cable
- [ ] iPhone and Mac on same WiFi network

---

## Step 1: Check Prerequisites (5 minutes)

- [ ] Open Terminal
- [ ] Run: `flutter doctor`
- [ ] Verify Flutter and Xcode are installed
- [ ] If not installed: `brew install --cask flutter`

---

## Step 2: Get Mac's IP Address (1 minute)

- [ ] Open Terminal
- [ ] Run: `ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'`
- [ ] **Write down the IP address** (e.g., `192.168.1.12`)
- [ ] You'll need this in Step 4

---

## Step 3: Start Backend Server (2 minutes)

- [ ] Open Terminal
- [ ] Run: `cd ~/Desktop/guardian-connect/backend`
- [ ] Run: `npm install` (first time only)
- [ ] Run: `npm run dev`
- [ ] **Keep this terminal open** - server must stay running
- [ ] Verify you see: `🚀 Server running on port 3001`

---

## Step 4: Update Mobile App IP Address (2 minutes)

- [ ] Open file: `mobile/lib/services/api_service.dart`
- [ ] Find line 6: `static const String baseUrl = 'http://192.168.1.12:3001/api';`
- [ ] Replace `192.168.1.12` with **YOUR Mac's IP** from Step 2
- [ ] Save file

- [ ] Open file: `mobile/lib/services/socket_service.dart`
- [ ] Find line 7: `static const String socketUrl = 'http://192.168.1.12:3001';`
- [ ] Replace `192.168.1.12` with **YOUR Mac's IP** from Step 2
- [ ] Save file

---

## Step 5: Connect iPhone (1 minute)

- [ ] Connect iPhone to Mac with USB cable
- [ ] Unlock iPhone
- [ ] Tap "Trust This Computer" if prompted
- [ ] Enter passcode if asked

---

## Step 6: Enable Developer Mode (iOS 16+) (2 minutes)

- [ ] On iPhone: Settings → Privacy & Security → Developer Mode
- [ ] Toggle Developer Mode ON
- [ ] Restart iPhone if prompted
- [ ] Confirm Developer Mode after restart

---

## Step 7: Verify iPhone Connection (1 minute)

- [ ] Open Terminal
- [ ] Run: `cd ~/Desktop/guardian-connect/mobile`
- [ ] Run: `flutter devices`
- [ ] **Verify your iPhone appears in the list**

If iPhone doesn't appear:
- Check USB connection
- Make sure iPhone is unlocked
- Try different USB port

---

## Step 8: Install Dependencies (2 minutes)

- [ ] In Terminal (still in mobile folder)
- [ ] Run: `flutter pub get`
- [ ] Wait for "Got dependencies!" message

---

## Step 9: Open Xcode (1 minute)

- [ ] In Terminal
- [ ] Run: `cd ~/Desktop/guardian-connect/mobile/ios`
- [ ] Run: `open Runner.xcworkspace`
- [ ] Wait for Xcode to open

---

## Step 10: Configure Xcode (2 minutes)

- [ ] In Xcode, select your iPhone from device dropdown (top toolbar)
- [ ] Press `Cmd + Shift + Y` to open console
- [ ] Click "Runner" in left sidebar
- [ ] Go to "Signing & Capabilities" tab
- [ ] Select your Apple ID team (if signing errors appear)

---

## Step 11: Run the App (5-10 minutes first time)

- [ ] In Xcode, click Play button (▶️) or press `Cmd + R`
- [ ] Wait for build to complete (first time takes 5-10 minutes)
- [ ] App should launch on your iPhone

---

## Step 12: Test the App (2 minutes)

- [ ] App should show splash screen, then login screen
- [ ] If you see login screen: ✅ Success!
- [ ] If white screen/crash: Check Xcode console for errors

---

## Troubleshooting

### App shows white screen and crashes?
- [ ] Check Xcode console (`Cmd + Shift + Y`) for error messages
- [ ] Verify backend is still running (Step 3)
- [ ] Check Mac's IP address hasn't changed (Step 2)
- [ ] Make sure iPhone and Mac on same WiFi

### Can't connect to backend?
- [ ] Verify backend is running: `curl http://localhost:3001/health`
- [ ] Check Mac's firewall settings
- [ ] Verify IP address in both service files is correct

### iPhone not showing up?
- [ ] Reconnect USB cable
- [ ] Unlock iPhone
- [ ] Trust computer if prompted
- [ ] Try: Xcode → Window → Devices and Simulators

---

## Success! 🎉

If you see the login screen, you're all set!

**Next steps:**
- Create an account or log in
- Test emergency features
- Add emergency contacts

**Remember:**
- Keep backend server running (`npm run dev`)
- If Mac's IP changes, update the IP in both service files

---

## Need Help?

See detailed guide: `FIRST_TIME_SETUP.md`

