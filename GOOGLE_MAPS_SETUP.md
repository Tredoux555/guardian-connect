# Google Maps Setup Guide

## ✅ What's Been Installed

- `@react-google-maps/api` - React wrapper for Google Maps
- `@types/google.maps` - TypeScript types for Google Maps

## 🔑 Getting a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Maps JavaScript API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key

## 📝 Configuration

Add your API key to `web-user/.env`:

```env
VITE_GOOGLE_MAPS_API_KEY=your-actual-api-key-here
```

## 🚀 Features Implemented

- ✅ Google Maps display on emergency active page
- ✅ Real-time location markers for participants
- ✅ Emergency location marker (red, larger)
- ✅ Participant location markers (blue)
- ✅ Click markers to see info (name, timestamp)
- ✅ Auto-centers map on first location
- ✅ Updates every 3 seconds with new locations

## 📍 How It Works

1. When an emergency is active, the map displays
2. Accepted participants automatically share their location
3. Locations appear as markers on the map
4. Emergency creator's location is shown in red
5. Other participants' locations are shown in blue
6. Click any marker to see details

## ⚠️ Note

The map will show a warning if the API key is not configured. This is normal for development - you can test the rest of the app without it, but maps won't display.


