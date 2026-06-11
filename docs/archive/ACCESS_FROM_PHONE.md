# Accessing Guardian Connect from Your Phone

## Quick Setup

### 1. Make Sure Both Servers Are Running

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend should be running on port **3001** (or check your `.env` file)

**Terminal 2 - Frontend:**
```bash
cd web-user
npm run dev
```
Frontend should be running on port **3003**

### 2. Find Your Computer's IP Address

Your local IP address is: **192.168.1.14**

To verify or find a different IP:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### 3. Update Frontend Environment (If Needed)

Check `web-user/.env`:
```env
VITE_API_URL=http://192.168.1.14:3001/api
```

**Important:** Replace `localhost` with your actual IP address (`192.168.1.14`) so the phone can connect to the backend.

### 4. Access from Your Phone

1. **Make sure your phone is on the same Wi-Fi network** as your computer
2. **Open your phone's browser** (Safari on iOS, Chrome on Android)
3. **Navigate to:**
   ```
   http://192.168.1.14:3003
   ```

### 5. Troubleshooting

#### Can't Connect?
- **Check firewall:** Make sure your Mac's firewall allows connections on ports 3001 and 3003
- **Check network:** Phone and computer must be on the same Wi-Fi network
- **Check IP:** Your IP might have changed - run `ifconfig` again

#### Backend Connection Errors?
- Make sure `VITE_API_URL` in `web-user/.env` uses your IP address, not `localhost`
- Restart the frontend server after changing `.env`

#### Port Already in Use?
- Check if ports 3001 and 3003 are available:
  ```bash
  lsof -i :3001
  lsof -i :3003
  ```

### 6. Testing Push Notifications on Phone

Once connected:
1. Log in on your phone
2. The app will request notification permission
3. Test emergency alerts between devices
4. Push notifications should work even when the app is in background!

### 7. Using HTTPS (Optional)

For production or if you need HTTPS:
- Consider using **ngrok** for secure tunneling:
  ```bash
  npm install -g ngrok
  ngrok http 3003
  ```
- Or set up a local SSL certificate

## Current Configuration

- **Frontend:** `http://192.168.1.14:3003`
- **Backend:** `http://192.168.1.14:3001`
- **Network:** Same Wi-Fi required

---

**Note:** Your IP address (`192.168.1.14`) may change if you reconnect to Wi-Fi. If it stops working, check your IP again with `ifconfig`.

