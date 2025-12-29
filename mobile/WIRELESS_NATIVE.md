# Run Native App Wirelessly (No Cable After First Setup)

## One-Time Setup (Requires USB Cable Once)

### Step 1: Connect iPhone via USB (Just This Once)
1. Plug iPhone into Mac with USB cable
2. Unlock iPhone
3. Tap "Trust This Computer" if prompted

### Step 2: Enable Developer Mode
1. On iPhone: **Settings → Privacy & Security**
2. Scroll down to **"Developer Mode"**
3. Toggle it **ON**
4. Restart iPhone if prompted

### Step 3: Pair Wirelessly in Xcode
1. **Open Xcode**
2. Go to: **Window → Devices and Simulators** (or press `Cmd + Shift + 2`)
3. Your iPhone should appear in the left sidebar
4. **Select your iPhone**
5. **Check the box: "Connect via network"**
6. Wait for it to show "Connected" (may take 30 seconds)

### Step 4: Disconnect USB Cable
- Unplug your iPhone
- It should still show as "Connected" in Xcode

## After Setup: Run Wirelessly

### Step 1: Make Sure Both Devices on Same WiFi
- iPhone and Mac must be on the same WiFi network

### Step 2: Verify Device Shows Up Wirelessly
```bash
cd ~/Desktop/guardian-connect/mobile
flutter devices
```

You should see your iPhone listed (it will show as wireless).

### Step 3: Run the App
```bash
cd ~/Desktop/guardian-connect/mobile
flutter run
```

Select your iPhone when prompted - it will install and run wirelessly!

## Troubleshooting

### iPhone Not Showing as Wireless?
1. Make sure both devices are on same WiFi
2. In Xcode → Devices, make sure "Connect via network" is checked
3. Try unchecking and re-checking it
4. Restart both devices

### Can't Connect?
- The first wireless connection might take a minute
- Make sure iPhone is unlocked
- Make sure Developer Mode is enabled

## Success! 🎉

After this one-time setup, you can:
- Run the app wirelessly anytime
- No USB cable needed
- Full native app experience
- Works from anywhere on your WiFi network






