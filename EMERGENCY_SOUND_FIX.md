# Emergency Sound and Push Notification Fix

## Changes Made

### 1. AudioContext Resume Logic
- **File:** `web-user/src/services/notifications.ts`
- **Fix:** Added AudioContext state check and resume logic
- **Why:** Browsers suspend AudioContext until user interaction. We now check if suspended and resume before playing sound.

### 2. Service Worker AudioContext Resume
- **File:** `web-user/public/service-worker.js`
- **Fix:** Added same AudioContext resume logic for background notifications
- **Why:** Service worker also needs to handle suspended AudioContext state.

### 3. Notification Click Handler
- **File:** `web-user/public/service-worker.js`
- **Fix:** Updated to send message to client when notification is clicked
- **Why:** Notification click counts as user interaction, allowing audio to play.

### 4. EmergencyResponse Page
- **File:** `web-user/src/pages/EmergencyResponse.tsx`
- **Fix:** Added message listener to ensure sound plays when notification is clicked
- **Why:** When user clicks notification, we need to ensure sound starts playing.

## How It Works Now

### When Emergency is Received (App Open)
1. Socket event `emergency_created` is received
2. `showEmergencyNotification()` is called → plays sound
3. AudioContext is checked and resumed if suspended
4. Continuous tone starts playing
5. User navigates to response page
6. Sound continues until user clicks button

### When Emergency is Received (App Closed - Push Notification)
1. Service worker receives push notification
2. Shows notification and plays sound in service worker
3. AudioContext is checked and resumed if suspended
4. Continuous tone starts playing
5. User clicks notification (user interaction)
6. Page opens, sound continues
7. Sound stops when user clicks "I CAN HELP" or "UNAVAILABLE"

## Browser Limitations

**Important:** Browsers require user interaction before audio can play. This means:

- ✅ **Sound WILL play** if:
  - User has already interacted with the page (clicked/tapped)
  - User clicks the notification (counts as interaction)
  - User is on the page and has clicked something before

- ⚠️ **Sound MAY NOT play** if:
  - App is completely closed and user hasn't clicked notification yet
  - User has never interacted with the page
  - Browser has strict autoplay policies

## Testing

To test the emergency sound:

1. **Test with app open:**
   - Have two accounts logged in
   - Trigger emergency from one account
   - Other account should hear continuous tone
   - Click "I CAN HELP" → sound should stop

2. **Test with push notification:**
   - Close the app completely
   - Trigger emergency from another account
   - Push notification should appear
   - Click notification → sound should play
   - Click "I CAN HELP" → sound should stop

## Troubleshooting

If sound still doesn't play:

1. **Check browser console** for AudioContext errors
2. **Verify notification permission** is granted
3. **Check if user has interacted** with the page
4. **Try clicking notification** - this should trigger sound
5. **Check service worker** is registered and active

## Next Steps

- Monitor console logs for AudioContext state
- Test on mobile devices (iOS Safari, Android Chrome)
- Consider adding visual indicator when sound is playing
- May need to add "unlock audio" button for strict browsers

