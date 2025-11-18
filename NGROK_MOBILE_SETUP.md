# ngrok Setup for Mobile Testing with HTTPS

## ✅ What's Been Done

1. **Frontend updated** to detect ngrok URLs and connect to backend correctly
2. **Backend CORS** configured to allow ngrok origins
3. **Services running**:
   - ✅ Backend: Port 3001
   - ✅ Frontend: Port 3003

## 🚀 Quick Start

### Step 1: Start ngrok

Open a new terminal and run:
```bash
ngrok http 3003
```

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3003
```

### Step 2: Get Your HTTPS URL

The ngrok URL will be shown in the terminal, or visit:
- **Web Interface**: http://localhost:4040
- Look for the HTTPS URL (starts with `https://`)

### Step 3: Use on Mobile

1. Open the HTTPS URL on your phone (e.g., `https://abc123.ngrok.io`)
2. Geolocation will now work! ✅
3. The app will automatically connect to the backend

## 🔧 If ngrok Needs Authentication

If you see an authentication error:

1. **Sign up for free ngrok account**: https://dashboard.ngrok.com/signup
2. **Get your authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
4. **Start ngrok again**:
   ```bash
   ngrok http 3003
   ```

## 📱 Mobile Access Instructions

1. **Start ngrok** (see above)
2. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)
3. **Open on your phone** - Geolocation will work! ✅

## ⚠️ Important Notes

- **ngrok URLs change** each time you restart (unless you have a paid plan)
- **Free ngrok** has connection limits
- **For production**, use proper hosting with SSL certificates

## 🔍 Troubleshooting

### ngrok not starting?
- Check if port 3003 is in use: `lsof -ti:3003`
- Check ngrok logs: `cat /tmp/ngrok.log`

### Can't connect to backend?
- Backend must be running on port 3001
- Check: `lsof -ti:3001`

### Geolocation still not working?
- Make sure you're using the **HTTPS** URL (not HTTP)
- Check browser console for errors
- Ensure location permissions are granted

## ✅ Current Status

- ✅ Frontend configured for ngrok
- ✅ Backend CORS allows ngrok
- ✅ Services running
- ⏳ **You need to**: Start ngrok manually and get the HTTPS URL

---

**Next Step**: Run `ngrok http 3003` in a terminal to get your HTTPS URL!

