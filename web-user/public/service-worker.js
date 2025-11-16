// Service Worker for Emergency Push Notifications
// Handles background notifications, sounds, and location access

const EMERGENCY_SOUND_URL = '/emergency-alert.mp3';
let emergencySound = null;

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
  
  event.notification.close();
  
  const data = event.notification.data;
  const action = event.action;
  
  if (action === 'dismiss') {
    return;
  }

  // Open or focus the emergency page
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if emergency page is already open
      const emergencyUrl = data.url || `/emergency/${data.emergencyId}`;
      
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/emergency/') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(emergencyUrl);
      }
    })
  );
});

// Play loud emergency sound
async function playEmergencySound() {
  try {
    // Create audio context for loud sound
    const audioContext = new (self.AudioContext || self.webkitAudioContext)();
    
    // Generate a loud, attention-grabbing tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure for loud, urgent sound
    oscillator.frequency.value = 800; // High frequency for attention
    oscillator.type = 'sine';
    
    // Set volume to maximum (0.0 to 1.0, but browsers limit to ~0.5 for safety)
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    
    // Play pattern: beep-beep-beep (3 beeps)
    oscillator.start();
    
    // First beep
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.2);
    
    // Second beep
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.5);
    
    // Third beep
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime + 0.6);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.8);
    
    oscillator.stop(audioContext.currentTime + 0.9);
    
    // Also try to play a sound file if available
    try {
      const response = await fetch(EMERGENCY_SOUND_URL);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        const gain = audioContext.createGain();
        gain.gain.value = 0.7; // Loud but safe
        source.connect(gain);
        gain.connect(audioContext.destination);
        source.start();
      }
    } catch (err) {
      console.log('Sound file not available, using generated tone');
    }
  } catch (error) {
    console.error('Error playing emergency sound:', error);
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
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

