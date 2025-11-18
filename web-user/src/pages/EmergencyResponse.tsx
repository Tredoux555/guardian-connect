import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { stopEmergencySound, playEmergencySound } from '../services/notifications'
import './EmergencyResponse.css'

function EmergencyResponse() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [senderName, setSenderName] = useState('Someone')

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

  const acceptEmergency = async () => {
    // STOP THE SOUND immediately when user responds - CRITICAL
    console.log('🛑 Stopping emergency sound (I CAN HELP clicked)');
    stopEmergencySound();
    
    // Also send message to service worker immediately
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STOP_EMERGENCY_SOUND'
      });
    }
    
    setLoading(true)
    try {
      await api.post(`/emergencies/${id}/accept`, {})
      
      // Request location permission and share location BEFORE navigating
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                await api.post(`/emergencies/${id}/location`, {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                })
                console.log('✅ Responder location shared:', {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                })
                // Small delay to ensure location is saved
                setTimeout(() => resolve(), 500)
              } catch (err) {
                console.error('Failed to share location:', err)
                resolve() // Continue even if location sharing fails
              }
            },
            (error) => {
              console.warn('Location permission denied:', error)
              resolve() // Continue even if location permission denied
            }
          )
        })
      }
      
      // Navigate after location is shared (or if geolocation is not available)
      navigate(`/emergency/${id}`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept emergency')
    } finally {
      setLoading(false)
    }
  }

  const rejectEmergency = async () => {
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
      await api.post(`/emergencies/${id}/reject`, {})
      alert('You have been marked as unavailable.')
      navigate('/')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject emergency')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="emergency-response">
      <div className="response-container">
        <div className="emergency-icon">🚨</div>
        <h1>Emergency Alert</h1>
        <p className="sender-name">{senderName} needs help!</p>

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

