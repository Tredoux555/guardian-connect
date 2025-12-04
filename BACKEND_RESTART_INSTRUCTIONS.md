# Backend Restart Required

## ⚠️ Issue
Your backend is still running on **port 3000** (old configuration), but your mobile app is trying to connect to **port 3001**.

## ✅ Solution: Restart Backend

The code has been updated to use port 3001, but you need to restart the backend server for the change to take effect.

### Steps:

1. **Stop the current backend:**
   - Find the terminal where `npm run dev` is running
   - Press `Ctrl+C` to stop it

2. **Restart the backend:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Verify it's running on port 3001:**
   You should see:
   ```
   🚀 Server running on port 3001
   🌐 Accessible on all network interfaces (0.0.0.0:3001)
   ```

4. **Test the connection:**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Should return success.

5. **Restart Flutter app:**
   - Stop the app (if running)
   - Run: `flutter run` again

## 🔍 Quick Check

**Before restart:**
```bash
lsof -i :3000  # Should show node process
lsof -i :3001  # Should be empty
```

**After restart:**
```bash
lsof -i :3001  # Should show node process
curl http://localhost:3001/api/health  # Should work
```

## ✅ Success Indicators

After restarting, you should see:
- ✅ Backend logs: `🚀 Server running on port 3001`
- ✅ Flutter logs: `✅ Socket connected successfully`
- ✅ No more "Connection refused" errors





