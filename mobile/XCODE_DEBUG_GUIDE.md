# Xcode Debugging Guide

## How to View Crash Logs in Xcode

1. **Open the project in Xcode:**
   ```bash
   cd mobile/ios
   open Runner.xcworkspace
   ```

2. **Select your device:**
   - In Xcode, click on the device selector at the top
   - Choose "Tredoux's iPhone"

3. **View Console Logs:**
   - Go to **View → Debug Area → Activate Console** (or press `Cmd + Shift + Y`)
   - The console will show all print statements and errors

4. **Check Device Logs:**
   - Go to **Window → Devices and Simulators**
   - Select your iPhone
   - Click "Open Console" to see system logs

5. **Common Issues to Check:**
   - Firebase initialization errors
   - Network connection errors
   - Permission errors (location, camera, etc.)
   - Missing configuration files

## Quick Fixes Applied

✅ Made Firebase initialization non-blocking
✅ Added error handling to splash screen
✅ Added error handling to home screen initialization
✅ Added global error handler

## Next Steps

1. Open Xcode and check the console for specific error messages
2. Look for any red error messages in the console
3. Share the error message and I can help fix it

