// Service Worker for Emergency Push Notifications
// Handles background notifications, sounds, and location access

const EMERGENCY_SOUND_URL = '/emergency-alert.mp3';
// Store sound references globally in service worker for continuous playback
let emergencySoundContext = null;
let emergencySoundOscillator = null;
let emergencySoundGain = null;
let emergencySoundSource = null;

// Install service worker
self.addEventListener('install', (event) => {
  console.log('🔔 Service Worker installing...');
  self.skipWaiting(); // Activate immediately
});

// Activate service worker
self.addEventListener('activate', (event) => {
  console.log('🔔 Service Worker activating...');
  event.waitUntil(self.clients.claim()); // Take control of all pages immediately
});

// Handle push notifications (from Web Push API)
self.addEventListener('push', (event) => {
  console.log('🔔 Push notification received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Error parsing push data:', e);
      data = { title: 'Emergency Alert', body: 'Someone needs help!' };
    }
  } else {
    data = { title: 'Emergency Alert', body: 'Someone needs help!' };
  }
  
  const title = data.title || 'Emergency Alert';
  const body = data.body || 'Someone needs help!';
  const emergencyId = data.emergencyId || data.data?.emergencyId;
  const senderName = data.senderName || data.data?.senderName || 'Someone';
  
  const options = {
    body: body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `emergency-${emergencyId || 'alert'}`, // Replace previous notifications for same emergency
    requireInteraction: true, // Keep notification visible until user interacts
    silent: false, // Enable sound
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Strong vibration pattern
    data: {
      emergencyId: emergencyId,
      url: `/emergency/${emergencyId}`,
      type: 'emergency',
      senderName: senderName
    },
    actions: [
      {
        action: 'respond',
        title: 'Respond to Emergency'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    Promise.all([
      // Show notification
      self.registration.showNotification(title, options),
      // Play emergency sound
      playEmergencySound(),
      // Request location access
      requestLocationAccess(emergencyId)
    ])
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  
  const data = event.notification.data;
  const action = event.action;
  
  // STOP SOUND when notification is clicked (any click - main body or action button)
  // User has acknowledged the alert, sound should stop
  stopEmergencySound();
  
  // Also send message to all clients to stop sound there too
  clients.matchAll({ includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => {
      client.postMessage({
        type: 'STOP_EMERGENCY_SOUND'
      });
    });
  });
  
  // If user clicks dismiss, just close
  if (action === 'dismiss') {
    event.notification.close();
    return;
  }
  
  event.notification.close();

  // Open or focus the emergency response page
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if emergency page is already open
      const emergencyUrl = data.url || `/respond/${data.emergencyId}`;
      
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ((client.url.includes('/emergency/') || client.url.includes('/respond/')) && 'focus' in client) {
          // Focus existing window - this counts as user interaction, sound should now work
          return client.focus().then(() => {
            // Send message to client to ensure sound plays (user interaction happened)
            client.postMessage({
              type: 'EMERGENCY_NOTIFICATION_CLICKED',
              emergencyId: data.emergencyId
            });
          });
        }
      }
      
      // Open new window to response page - this counts as user interaction
      if (clients.openWindow) {
        return clients.openWindow(emergencyUrl).then((client) => {
          if (client) {
            // Send message to new window to ensure sound plays
            client.postMessage({
              type: 'EMERGENCY_NOTIFICATION_CLICKED',
              emergencyId: data.emergencyId
            });
          }
        });
      }
    })
  );
});

// Play continuous loud emergency sound - plays until stopped
async function playEmergencySound() {
  try {
    // Stop any existing sound first
    stopEmergencySound();
    
    // Create audio context for continuous loud sound
    emergencySoundContext = new (self.AudioContext || self.webkitAudioContext)();
    
    // Function to start the tone (called after context is resumed if needed)
    const startTone = () => {
      if (!emergencySoundContext) return;
      
      // Generate a continuous, loud, attention-grabbing tone
      emergencySoundOscillator = emergencySoundContext.createOscillator();
      emergencySoundGain = emergencySoundContext.createGain();
      
      emergencySoundOscillator.connect(emergencySoundGain);
      emergencySoundGain.connect(emergencySoundContext.destination);
      
      // Configure for loud, urgent, continuous sound
      emergencySoundOscillator.frequency.value = 1000; // Higher frequency for more urgency
      emergencySoundOscillator.type = 'sine';
      
      // Set volume to maximum (browsers limit to ~0.5, but we try higher)
      emergencySoundGain.gain.setValueAtTime(0.8, emergencySoundContext.currentTime);
      
      // Start continuous tone - it will play until stop() is called
      emergencySoundOscillator.start();
      console.log('🔊 Emergency tone started in service worker');
    };
    
    // CRITICAL: Resume AudioContext if suspended
    if (emergencySoundContext.state === 'suspended') {
      emergencySoundContext.resume().then(() => {
        console.log('✅ AudioContext resumed in service worker');
        startTone();
      }).catch((err) => {
        console.error('Failed to resume AudioContext in service worker:', err);
        startTone();
      });
    } else {
      startTone();
    }
    
    // Also try to play sound file in continuous loop if available
    try {
      const response = await fetch(EMERGENCY_SOUND_URL);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await emergencySoundContext.decodeAudioData(arrayBuffer);
        emergencySoundSource = emergencySoundContext.createBufferSource();
        emergencySoundSource.buffer = audioBuffer;
        emergencySoundSource.loop = true; // Loop continuously
        const gain = emergencySoundContext.createGain();
        gain.gain.value = 1.0; // Maximum volume
        emergencySoundSource.connect(gain);
        gain.connect(emergencySoundContext.destination);
        emergencySoundSource.start();
      }
    } catch (err) {
      console.log('Sound file not available, using generated continuous tone');
    }
  } catch (error) {
    console.error('Error playing emergency sound:', error);
  }
}

// Stop emergency sound - called when user responds
function stopEmergencySound() {
  try {
    console.log('🛑 Service Worker: stopEmergencySound() called');
    
    // Stop the oscillator FIRST (most important)
    if (emergencySoundOscillator) {
      try {
        emergencySoundOscillator.stop();
        console.log('✅ Service Worker: Oscillator stopped');
      } catch (e) {
        // Already stopped or context closed
        console.log('⚠️ Service Worker: Oscillator already stopped');
      }
      emergencySoundOscillator = null;
    }
    
    // Stop the audio source (sound file)
    if (emergencySoundSource) {
      try {
        emergencySoundSource.stop();
        console.log('✅ Service Worker: Audio source stopped');
      } catch (e) {
        // Already stopped
        console.log('⚠️ Service Worker: Audio source already stopped');
      }
      emergencySoundSource = null;
    }
    
    // Close the audio context (this will stop all audio)
    if (emergencySoundContext) {
      try {
        emergencySoundContext.close().then(() => {
          console.log('✅ Service Worker: AudioContext closed');
        }).catch(() => {
          // Ignore errors when closing
        });
      } catch (e) {
        // Context might already be closed
      }
      emergencySoundContext = null;
    }
    
    emergencySoundGain = null;
    
    console.log('✅ Service Worker: Emergency sound stopped completely');
  } catch (error) {
    console.error('❌ Service Worker: Error stopping emergency sound:', error);
  }
}

// Request location access when emergency notification is received
async function requestLocationAccess(emergencyId) {
  try {
    // Send message to all clients to request location
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    
    clients.forEach((client) => {
      client.postMessage({
        type: 'EMERGENCY_RECEIVED',
        emergencyId: emergencyId,
        action: 'REQUEST_LOCATION'
      });
    });
  } catch (error) {
    console.error('Error requesting location access:', error);
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('🔔 Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'STOP_EMERGENCY_SOUND') {
    console.log('🛑 Service Worker: Received STOP_EMERGENCY_SOUND message');
    stopEmergencySound();
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

