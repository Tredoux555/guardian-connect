# Continuous Emergency Sound Implementation

## Overview
Implemented a continuous, high-priority emergency alert sound that plays until the user responds to an emergency. The sound is designed to be impossible to ignore - someone's life is in danger.

## Key Features

### 1. Continuous Tone (Not Short Beeps)
- **Before**: 3 short beeps (0.9 seconds total)
- **After**: Single continuous tone that plays indefinitely until user responds
- Frequency: 1000 Hz (higher than before for more urgency)
- Volume: 0.8 gain (maximum allowed by browsers)

### 2. Plays Until User Responds
- Sound continues playing until:
  - User clicks "I CAN HELP" button
  - User clicks "UNAVAILABLE" button
  - User clicks on the notification
  - User navigates to the response page

### 3. Maximum Priority Settings
- `requireInteraction: true` - Notification stays visible until user interacts
- `silent: false` - Sound is enabled (nothing is more important)
- `renotify: true` - Re-notifies even if notification already exists
- Stronger vibration pattern: `[200, 100, 200, 100, 200, 100, 200, 100, 200]`
- Direct link to response page: `/respond/${emergencyId}`

### 4. Works in Background
- Service Worker plays continuous sound even when app is closed
- Sound file loops continuously if available
- Generated tone plays continuously as fallback

## Implementation Details

### Files Modified

#### 1. `web-user/src/services/notifications.ts`
- Added global state variables for sound control:
  - `emergencySoundContext`
  - `emergencySoundOscillator`
  - `emergencySoundGain`
  - `emergencySoundAudio`
- **`playEmergencySound()`**: Now plays continuous tone instead of 3 beeps
- **`stopEmergencySound()`**: New function to stop the continuous sound
- Updated notification options for maximum priority

#### 2. `web-user/public/service-worker.js`
- Added global sound state variables
- **`playEmergencySound()`**: Plays continuous tone in background
- **`stopEmergencySound()`**: Stops sound when user responds
- Updated notification click handler to stop sound immediately
- Added message handler for `STOP_EMERGENCY_SOUND` from main app

#### 3. `web-user/src/pages/EmergencyResponse.tsx`
- Imports `stopEmergencySound` from notifications service
- Stops sound when component mounts (user reaches response page)
- Stops sound when user clicks "I CAN HELP"
- Stops sound when user clicks "UNAVAILABLE"
- Sends message to service worker to stop background sound

## Sound Behavior

### When Emergency is Triggered
1. Push notification is received (even if app is closed)
2. Service Worker starts playing continuous tone
3. Main app (if open) also starts playing continuous tone
4. Notification appears with maximum priority settings
5. Screen wakes up (if supported)
6. Vibration pattern starts

### When User Responds
1. User clicks notification OR navigates to response page OR clicks button
2. Sound stops immediately in both Service Worker and main app
3. User can then accept or reject the emergency

## Technical Notes

### Browser Limitations
- Browsers limit audio autoplay for security
- Sound will play when:
  - User has interacted with the page (clicked/tapped)
  - Notification is clicked
  - App is in the foreground
- For true background (app closed), Service Worker handles it, but browser restrictions may still apply

### Volume Limits
- Browsers typically limit gain to ~0.5 for safety
- We use 0.8 gain to try for maximum volume
- Actual volume may be capped by browser/OS

### Sound Sources
1. **Primary**: Generated continuous sine wave (1000 Hz)
2. **Secondary**: Audio file loop (`/emergency-alert.mp3`) if available
3. Both play simultaneously for maximum impact

## Testing

To test the continuous sound:
1. Trigger an emergency from one account
2. Receive notification on another account
3. Verify sound plays continuously
4. Click "I CAN HELP" or "UNAVAILABLE"
5. Verify sound stops immediately

## Future Enhancements

Potential improvements:
- Add different sound patterns for different emergency types
- Allow users to customize emergency sound
- Add visual flashing/color changes during emergency
- Implement sound escalation (gets louder over time)

