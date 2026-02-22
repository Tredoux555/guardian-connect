# Fix Xcode Wireless Debugging Connection Issues

## Error: "Connection with the remote side was unexpectedly closed"

This error occurs when Xcode loses connection to your iPhone during wireless installation.

## Quick Fixes (Try in Order)

### Fix 1: Re-pair Wireless Connection (Most Common Solution)

1. **Disconnect wireless connection:**
   - Open Xcode
   - Go to: **Window → Devices and Simulators** (Cmd + Shift + 2)
   - Select your iPhone
   - **Uncheck** "Connect via network"
   - Wait 10 seconds

2. **Reconnect via USB:**
   - Plug iPhone into Mac with USB cable
   - Wait for device to show as "Connected" in Xcode
   - **Check** "Connect via network" again
   - Wait for wireless connection to establish (30-60 seconds)

3. **Disconnect USB and test:**
   - Unplug USB cable
   - Device should still show as "Connected" wirelessly
   - Try running the app again

### Fix 2: Restart Both Devices

1. **Restart iPhone:**
   - Hold power button → Slide to power off
   - Wait 30 seconds
   - Power back on

2. **Restart Mac:**
   - Apple menu → Restart
   - Wait for full restart

3. **Re-pair in Xcode:**
   - Follow Fix 1 steps again

### Fix 3: Use USB Cable Instead (Temporary Workaround)

If wireless keeps failing, use USB for now:

1. **Connect iPhone via USB**
2. **In Xcode:**
   - Window → Devices and Simulators
   - Select your iPhone
   - **Uncheck** "Connect via network"
3. **Run the app** - it will use USB connection

### Fix 4: Check WiFi Connection

Wireless debugging requires stable WiFi:

1. **Make sure both devices on same WiFi:**
   - iPhone: Settings → WiFi → Check network name
   - Mac: System Settings → Network → WiFi → Check network name
   - They must match exactly

2. **Check WiFi signal strength:**
   - Both devices should have strong signal (3+ bars)
   - Move closer to router if needed

3. **Try different WiFi network:**
   - Sometimes 5GHz networks work better than 2.4GHz
   - Or vice versa

### Fix 5: Clean Build and Derived Data

1. **Clean Xcode build:**
   ```bash
   cd ~/Desktop/guardian-connect/mobile/ios
   xcodebuild clean -workspace Runner.xcworkspace -scheme Runner
   ```

2. **Delete Derived Data:**
   - In Xcode: **Xcode → Settings → Locations**
   - Click arrow next to "Derived Data" path
   - Delete the `Runner-*` folder
   - Or run:
     ```bash
     rm -rf ~/Library/Developer/Xcode/DerivedData/Runner-*
     ```

3. **Clean Flutter build:**
   ```bash
   cd ~/Desktop/guardian-connect/mobile
   flutter clean
   flutter pub get
   ```

4. **Try again**

### Fix 6: Check iOS Beta Version

You're running iOS 26.2 beta - this might have bugs:

1. **Check if stable iOS version available:**
   - Settings → General → Software Update
   - Consider updating to stable release if available

2. **Or wait for beta update:**
   - Beta versions often have wireless debugging issues
   - Apple usually fixes in next beta

### Fix 7: Reset Developer Mode

1. **On iPhone:**
   - Settings → Privacy & Security → Developer Mode
   - Toggle OFF
   - Restart iPhone
   - Toggle ON again
   - Restart iPhone again

2. **Re-pair in Xcode:**
   - Follow Fix 1 steps

### Fix 8: Use Flutter CLI Instead of Xcode

Sometimes Flutter CLI handles wireless better:

1. **List devices:**
   ```bash
   cd ~/Desktop/guardian-connect/mobile
   flutter devices
   ```

2. **Run on specific device:**
   ```bash
   flutter run -d "00008110-000C71A6112A401E"
   ```

   (Replace with your device ID)

3. **If that works, use Flutter CLI for now**

## Prevention Tips

1. **Keep devices close together** during first wireless connection
2. **Don't lock iPhone** during installation
3. **Keep WiFi stable** - don't switch networks
4. **Use USB for first install** - switch to wireless after app is installed
5. **Update Xcode** - newer versions have better wireless support

## Alternative: Use USB Cable

If wireless keeps failing, just use USB:

1. Connect iPhone via USB
2. In Xcode → Devices: Uncheck "Connect via network"
3. Run app normally
4. USB is more reliable for development

## Still Having Issues?

If none of these work:

1. **Check Xcode version compatibility:**
   - You're on Xcode 16.4 with iOS 26.2 beta
   - Check Apple Developer Forums for known issues

2. **Try different Mac:**
   - Sometimes Mac WiFi hardware has issues
   - Test on another Mac if available

3. **Report to Apple:**
   - File a bug report at feedbackassistant.apple.com
   - Include the error details

## Quick Command Reference

```bash
# Check devices
flutter devices

# Clean everything
cd ~/Desktop/guardian-connect/mobile
flutter clean
cd ios
xcodebuild clean -workspace Runner.xcworkspace -scheme Runner

# Delete derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/Runner-*

# Rebuild
cd ~/Desktop/guardian-connect/mobile
flutter pub get
flutter run
```



