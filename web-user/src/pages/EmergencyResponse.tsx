import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api, { emergencyAPI } from '../services/api'
import { stopEmergencySound, playEmergencySound } from '../services/notifications'
import './EmergencyResponse.css'

function EmergencyResponse() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [senderName, setSenderName] = useState('Someone')
  const [locationStatus, setLocationStatus] = useState<'pending' | 'sharing' | 'shared' | 'failed' | null>(null)

  useEffect(() => {
    // When user reaches response page (via notification click), ensure sound is playing
    // User interaction (clicking notification) should allow audio to play
    // Don't stop sound here - let it continue until user clicks a button
    
    // Listen for service worker messages (notification click)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'EMERGENCY_NOTIFICATION_CLICKED') {
        // User clicked notification - this is user interaction, sound should play
        console.log('🔔 Notification clicked, ensuring sound plays');
        playEmergencySound();
      }
    };
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }
    
    // Load emergency details to get sender name
    loadEmergency();
    
    return () => {
      // Cleanup on unmount
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [id])

  const loadEmergency = async () => {
    try {
      const response = await api.get(`/emergencies/${id}`)
      // Get sender display name from emergency participants or emergency data
      const emergency = response.data.emergency
      const participants = response.data.participants || []
      
      // Find the sender (user_id matches emergency.user_id)
      const sender = participants.find((p: any) => p.user_id === emergency.user_id)
      if (sender) {
        setSenderName(sender.user_display_name || sender.user_email || 'Someone')
      } else {
        // Fallback: try to get from emergency data if available
        setSenderName('Emergency Contact')
      }
    } catch (err) {
      console.error('Failed to load emergency:', err)
    }
  }

  const shareLocationWithRetry = async (retries = 2): Promise<boolean> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        setLocationStatus('sharing')

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Location timeout')), 10000)

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeout)
              resolve(pos)
            },
            (error) => {
              clearTimeout(timeout)
              reject(error)
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          )
        })

        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const accuracy = position.coords.accuracy
        
        // Check for fallback/invalid locations
        const isSanFranciscoFallback = 
          (Math.abs(lat - 37.785834) < 0.0001 && Math.abs(lng - (-122.406417)) < 0.0001) ||
          (Math.abs(lat - 37.7858) < 0.001 && Math.abs(lng - (-122.4064)) < 0.001)
        
        const isNullIslandFallback = Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001
        
        if (isSanFranciscoFallback || isNullIslandFallback) {
          console.error('❌ LOCATION REJECTED: Browser returned fallback coordinates', {
            latitude: lat,
            longitude: lng,
            accuracy: accuracy,
            reason: isSanFranciscoFallback ? 'San Francisco fallback' : 'Null Island'
          })
          throw new Error('Invalid location: Browser returned fallback coordinates. Please use a mobile device with GPS.')
        }

        // Share location with backend
        await api.post(`/emergencies/${id}/location`, {
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
        })

        console.log('✅ Location shared successfully:', {
          lat: lat,
          lng: lng,
          accuracy: accuracy,
          attempt: attempt + 1
        })

        setLocationStatus('shared')
        return true

      } catch (error: any) {
        console.warn(`⚠️ Location sharing attempt ${attempt + 1} failed:`, error.message)

        if (attempt === retries) {
          setLocationStatus('failed')
          return false
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }
    return false
  }

  const acceptEmergency = async () => {
    if (!id) {
      alert('Invalid emergency ID')
      return
    }

    // STOP THE SOUND immediately when user responds - CRITICAL
    console.log('🛑 Stopping emergency sound (I CAN HELP clicked)')
    stopEmergencySound()

    // Also send message to service worker immediately
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_EMERGENCY_SOUND'
      })
    }

    setLoading(true)
    setLocationStatus('pending')

    try {
      // Step 1: Accept the emergency
      console.log('📝 Accepting emergency...')
      await emergencyAPI.acceptEmergency(id)
      console.log('✅ Emergency accepted successfully')

      // Step 2: Share location with enhanced retry logic
      let locationShared = false
      if (navigator.geolocation) {
        console.log('📍 Attempting to share location...')
        locationShared = await shareLocationWithRetry()

        if (!locationShared) {
          console.warn('⚠️ Location sharing failed after retries')
          setLocationStatus('failed')
          // Show warning but don't block navigation
          setTimeout(() => {
            alert('Emergency accepted! However, location sharing failed. You can manually share your location on the emergency page.')
          }, 500)
        }
      } else {
        console.warn('⚠️ Geolocation not supported in this browser')
        setLocationStatus('failed')
      }

      // Step 3: Navigate to emergency page
      console.log('🧭 Navigating to emergency page...')
      navigate(`/emergency/${id}`)

    } catch (err: any) {
      console.error('❌ Failed to accept emergency:', err)
      setLocationStatus(null)

      // Error messages are already user-friendly from emergencyAPI
      alert(err.message || 'Failed to accept emergency. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const rejectEmergency = async () => {
    if (!id) {
      alert('Invalid emergency ID')
      return
    }

    // STOP THE SOUND immediately when user responds - CRITICAL
    console.log('🛑 Stopping emergency sound (UNAVAILABLE clicked)');
    stopEmergencySound();

    // Also send message to service worker immediately
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_EMERGENCY_SOUND'
      });
    }

    if (!confirm('Mark yourself as unavailable for this emergency?')) {
      // If user cancels, sound was already stopped
      // Don't restart - let them decide
      return;
    }

    setLoading(true)
    try {
      await emergencyAPI.rejectEmergency(id)
      alert('You have been marked as unavailable.')
      navigate('/')
    } catch (err: any) {
      // Error messages are already user-friendly from emergencyAPI
      alert(err.message || 'Failed to reject emergency.')
    } finally {
      setLoading(false)
    }
  }

  const getLocationStatusText = () => {
    switch (locationStatus) {
      case 'sharing':
        return 'Sharing your location...'
      case 'shared':
        return '✅ Location shared successfully'
      case 'failed':
        return '⚠️ Location sharing failed - you can share manually'
      default:
        return null
    }
  }

  return (
    <div className="emergency-response">
      <div className="response-container">
        <div className="emergency-icon">🚨</div>
        <h1>Emergency Alert</h1>
        <p className="sender-name">{senderName} needs help!</p>

        {loading && (
          <div className="status-indicator">
            <div className="loading-spinner"></div>
            <p>Accepting emergency...</p>
            {locationStatus === 'sharing' && (
              <p className="location-status">{getLocationStatusText()}</p>
            )}
          </div>
        )}

        {!loading && locationStatus && (
          <div className={`status-indicator ${locationStatus}`}>
            <p>{getLocationStatusText()}</p>
          </div>
        )}

        <div className="response-buttons">
          <button
            className="accept-button"
            onClick={acceptEmergency}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'I CAN HELP'}
          </button>
          <button
            className="reject-button"
            onClick={rejectEmergency}
            disabled={loading}
          >
            UNAVAILABLE
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmergencyResponse

