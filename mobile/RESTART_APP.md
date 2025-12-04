# How to Restart Your Flutter App

## Quick Restart (Hot Restart)

### Option 1: In Your IDE (VS Code / Android Studio)
1. Look for the **toolbar at the top** of your screen
2. Find the **circular arrow icon** (🔄) - this is "Hot Restart"
3. Click it once
4. Wait 5-10 seconds for the app to restart

### Option 2: Keyboard Shortcut
- **VS Code**: Press `Ctrl+Shift+F5` (or `Cmd+Shift+F5` on Mac)
- **Android Studio**: Press `Ctrl+Shift+F10` (or `Cmd+Shift+R` on Mac)

### Option 3: Terminal Command
Open a terminal in the `mobile/` folder and run:
```bash
cd mobile
flutter run
```

## What Changed?
✅ Added ngrok headers to fix connection issues
✅ API calls will now work through ngrok
✅ Socket connections will now work through ngrok

## After Restarting
1. Try creating an emergency again
2. The socket timeout warning might still appear, but emergency creation should work
3. Check the console logs for success messages

## Still Not Working?
- Make sure you're logged in to the app
- Check that your device/simulator has internet connection
- Look for error messages in the console





