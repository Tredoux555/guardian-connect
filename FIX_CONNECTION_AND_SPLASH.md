# Fix Connection & Splash Screen Issues

## 🔴 Problem 1: Connection Refused

**Issue:** Backend is running on port **3000**, but mobile app is trying **3001**.

**Solution:** Two options:

### Option A: Restart Backend on Port 3001 (Recommended)
```bash
# 1. Stop current backend (Ctrl+C in terminal running npm run dev)
# 2. Restart it:
cd backend
npm run dev
# Should now show: "🚀 Server running on port 3001"
```

Then change mobile app back to 3001:
```dart
// mobile/lib/config/app_config.dart
defaultValue: 'http://localhost:3001',
```

### Option B: Use Port 3000 (Quick Fix - Already Done)
✅ Mobile app is now set to port 3000 to match current backend.

**Test connection:**
```bash
curl http://localhost:3000/api/health
```

## 🔴 Problem 2: Splash Screen Not Updating

**Issue:** Flutter hot reload doesn't always pick up layout changes.

**Solution:** Full restart required:

```bash
cd mobile

# Stop the app completely (if running)
# Press 'q' in terminal or stop from IDE

# Clean build
flutter clean

# Rebuild and run
flutter run
```

**Why:** Positioning changes with `Stack` and `Positioned` often require a full rebuild, not just hot reload.

## ✅ Quick Fix Steps

1. **For connection issues:**
   - ✅ Already fixed - app now uses port 3000
   - Or restart backend on 3001 and change app back

2. **For splash screen:**
   ```bash
   cd mobile
   flutter clean
   flutter run
   ```

3. **Verify:**
   - Backend running: `lsof -i :3000`
   - App connects: Check logs for "✅ Socket connected"
   - Splash screen: Icon should be in same position as home screen

## 🎯 Expected Result

After restart:
- ✅ No more "Connection refused" errors
- ✅ Socket connects successfully
- ✅ Splash screen icon matches home screen position
- ✅ Smooth transition from splash to home





