# Mobile Device Access Guide

## Current Configuration

- **Mac IP Address**: `192.168.1.3`
- **Backend URL**: `http://192.168.1.3:3001/api`
- **Web User App URL**: `http://192.168.1.3:3003`
- **Backend Port**: `3001` (listening on `0.0.0.0` - accessible from network)
- **Web User Port**: `3003` (configured with `host: true` - accessible from network)

## Accessing from iPhone

### Prerequisites
1. Mac and iPhone must be on the **same Wi-Fi network**
2. Backend server must be running
3. Web-user dev server must be running

### Steps

1. **Start the servers** (if not already running):
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   
   # Terminal 2 - Web User
   cd web-user
   npm run dev
   ```

2. **On your iPhone**:
   - Open Safari browser
   - Navigate to: `http://192.168.1.3:3003`
   - You should see the login page

3. **If connection fails**:
   - Check Mac firewall: System Settings > Network > Firewall
   - Ensure ports 3001 and 3003 are allowed
   - Verify both devices are on same Wi-Fi network
   - Check Mac's IP hasn't changed: `ifconfig | grep "inet " | grep -v 127.0.0.1`

## Testing Checklist

- [ ] iPhone can access login page
- [ ] Can log in successfully
- [ ] Socket connection works (check browser console)
- [ ] Messages send/receive instantly
- [ ] Audio recording works
- [ ] Video recording works
- [ ] Map displays correctly
- [ ] Google Maps directions link works

## Troubleshooting

### Connection Issues
- **"Network Error"**: Check Mac firewall settings
- **"CORS Error"**: Backend CORS is configured for local network IPs (192.168.x.x)
- **"Socket timeout"**: Verify backend is running and accessible

### IP Address Changed
If your Mac's IP address changes:
1. Find new IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Update `web-user/.env`: `VITE_API_URL=http://[NEW_IP]:3001/api`
3. Restart web-user dev server

### Alternative: ngrok (For External Testing)
If local network doesn't work, use ngrok:

```bash
# Install ngrok
brew install ngrok

# Terminal 1 - Backend tunnel
ngrok http 3001

# Terminal 2 - Web User tunnel  
ngrok http 3003

# Update web-user/.env with ngrok backend URL
VITE_API_URL=https://[ngrok-backend-url]/api
```

Then access from iPhone using the ngrok web-user URL.

## Current Status

✅ All fixes implemented:
- Recording timers fixed (separate refs for audio/video)
- Duplicate messages fixed (skip socket message from current user)
- Google Maps marker offset increased (10m for identical locations)
- Network configuration ready (IP: 192.168.1.3)
- CORS configured for local network access





