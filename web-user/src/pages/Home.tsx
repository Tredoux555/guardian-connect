import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { connectSocket } from '../services/socket'
import { 
  showEmergencyNotification, 
  requestEmergencyLocation,
  wakeScreen 
} from '../services/notifications'
import { FEATURES } from '../utils/featureFlags'
import './Home.css'

function Home() {
  const navigate = useNavigate()
  const [activeEmergency, setActiveEmergency] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [pendingEmergencies, setPendingEmergencies] = useState<any[]>([])

  const loadUser = async () => {
    try {
      // Get user info from token (simplified - in real app, decode JWT or call /api/user/me)
      const token = localStorage.getItem('access_token')
      if (token) {
        // For now, just set a placeholder
        setUser({ email: 'user@example.com' })
      }
    } catch (err) {
      console.error('Failed to load user:', err)
    }
  }

  const checkPendingEmergencies = async () => {
    try {
      const response = await api.get('/emergencies/pending')
      setPendingEmergencies(response.data)
    } catch (err: any) {
      // Silently handle 401 - user might not be logged in or token expired
      if (err.response?.status === 401) {
        // Token refresh should handle this, but if it fails, ignore
        return
      }
      console.error('Failed to check pending emergencies:', err)
    }
  }

  const checkActiveEmergency = async () => {
    try {
      const response = await api.get('/emergencies/active')
      if (response.data.emergency) {
        setActiveEmergency(response.data.emergency)
      }
    } catch (err: any) {
      // Silently handle 401 - user might not be logged in or token expired
      if (err.response?.status === 401) {
        // Token refresh should handle this, but if it fails, ignore
        return
      }
      console.error('Failed to check active emergency:', err)
    }
  }

  useEffect(() => {
    loadUser()
    checkActiveEmergency()
    checkPendingEmergencies()
    const interval = setInterval(() => {
      checkActiveEmergency()
      checkPendingEmergencies()
    }, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // Listen for emergency_created socket events
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const socket = connectSocket(token)
    
    const handleEmergencyCreated = async (data: any) => {
      console.log('🚨 Emergency created event received:', data)
      
      const emergencyId = data.emergencyId
      const senderName = data.userEmail || 'Someone'
      
      // Show loud notification with sound
      await showEmergencyNotification(
        '🚨 Emergency Alert',
        `${senderName} needs help!`,
        emergencyId,
        senderName
      )
      
      // Wake screen
      await wakeScreen()
      
      // Request location immediately (even if app is in background)
      const position = await requestEmergencyLocation()
      
      if (position && emergencyId) {
        // Share location with emergency
        try {
          await api.post(`/emergencies/${emergencyId}/location`, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
          console.log('✅ Location shared automatically on emergency receive')
        } catch (err) {
          console.error('Failed to share location on emergency receive:', err)
        }
      }
      
      // Navigate to emergency response page
      navigate(`/respond/${emergencyId}`)
    }

    // Wait for socket to connect, then listen
    if (socket.connected) {
      socket.on('emergency_created', handleEmergencyCreated)
    } else {
      socket.once('connect', () => {
        socket.on('emergency_created', handleEmergencyCreated)
      })
    }

    return () => {
      if (socket) {
        socket.off('emergency_created', handleEmergencyCreated)
      }
    }
  }, [navigate])

  // Listen for service worker messages (for background notifications)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = async (event: MessageEvent) => {
        if (event.data && event.data.type === 'EMERGENCY_RECEIVED') {
          const { emergencyId } = event.data
          
          // Request location when service worker receives emergency
          const position = await requestEmergencyLocation()
          
          if (position && emergencyId) {
            try {
              await api.post(`/emergencies/${emergencyId}/location`, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              })
              console.log('✅ Location shared from service worker')
            } catch (err) {
              console.error('Failed to share location from service worker:', err)
            }
          }
        }
      }

      navigator.serviceWorker.addEventListener('message', handleMessage)

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    navigate('/login')
  }

  const triggerEmergency = async () => {
    if (!confirm('Trigger emergency? This will alert all your emergency contacts.')) {
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/emergencies/create', {})
      const emergencyId = response.data.emergency.id
      
      setActiveEmergency(response.data.emergency)
      
      // Share location when emergency is created, then navigate
      // Improved with timeout, better error handling, and longer wait for mobile
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('⚠️ Location request timed out, navigating anyway')
            resolve()
          }, 8000) // 8 second timeout for mobile
          
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              clearTimeout(timeout)
              try {
                const locationResponse = await api.post(`/emergencies/${emergencyId}/location`, {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                })
                console.log('✅ Sender location shared successfully:', {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  response: locationResponse.status
                })
                // Longer delay on mobile to ensure location is saved to database
                setTimeout(() => resolve(), 1500)
              } catch (err: any) {
                console.error('❌ Failed to share initial location:', err)
                // Still navigate even if location sharing fails
                // EmergencyActive will try to share location again
                resolve()
              }
            },
            (err) => {
              clearTimeout(timeout)
              console.error('❌ Location error:', err)
              // Show user-friendly message for permission denial
              if (err.code === 1) {
                console.warn('⚠️ Location permission denied. Emergency created but location not shared.')
                // Don't block navigation - EmergencyActive will try again
              }
              resolve() // Continue navigation even if location fails
            },
            {
              timeout: 7000, // 7 second timeout
              enableHighAccuracy: true, // Better accuracy on mobile
              maximumAge: 0 // Don't use cached location
            }
          )
        })
      } else {
        console.warn('⚠️ Geolocation not supported in this browser')
      }
      
      navigate(`/emergency/${emergencyId}`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to trigger emergency')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Guardian Connect</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/contacts')}>Contacts</button>
          {FEATURES.donations && (
            <button onClick={() => navigate('/donations')}>Donate</button>
          )}
          {FEATURES.subscriptions && (
            <button onClick={() => navigate('/subscriptions')}>Subscribe</button>
          )}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="home-main">
        {pendingEmergencies.length > 0 && (
          <div className="pending-emergencies">
            <h2>⚠️ Pending Emergency Alerts</h2>
            {pendingEmergencies.map((emergency: any) => (
              <div key={emergency.id} className="pending-emergency-card">
                <p><strong>{emergency.sender_email}</strong> needs help!</p>
                <button onClick={() => navigate(`/respond/${emergency.id}`)}>
                  Respond Now
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="emergency-section">
          <h2>Emergency Alert</h2>
          <p className="subtitle">Click the button to trigger an emergency</p>
          
          {activeEmergency ? (
            <div className="active-emergency">
              <p>Emergency Active!</p>
              <button onClick={() => navigate(`/emergency/${activeEmergency.id}`)}>
                View Emergency
              </button>
            </div>
          ) : (
            <button
              className="emergency-button"
              onClick={triggerEmergency}
              disabled={loading}
            >
              {loading ? 'Triggering...' : '🚨 EMERGENCY'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default Home

