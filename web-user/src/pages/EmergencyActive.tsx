import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { getCurrentUserId } from '../utils/jwt'
import { 
  connectSocket, 
  joinEmergency, 
  leaveEmergency,
  onEmergencyEnded,
  onEmergencyCancelled,
  onLocationUpdate,
  removeListener
} from '../services/socket'
import { EmergencyChat } from '../components/EmergencyChat'
import './EmergencyActive.css'

interface Location {
  user_id: string
  latitude: number
  longitude: number
  timestamp: string
  user_email?: string
  user_display_name?: string
}

function EmergencyActive() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [emergency, setEmergency] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sharingLocation, setShareingLocation] = useState(false)
  const emergencyEndedRef = useRef(false)
  const locationSharedRef = useRef(false)
  const currentUserId = getCurrentUserId()

  // Socket connection for real-time updates
  useEffect(() => {
    if (!id) return
    emergencyEndedRef.current = false
    locationSharedRef.current = false

    const token = localStorage.getItem('access_token')
    if (token) {
      const socket = connectSocket(token)
      joinEmergency(id)

      const handleEmergencyEnded = (data: any) => {
        if (data?.emergencyId === id && !emergencyEndedRef.current) {
          emergencyEndedRef.current = true
          alert('Emergency has ended')
          navigate('/')
        }
      }

      const handleEmergencyCancelled = (data: any) => {
        if (data?.emergencyId === id && !emergencyEndedRef.current) {
          emergencyEndedRef.current = true
          alert('Emergency has been cancelled')
          navigate('/')
        }
      }

      onEmergencyEnded(handleEmergencyEnded)
      onEmergencyCancelled(handleEmergencyCancelled)

      return () => {
        removeListener('emergency_ended', handleEmergencyEnded)
        removeListener('emergency_cancelled', handleEmergencyCancelled)
        leaveEmergency(id)
      }
    }
  }, [id, navigate])

  // Listen for real-time location updates
  useEffect(() => {
    if (!id || !emergency) return
    
    const handleLocationUpdate = (data: any) => {
      if (!data || !data.user_id || data.latitude === undefined || data.longitude === undefined) return
      
      const lat = parseFloat(data.latitude)
      const lng = parseFloat(data.longitude)
      
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return
      
      const newLocation: Location = {
        user_id: String(data.user_id),
        latitude: lat,
        longitude: lng,
        timestamp: data.timestamp || new Date().toISOString(),
        user_email: data.user_email,
        user_display_name: data.user_display_name
      }
      
      setLocations(prev => {
        const filtered = prev.filter(loc => String(loc.user_id) !== String(data.user_id))
        return [...filtered, newLocation]
      })
    }
    
    onLocationUpdate(handleLocationUpdate)
    return () => removeListener('location_update', handleLocationUpdate)
  }, [id, emergency])

  // Load emergency data
  useEffect(() => {
    loadEmergency()
    const interval = setInterval(loadEmergency, 10000)
    return () => clearInterval(interval)
  }, [id])

  const loadEmergency = async () => {
    try {
      setError(null)
      const response = await api.get(`/emergencies/${id}`)
      
      if (!response?.data?.emergency) {
        throw new Error('Emergency not found')
      }
      
      const emergencyData = response.data.emergency
      setEmergency(emergencyData)
      setParticipants(response.data.participants || [])
      
      if (emergencyData.status === 'cancelled' || emergencyData.status === 'ended') {
        alert(emergencyData.status === 'cancelled' ? 'Emergency cancelled.' : 'Emergency ended.')
        navigate('/')
        return
      }
      
      // Process locations
      const locationsData = response.data.locations || []
      const validLocations = locationsData.filter((loc: Location) => {
        const lat = parseFloat(String(loc.latitude))
        const lng = parseFloat(String(loc.longitude))
        return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      })
      
      setLocations(validLocations)
    } catch (err: any) {
      console.error('Failed to load emergency:', err)
      if (err.response?.status === 404) {
        setError('Emergency not found')
        setTimeout(() => navigate('/'), 2000)
      } else {
        setError(err.response?.data?.error || 'Failed to load emergency')
      }
    } finally {
      setLoading(false)
    }
  }

  // Share current location
  const shareLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported')
      return
    }
    
    setShareingLocation(true)
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.post(`/emergencies/${id}/location`, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
          loadEmergency()
        } catch (err) {
          console.error('Failed to share location:', err)
          alert('Failed to share location')
        } finally {
          setShareingLocation(false)
        }
      },
      (err) => {
        console.error('Location error:', err)
        alert('Could not get location. Please enable location services.')
        setShareingLocation(false)
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    )
  }

  // Open native maps app for navigation
  const navigateToLocation = (lat: number, lng: number, name: string) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    
    if (isIOS) {
      // Apple Maps
      window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`, '_blank')
    } else {
      // Google Maps
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank')
    }
  }

  // End emergency (sender only)
  const endEmergency = async () => {
    if (!confirm('Are you sure you want to end this emergency?')) return
    
    try {
      await api.post(`/emergencies/${id}/end`)
      navigate('/')
    } catch (err) {
      console.error('Failed to end emergency:', err)
      alert('Failed to end emergency')
    }
  }

  // Cancel emergency (sender only)
  const cancelEmergency = async () => {
    if (!confirm('Are you sure you want to cancel this emergency?')) return
    
    try {
      await api.post(`/emergencies/${id}/cancel`)
      navigate('/')
    } catch (err) {
      console.error('Failed to cancel emergency:', err)
      alert('Failed to cancel emergency')
    }
  }

  const isSender = emergency && String(emergency.user_id) === String(currentUserId)
  const senderLocation = locations.find(loc => String(loc.user_id) === String(emergency?.user_id))
  const myLocation = locations.find(loc => String(loc.user_id) === String(currentUserId))

  if (loading) {
    return (
      <div className="emergency-active">
        <div className="loading-container">Loading emergency...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="emergency-active">
        <div className="error-container">{error}</div>
      </div>
    )
  }

  return (
    <div className="emergency-active">
      {/* Header */}
      <div className="emergency-header">
        <h1>🚨 EMERGENCY ACTIVE</h1>
        <p>
          {isSender ? 'Help is on the way!' : `${emergency?.sender_display_name || emergency?.sender_email || 'Someone'} needs help!`}
        </p>
      </div>

      {/* Connection Status */}
      <div className="connection-status">
        <div className="status-dot"></div>
        <span className="status-text">Connected • {locations.length} people tracking</span>
      </div>

      {/* Location Section */}
      <div className="location-section">
        <h3 className="section-title">📍 Locations</h3>
        
        {/* Share Location Button */}
        <button
          onClick={shareLocation}
          disabled={sharingLocation}
          className={`btn-share-location ${myLocation ? 'shared' : ''}`}
        >
          {sharingLocation ? 'Sharing...' : myLocation ? '✓ Location Shared - Tap to Update' : 'Share My Location'}
        </button>

        {/* Sender Location - Navigate Button */}
        {!isSender && senderLocation && (
          <button
            onClick={() => navigateToLocation(
              parseFloat(String(senderLocation.latitude)),
              parseFloat(String(senderLocation.longitude)),
              emergency?.sender_display_name || 'Emergency'
            )}
            className="btn-navigate-main"
          >
            🧭 NAVIGATE TO {(emergency?.sender_display_name || 'PERSON IN NEED').toUpperCase()}
          </button>
        )}

        {/* Location List */}
        <div>
          {locations.length === 0 ? (
            <p className="no-locations">No locations shared yet</p>
          ) : (
            locations.map((loc, index) => {
              const isCurrentUser = String(loc.user_id) === String(currentUserId)
              const isEmergencySender = String(loc.user_id) === String(emergency?.user_id)
              
              return (
                <div
                  key={index}
                  className={`location-card ${isEmergencySender ? 'sender' : ''} ${isCurrentUser ? 'you' : ''}`}
                >
                  <div className="location-info">
                    <strong>{loc.user_display_name || loc.user_email || 'Unknown'}</strong>
                    {isEmergencySender && <span className="location-badge needs-help">Needs Help</span>}
                    {isCurrentUser && <span className="location-badge you-badge">You</span>}
                  </div>
                  {!isCurrentUser && (
                    <button
                      onClick={() => navigateToLocation(
                        parseFloat(String(loc.latitude)),
                        parseFloat(String(loc.longitude)),
                        loc.user_display_name || 'Location'
                      )}
                      className="btn-navigate-small"
                    >
                      Navigate
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Section */}
      <div className="chat-section">
        <h3 className="section-title">💬 Group Chat</h3>
        <EmergencyChat emergencyId={id!} />
      </div>

      {/* Action Buttons (Sender Only) */}
      {isSender && (
        <div className="action-buttons">
          <button onClick={endEmergency} className="btn-safe">
            ✓ I'M SAFE - End Emergency
          </button>
          <button onClick={cancelEmergency} className="btn-cancel">
            Cancel
          </button>
        </div>
      )}

      {/* Back Button (Responder) */}
      {!isSender && (
        <div className="action-buttons">
          <button onClick={() => navigate('/')} className="btn-back">
            Back to Home
          </button>
        </div>
      )}

      {/* Jeffy Branding */}
      <div className="powered-by">
        Powered by <span>Jeffy</span>
      </div>
    </div>
  )
}

export default EmergencyActive
