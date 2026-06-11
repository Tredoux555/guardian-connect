# Guardian Connect - Simplification Roadmap

## Date: 2025-12-29

## Key Insight
Remove Google Maps API dependency entirely. Users don't need an embedded map - they need to GET to the person in need.

## Current Flow (Complex)
1. Emergency triggered
2. App displays embedded Google Map with pins
3. Requires VITE_GOOGLE_MAPS_API_KEY
4. Caused Safari issues, loading issues, cost concerns

## Proposed Simplified Flow
1. Emergency triggered → browser gets GPS (native, free)
2. Coordinates shared to all responders
3. Responder clicks "Navigate" button
4. Opens their NATIVE maps app (Google Maps, Apple Maps, Waze)
5. They navigate using best-in-class navigation
6. Communication via in-app chat

## Benefits
- Zero API cost
- Zero API key management
- Works offline (native maps cache data)
- Better navigation experience
- Simpler code = fewer bugs
- Cross-platform by default

## What Guardian Connect Becomes
1. **Alert System** - Trigger emergency, notify contacts
2. **Location Sharing** - Share coordinates (not render maps)
3. **Communication Hub** - Chat during emergency

## Implementation Notes
- Keep browser geolocation API (navigator.geolocation) - it's free
- Replace embedded GoogleMap component with simple "Navigate" button
- Button uses: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
- Or detect iOS and use: `maps://maps.apple.com/?daddr=${lat},${lng}`
- Chat/messaging remains unchanged

## Status
- Current build works but shows "Google Maps API Key Missing"
- App is functional for registration, login, emergency creation
- Map display is the only broken feature
- Can be fixed by either adding API key OR implementing simplified flow

## Decision
Leave as-is for now. Note for future: implement simplified flow to remove Google dependency entirely.
