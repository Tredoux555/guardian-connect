# 📱 Access Guardian Connect on Your Phone - Complete Setup

## ✅ Current Configuration

Your local network IP address: **192.168.1.14**

## Step 1: Update Frontend Environment File

Create or update `web-user/.env` file:

```bash
cd web-user
```

Create/update the `.env` file with:
```env
VITE_API_URL=http://192.168.1.14:3001/api
```

**Important:** Replace `localhost` with your network IP (`192.168.1.14`) so your phone can connect to the backend.

## Step 2: Restart Frontend Server

After updating `.env`, restart the frontend:

```bash
# Stop the current frontend (Ctrl+C)
# Then restart:
cd web-user
npm run dev
```

You should see:
```
VITE v4.x.x ready in xxx ms

➜  Local:   http://localhost:3003/
➜  Network: http://192.168.1.14:3003/
```

## Step 3: Verify Backend is Running

Make sure backend is running and accessible:

```bash
# Check if backend is running
curl http://192.168.1.14:3001/health
```

Should return: `{"status":"ok"}`

## Step 4: Check Firewall (Mac)

Make sure your Mac's firewall allows connections:

1. **System Settings** → **Network** → **Firewall**
2. Make sure firewall is either:
   - **Off** (for development), OR
   - **On** with ports 3001 and 3003 allowed

To allow ports manually:
```bash
# Allow port 3001 (backend)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node

# Or temporarily disable firewall for testing
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

## Step 5: Connect Your Phone

### Requirements:
- ✅ Phone and computer must be on the **same Wi-Fi network**
- ✅ Backend running on port 3001
- ✅ Frontend running on port 3003
- ✅ Firewall allows connections

### Access Steps:

1. **On your phone**, open a web browser:
   - iOS: Safari or Chrome
   - Android: Chrome or Firefox

2. **Navigate to:**
   ```
   http://192.168.1.14:3003
   ```

3. **You should see the login page!**

## Step 6: Test Emergency Features

Once logged in on your phone:

1. **Test Emergency Alert:**
   - Log in on computer with another account
   - Trigger emergency from computer
   - Phone should receive notification and play sound

2. **Test Push Notifications:**
   - Grant notification permission when prompted
   - Close the app completely
   - Trigger emergency from another device
   - Phone should show push notification
   - Click notification → app opens → sound plays

3. **Test Location Sharing:**
   - Accept emergency on phone
   - Location should be shared automatically
   - Check map on other devices

## Troubleshooting

### ❌ Can't Connect to Frontend

**Problem:** Phone can't load `http://192.168.1.14:3003`

**Solutions:**
1. Check if frontend is running: `lsof -i :3003`
2. Verify IP address: `ifconfig | grep "inet " | grep -v 127.0.0.1`
3. Make sure phone and computer are on same Wi-Fi
4. Try disabling firewall temporarily
5. Check Vite config has `host: '0.0.0.0'` (already configured ✅)

### ❌ Backend Connection Errors

**Problem:** Frontend loads but shows API errors

**Solutions:**
1. Check `VITE_API_URL` in `web-user/.env` uses network IP (not localhost)
2. Restart frontend after changing `.env`
3. Verify backend is running: `curl http://192.168.1.14:3001/health`
4. Check backend CORS allows your IP (already configured ✅)
5. Check backend is listening on `0.0.0.0` (already configured ✅)

### ❌ Sound Not Playing

**Problem:** Emergency sound doesn't play on phone

**Solutions:**
1. Check notification permission is granted
2. Check browser console for AudioContext errors
3. Try clicking notification first (user interaction required)
4. Make sure phone volume is up
5. Check if browser blocks autoplay (some browsers require user interaction first)

### ❌ Push Notifications Not Working

**Problem:** No push notification when app is closed

**Solutions:**
1. Grant notification permission when prompted
2. Check service worker is registered (check browser DevTools → Application → Service Workers)
3. Verify VAPID keys are set in backend `.env`
4. Check browser supports Web Push (Chrome, Firefox, Edge - Safari has limited support)

## Quick Test Checklist

- [ ] Backend running: `http://192.168.1.14:3001/health` returns OK
- [ ] Frontend running: `http://192.168.1.14:3003` loads
- [ ] Phone and computer on same Wi-Fi
- [ ] Firewall allows connections
- [ ] `web-user/.env` has `VITE_API_URL=http://192.168.1.14:3001/api`
- [ ] Frontend restarted after `.env` change
- [ ] Can log in on phone
- [ ] Emergency alert works
- [ ] Sound plays
- [ ] Push notifications work

## Current URLs

- **Frontend (Phone):** `http://192.168.1.14:3003`
- **Backend API:** `http://192.168.1.14:3001/api`
- **Admin Panel:** `http://192.168.1.14:3002` (if running)

## Note About IP Address

Your IP address (`192.168.1.14`) may change if you:
- Reconnect to Wi-Fi
- Restart your router
- Change networks

**If connection stops working:**
1. Run: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Update `web-user/.env` with new IP
3. Restart frontend

---

**Ready to test!** Open `http://192.168.1.14:3003` on your phone! 📱

