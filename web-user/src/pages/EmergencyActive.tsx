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
        <div className="loading">Loading emergency...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="emergency-active">
        <div className="error">{error}</div>
      </div>
    )
  }

  return (
    <div className="emergency-active">
      {/* Header */}
      <div className="emergency-header" style={{ background: '#dc3545', color: 'white', padding: '15px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>🚨 EMERGENCY ACTIVE</h1>
        <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem' }}>
          {isSender ? 'Help is on the way!' : `${emergency?.sender_display_name || emergency?.sender_email || 'Someone'} needs help!`}
        </p>
      </div>

      {/* Location Section */}
      <div style={{ padding: '15px', background: '#f8f9fa' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>📍 Locations</h3>
        
        {/* Share Location Button */}
        <button
          onClick={shareLocation}
          disabled={sharingLocation}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '15px',
            background: myLocation ? '#28a745' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
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
            style={{
              width: '100%',
              padding: '15px',
              marginBottom: '10px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🧭 NAVIGATE TO {(emergency?.sender_display_name || 'PERSON IN NEED').toUpperCase()}
          </button>
        )}

        {/* Location List */}
        <div style={{ marginTop: '10px' }}>
          {locations.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center' }}>No locations shared yet</p>
          ) : (
            locations.map((loc, index) => {
              const isCurrentUser = String(loc.user_id) === String(currentUserId)
              const isEmergencySender = String(loc.user_id) === String(emergency?.user_id)
              
              return (
                <div
                  key={index}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    background: isEmergencySender ? '#ffe6e6' : 'white',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong>{loc.user_display_name || loc.user_email || 'Unknown'}</strong>
                    {isEmergencySender && <span style={{ color: '#dc3545', marginLeft: '5px' }}>(Needs Help)</span>}
                    {isCurrentUser && <span style={{ color: '#28a745', marginLeft: '5px' }}>(You)</span>}
                  </div>
                  {!isCurrentUser && (
                    <button
                      onClick={() => navigateToLocation(
                        parseFloat(String(loc.latitude)),
                        parseFloat(String(loc.longitude)),
                        loc.user_display_name || 'Location'
                      )}
                      style={{
                        padding: '8px 15px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
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
      <div style={{ padding: '15px', flex: 1 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>💬 Group Chat</h3>
        <EmergencyChat emergencyId={id!} />
      </div>

      {/* Action Buttons (Sender Only) */}
      {isSender && (
        <div style={{ padding: '15px', background: '#f8f9fa', display: 'flex', gap: '10px' }}>
          <button
            onClick={endEmergency}
            style={{
              flex: 1,
              padding: '15px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ✓ I'M SAFE - End Emergency
          </button>
          <button
            onClick={cancelEmergency}
            style={{
              flex: 1,
              padding: '15px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Back Button (Responder) */}
      {!isSender && (
        <div style={{ padding: '15px', background: '#f8f9fa' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              padding: '12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Back to Home
          </button>
        </div>
      )}
    </div>
  )
}

export default EmergencyActive
