/**
 * Notification Service for Emergency Alerts
 * Handles browser notifications, sounds, screen wake, and location access
 */

// Global sound state for continuous emergency tone
let emergencySoundContext: AudioContext | null = null;
let emergencySoundOscillator: OscillatorNode | null = null;
let emergencySoundGain: GainNode | null = null;
let emergencySoundAudio: HTMLAudioElement | null = null;

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// Register service worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('This browser does not support service workers');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    console.log('✅ Service Worker registered:', registration.scope);

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New service worker available, reload to update');
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

// Show emergency notification with loud sound
export const showEmergencyNotification = async (
  title: string,
  body: string,
  emergencyId: string,
  senderName?: string
): Promise<void> => {
  const permission = await requestNotificationPermission();
  
  if (!permission) {
    console.warn('Notification permission not granted');
    // Still play sound even without notification permission
    playEmergencySound();
    return;
  }

  // Notification options with extended type for actions support
  const options: NotificationOptions & { actions?: Array<{ action: string; title: string; icon?: string }> } = {
    body: body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `emergency-${emergencyId}`, // Replace previous notifications
    requireInteraction: true, // Keep visible until user interacts - CRITICAL for emergency
    silent: false, // CRITICAL: Enable sound - nothing is more important
    data: {
      emergencyId: emergencyId,
      url: `/respond/${emergencyId}`, // Direct to response page
      type: 'emergency',
      senderName: senderName
    },
    actions: [
      {
        action: 'respond',
        title: 'I CAN HELP',
        icon: '/icon-respond.png'
      },
      {
        action: 'dismiss',
        title: 'UNAVAILABLE'
      }
    ]
  };

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    
    // Also play loud sound
    playEmergencySound();
    
    // Wake screen
    await wakeScreen();
  } catch (error) {
    console.error('Error showing notification:', error);
    // Fallback: show regular notification
    new Notification(title, options);
    playEmergencySound();
  }
};

// Play continuous loud emergency sound - plays until stopped
export const playEmergencySound = (): void => {
  try {
    console.log('🔊 playEmergencySound() called');
    
    // Stop any existing oscillator/audio first (but keep context if it exists)
    if (emergencySoundOscillator) {
      try {
        emergencySoundOscillator.stop();
        emergencySoundOscillator = null;
      } catch (e) {
        // Already stopped
      }
    }
    if (emergencySoundAudio) {
      emergencySoundAudio.pause();
      emergencySoundAudio.currentTime = 0;
      emergencySoundAudio.loop = false;
      emergencySoundAudio = null;
    }
    emergencySoundGain = null;
    
    // Reuse existing AudioContext or create new one
    if (!emergencySoundContext || emergencySoundContext.state === 'closed') {
      emergencySoundContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('✅ AudioContext created, state:', emergencySoundContext.state);
    } else {
      console.log('✅ Reusing existing AudioContext, state:', emergencySoundContext.state);
    }
    
    // Function to start the tone (called after context is resumed if needed)
    const startTone = () => {
      if (!emergencySoundContext) {
        console.error('❌ AudioContext is null, cannot start tone');
        return;
      }
      
      try {
        // Generate continuous, loud, attention-grabbing tone
        emergencySoundOscillator = emergencySoundContext.createOscillator();
        emergencySoundGain = emergencySoundContext.createGain();
        
        emergencySoundOscillator.connect(emergencySoundGain);
        emergencySoundGain.connect(emergencySoundContext.destination);
        
        // Configure for loud, urgent, continuous sound
        emergencySoundOscillator.frequency.value = 1000; // Higher frequency for more urgency
        emergencySoundOscillator.type = 'sine';
        
        // Set volume to maximum allowed (browsers limit to ~0.5 for safety, but we try higher)
        emergencySoundGain.gain.setValueAtTime(0.8, emergencySoundContext.currentTime);
        
        // Start the continuous tone - it will play until stop() is called
        emergencySoundOscillator.start();
        console.log('🔊 Emergency tone started successfully');
      } catch (err) {
        console.error('❌ Error starting oscillator:', err);
      }
    };
    
    // CRITICAL: Resume AudioContext if suspended (browsers require user interaction)
    if (emergencySoundContext.state === 'suspended') {
      console.log('⏸️ AudioContext is suspended, attempting to resume...');
      emergencySoundContext.resume().then(() => {
        console.log('✅ AudioContext resumed successfully');
        startTone();
      }).catch((err) => {
        console.error('❌ Failed to resume AudioContext:', err);
        // Try to start anyway - sometimes it works even if resume fails
        startTone();
      });
    } else {
      console.log('✅ AudioContext is ready, starting tone immediately');
      startTone();
    }
    
    // Also try to play a sound file in a continuous loop if available
    try {
      emergencySoundAudio = new Audio('/emergency-alert.mp3');
      emergencySoundAudio.volume = 1.0; // Maximum volume
      emergencySoundAudio.loop = true; // Loop continuously
      emergencySoundAudio.play().then(() => {
        console.log('✅ Sound file playing');
      }).catch((err) => {
        console.log('⚠️ Sound file not available, using generated continuous tone:', err);
      });
    } catch (err) {
      console.log('⚠️ Could not create Audio element:', err);
      // Sound file not available, generated tone is playing
    }
  } catch (error) {
    console.error('❌ Error playing emergency sound:', error);
  }
};

// Stop the continuous emergency sound - called when user responds
export const stopEmergencySound = (): void => {
  try {
    console.log('🛑 stopEmergencySound() called');
    
    // Stop the oscillator FIRST (most important)
    if (emergencySoundOscillator) {
      try {
        emergencySoundOscillator.stop();
        console.log('✅ Oscillator stopped');
      } catch (e) {
        // Already stopped or context closed
        console.log('⚠️ Oscillator already stopped or context closed');
      }
      emergencySoundOscillator = null;
    }
    
    // Stop any audio file that might be playing
    if (emergencySoundAudio) {
      emergencySoundAudio.pause();
      emergencySoundAudio.currentTime = 0;
      emergencySoundAudio.loop = false;
      emergencySoundAudio = null;
      console.log('✅ Audio file stopped');
    }
    
    // Also stop any other audio elements that might be playing
    const audioElements = document.querySelectorAll('audio[src="/emergency-alert.mp3"]');
    audioElements.forEach((audio: any) => {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
    });
    if (audioElements.length > 0) {
      console.log(`✅ Stopped ${audioElements.length} audio element(s)`);
    }
    
    // DON'T close the AudioContext immediately - let it close naturally
    // Closing it might prevent new sounds from starting
    // Just stop the oscillator and audio files
    emergencySoundGain = null;
    
    // Only close AudioContext if we're sure we're done (not restarting)
    // We'll let it close naturally or close it after a delay
    if (emergencySoundContext) {
      // Don't close immediately - might be restarting
      // Set a timeout to close it if not restarted
      setTimeout(() => {
        if (emergencySoundContext && emergencySoundContext.state !== 'closed') {
          try {
            emergencySoundContext.close().then(() => {
              console.log('✅ AudioContext closed (delayed)');
            }).catch(() => {
              // Ignore errors when closing
            });
          } catch (e) {
            // Context might already be closed
          }
        }
        emergencySoundContext = null;
      }, 500);
    }
    
    // Send message to service worker to stop sound there too
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_EMERGENCY_SOUND'
      });
      console.log('✅ Message sent to service worker to stop sound');
    } else {
      console.log('⚠️ Service worker not available');
    }
    
    console.log('✅ Emergency sound stopped completely');
  } catch (error) {
    console.error('❌ Error stopping emergency sound:', error);
  }
};

// Wake screen and keep it on
let wakeLock: WakeLockSentinel | null = null;

export const wakeScreen = async (): Promise<void> => {
  if (!('wakeLock' in navigator)) {
    console.warn('Screen Wake Lock API not supported');
    return;
  }

  try {
    // Release existing wake lock if any
    if (wakeLock) {
      await wakeLock.release();
    }

    // Request new wake lock
    wakeLock = await (navigator as any).wakeLock.request('screen');
    console.log('✅ Screen wake lock acquired');

    // Handle wake lock release
    if (wakeLock) {
      wakeLock.addEventListener('release', () => {
        console.log('Screen wake lock released');
      });
    }
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      console.warn('Screen wake lock not allowed (user may have denied)');
    } else {
      console.error('Error acquiring wake lock:', error);
    }
  }
};

export const releaseWakeLock = async (): Promise<void> => {
  if (wakeLock) {
    await wakeLock.release();
    wakeLock = null;
    console.log('Screen wake lock released');
  }
};

// Request location access immediately (even if app is in background)
export const requestEmergencyLocation = async (): Promise<GeolocationPosition | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ Emergency location obtained:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        resolve(position);
      },
      (error) => {
        console.error('❌ Error getting emergency location:', error);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Force fresh location
      }
    );
  });
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async (): Promise<PushSubscription | null> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('✅ Already subscribed to push notifications');
      // Still send to backend in case it wasn't saved
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const api = (await import('./api')).default;
          await api.post('/notifications/subscribe', subscription);
        } catch (err) {
          console.warn('Failed to sync subscription with backend:', err);
        }
      }
      return subscription;
    }

    // Get VAPID public key from backend
    const api = (await import('./api')).default;
    let vapidPublicKey: string;
    
    try {
      const response = await api.get('/notifications/vapid-public-key');
      vapidPublicKey = response.data.publicKey;
    } catch (error) {
      console.error('Failed to get VAPID public key:', error);
      return null;
    }

    if (!vapidPublicKey) {
      console.error('VAPID public key not available');
      return null;
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource
    });

    // Send subscription to backend
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        await api.post('/notifications/subscribe', subscription);
        console.log('✅ Push subscription saved to backend');
      } catch (error) {
        console.error('Failed to save subscription to backend:', error);
        // Still return subscription even if backend save fails
      }
    }

    return subscription;
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      console.warn('Push subscription not allowed - user may have denied permission');
    } else {
      console.error('Error subscribing to push:', error);
    }
    return null;
  }
};

// Helper to convert VAPID key from base64 URL to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Handle notification clicks
export const setupNotificationClickHandler = (navigate: (path: string) => void): void => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        const emergencyId = event.data.emergencyId;
        if (emergencyId) {
          navigate(`/emergency/${emergencyId}`);
        }
      }
    });
  }

  // Also handle direct notification clicks
  if ('Notification' in window && Notification.permission === 'granted') {
    // This will be handled by service worker, but we can add fallback here
  }
};

