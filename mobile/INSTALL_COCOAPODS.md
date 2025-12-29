# Install CocoaPods - Quick Guide

## 🎯 What You Need to Do

CocoaPods is required for iOS development. Here's how to install it:

## Step 1: Install CocoaPods

Open Terminal and run:
```bash
sudo gem install cocoapods
```

**Enter your Mac password when prompted** (you won't see the password as you type - this is normal).

This will take 1-2 minutes to install.

## Step 2: Install iOS Dependencies

After CocoaPods is installed, run:
```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile/ios
pod install
cd ..
```

This will download iOS dependencies and may take a few minutes.

## Step 3: Run the App

Once CocoaPods is installed and dependencies are downloaded:
```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile
flutter run
```

The app should launch on your iPhone 16 Plus simulator!

## ✅ Verification

After installing CocoaPods, verify it works:
```bash
pod --version
```

You should see a version number (e.g., `1.15.2`).

## 🚀 Quick Copy-Paste Commands

Run these commands one by one:

```bash
# 1. Install CocoaPods (enter password when prompted)
sudo gem install cocoapods

# 2. Install iOS dependencies
cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile/ios
pod install
cd ../..

# 3. Run the app
cd mobile
flutter run
```

## ⚠️ Troubleshooting

### "Permission denied"
- Make sure you're using `sudo` (requires password)
- Try: `sudo gem install -n /usr/local/bin cocoapods`

### "Command not found: pod"
- CocoaPods didn't install correctly
- Try: `gem install cocoapods` (without sudo, using user install)
- Then add to PATH if needed

### "Pod install fails"
- Make sure you're in the `mobile/ios` directory
- Check internet connection
- Try: `pod install --repo-update`

## 📱 After Installation

Once CocoaPods is installed, you can:
1. Run `flutter run` to launch the app
2. Test GPS functionality
3. Test maps and navigation
4. Verify everything works!





