/**
 * Notification Service for Emergency Alerts
 * Handles browser notifications, sounds, screen wake, and location access
 */

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

  const options: NotificationOptions = {
    body: body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `emergency-${emergencyId}`, // Replace previous notifications
    requireInteraction: true, // Keep visible until user interacts
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
        title: 'Respond to Emergency',
        icon: '/icon-respond.png'
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

// Play loud emergency sound
export const playEmergencySound = (): void => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Generate loud, attention-grabbing tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure for loud, urgent sound
    oscillator.frequency.value = 800; // High frequency
    oscillator.type = 'sine';
    
    // Set volume (browsers limit to ~0.5 for safety)
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
    
    // Also try to play sound file if available
    try {
      const audio = new Audio('/emergency-alert.mp3');
      audio.volume = 0.7; // Loud but safe
      audio.play().catch((err) => {
        console.log('Sound file not available, using generated tone');
      });
    } catch (err) {
      // Sound file not available, generated tone is playing
    }
  } catch (error) {
    console.error('Error playing emergency sound:', error);
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
    wakeLock.addEventListener('release', () => {
      console.log('Screen wake lock released');
    });
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
      applicationServerKey: applicationServerKey
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

