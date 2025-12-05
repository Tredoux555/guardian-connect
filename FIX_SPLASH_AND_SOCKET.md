# Fix Splash Screen & Socket Issues

## Issue 1: Splash Screen Changes Not Visible

**Problem:** Changes to splash screen layout aren't showing up.

**Solution:**
1. ✅ Increased splash screen delay to 5 seconds (so you can see it)
2. **You need a FULL RESTART (not hot reload):**

```bash
cd /Users/tredouxwillemse/Desktop/guardian-connect/mobile

# Stop the app completely
# Press 'q' in terminal or stop from IDE

# Full rebuild
flutter clean
flutter run
```

**Why:** Layout changes with `Stack` and `Positioned` require a full rebuild, not hot reload.

## Issue 2: Socket Connection Timing Out

**Problem:** Socket.io connection times out after 15 seconds.

**Current Status:**
- ✅ Backend is running on port 3000
- ✅ Socket.io endpoint responds: `{"code":0,"message":"Transport unknown"}` (this is normal)
- ❌ Socket connection times out

**Possible Causes:**
1. Socket.io authentication might be failing
2. Transport method (polling/websocket) might not be working
3. CORS issue with socket.io

**Quick Fix - Check Backend Logs:**
When the app tries to connect, check your backend terminal for:
- `🔐 Socket auth attempt - Token provided: true`
- `✅ Socket auth: Token verified for user: ...`
- Or error messages

**Temporary Workaround:**
The app works without real-time features. Emergency polling still works every 3 seconds, so you can still receive emergencies, just not instantly.

## Next Steps

1. **For Splash Screen:**
   - Do a full restart (flutter clean + flutter run)
   - Watch the splash screen for 5 seconds
   - Icon should be in same position as home screen button

2. **For Socket:**
   - Check backend logs when app connects
   - Look for socket authentication messages
   - If auth fails, that's the issue

## Testing

After full restart:
- Splash screen should show icon in correct position for 5 seconds
- Socket will still timeout, but app will work with polling
- Check backend logs to see why socket auth might be failing






