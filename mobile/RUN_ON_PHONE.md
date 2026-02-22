# Run Native App on Your iPhone (No App Store Needed!)

## ✅ What You Need
- iPhone connected via USB cable
- Developer Mode enabled (iOS 16+)
- Backend running (already done ✅)
- ngrok running (already done ✅)

## Step 1: Connect Your iPhone (2 minutes)

1. **Plug in your iPhone** to your Mac with a USB cable
2. **Unlock your iPhone**
3. **Tap "Trust This Computer"** if prompted (enter your iPhone passcode)

## Step 2: Enable Developer Mode (iOS 16+)

1. On your iPhone: **Settings → Privacy & Security**
2. Scroll all the way down
3. Find **"Developer Mode"** (if you don't see it, skip this step)
4. **Toggle it ON**
5. **Restart your iPhone** if prompted

## Step 3: Verify Device is Connected

Open Terminal and run:
```bash
cd ~/Desktop/guardian-connect/mobile
flutter devices
```

You should see your iPhone listed (something like "Tredoux's iPhone").

## Step 4: Run the App on Your Phone

In Terminal, run:
```bash
cd ~/Desktop/guardian-connect/mobile
flutter run
```

Flutter will:
1. Ask you to select a device - **choose your iPhone**
2. Build the app (first time takes 5-10 minutes)
3. Install it on your iPhone
4. Launch it automatically

## What Happens Next

- The app will install and launch on your iPhone
- It's a development build (not from App Store)
- You can test all features including GPS
- Changes you make will hot-reload automatically

## Troubleshooting

### iPhone Not Showing Up?
1. Try a different USB cable
2. Try a different USB port
3. Make sure iPhone is unlocked
4. Open Xcode → Window → Devices and Simulators
5. Your iPhone should appear there

### "Developer Mode" Not Showing?
- Your iPhone might be iOS 15 or earlier
- Just skip that step and try running the app

### Build Errors?
- Make sure you're in the `mobile/` folder
- Run: `flutter pub get` first
- Then try: `flutter run` again

## Success! 🎉

Once the app launches on your phone, you can:
- Test emergency alerts
- Test GPS location
- Test real-time messaging
- Everything works just like a real app!






