# Run App on Phone Without USB Cable

## Option 1: Web App in Safari (Easiest - No Setup!)

Since you're using ngrok, you can use the **web version** in Safari on your iPhone:

### Steps:
1. **Make sure web app is running:**
   ```bash
   cd ~/Desktop/guardian-connect/web-user
   npm run dev
   ```

2. **Get the ngrok URL for web app:**
   - Open a new terminal
   - Run: `ngrok http 3003`
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

3. **Open on your iPhone:**
   - Open Safari on your iPhone
   - Go to the ngrok URL
   - The web app will work just like the native app!

**Pros:**
- ✅ No setup needed
- ✅ Works immediately
- ✅ Full functionality (GPS, messaging, etc.)
- ✅ Works from anywhere (not just same WiFi)

**Cons:**
- ⚠️ Runs in browser (not native app)
- ⚠️ Slightly different UI

---

## Option 2: Wireless Debugging (Native App)

For the **native Flutter app** without cable, you need to set up wireless debugging:

### One-Time Setup (Requires USB Cable Once):

1. **Connect iPhone via USB** (just this once)
2. **Enable Developer Mode:**
   - Settings → Privacy & Security → Developer Mode → ON
   - Restart iPhone

3. **Pair in Xcode:**
   - Open Xcode
   - Window → Devices and Simulators
   - Select your iPhone
   - Check "Connect via network" checkbox
   - Wait for it to pair

4. **Disconnect USB cable**

### After Setup:

1. **Make sure iPhone and Mac are on same WiFi**
2. **Run the app:**
   ```bash
   cd ~/Desktop/guardian-connect/mobile
   flutter run
   ```
3. **Select your iPhone** (it should show as wireless)

**Pros:**
- ✅ True native app
- ✅ Better performance
- ✅ Full native features

**Cons:**
- ⚠️ Requires one-time USB setup
- ⚠️ Must be on same WiFi network

---

## Recommendation

**For quick testing:** Use Option 1 (Web App in Safari)
- Fastest way to test
- No setup needed
- Works from anywhere

**For full native experience:** Use Option 2 (Wireless Debugging)
- Better performance
- True native app
- Requires one-time USB pairing





