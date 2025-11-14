import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import api from '../services/api'
import { getCurrentUserId } from '../utils/jwt'
import { GoogleMapsLoader } from '../components/GoogleMapsLoader'
import { 
  connectSocket, 
  disconnectSocket, 
  joinEmergency, 
  leaveEmergency,
  onEmergencyEnded,
  onEmergencyCancelled,
  removeListener
} from '../services/socket'
import './EmergencyActive.css'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// Declare google types for TypeScript
declare global {
  interface Window {
    google?: {
      maps: typeof google.maps
    }
  }
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
}

const defaultCenter = {
  lat: 0,
  lng: 0,
}

interface Location {
  user_id: string
  latitude: number
  longitude: number
  timestamp: string
  user_email?: string
}

function EmergencyActive() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [emergency, setEmergency] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [mapCenter, setMapCenter] = useState(defaultCenter)
  const [senderLocation, setSenderLocation] = useState<Location | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef<google.maps.Map | null>(null)

  useEffect(() => {
    if (!id) return

    // Connect to socket only for emergency status updates (ended/cancelled)
    const token = localStorage.getItem('access_token')
    if (token) {
      const socket = connectSocket(token)
      joinEmergency(id)

      // Listen for emergency ended/cancelled (no location updates needed)
      const handleEmergencyEnded = (data: any) => {
        // Only show alert if this emergency matches current emergency
        if (data?.emergencyId === id) {
          alert('Emergency has ended')
          navigate('/')
        }
      }

      const handleEmergencyCancelled = (data: any) => {
        // Only show alert if this emergency matches current emergency
        if (data?.emergencyId === id) {
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

  useEffect(() => {
    loadEmergency()
    // Refresh emergency data every 5 seconds to catch new locations
    const interval = setInterval(loadEmergency, 5000)
    
    return () => {
      clearInterval(interval)
    }
  }, [id])

  const loadEmergency = async () => {
    try {
      const response = await api.get(`/emergencies/${id}`)
      const emergencyData = response.data.emergency
      
      console.log('📥 Emergency API Response:', {
        emergency: emergencyData?.id,
        locationsCount: response.data.locations?.length || 0,
        locations: response.data.locations,
        participantsCount: response.data.participants?.length || 0
      })
      
      // Validate emergency data has user_id
      if (!emergencyData || !emergencyData.user_id) {
        console.error('❌ Emergency data missing user_id:', emergencyData)
        alert('Invalid emergency data')
        navigate('/')
        return
      }
      
      setEmergency(emergencyData)
      setParticipants(response.data.participants || [])
      
      // Check if emergency was cancelled or ended - redirect if so
      if (emergencyData && (emergencyData.status === 'cancelled' || emergencyData.status === 'ended')) {
        alert(emergencyData.status === 'cancelled' 
          ? 'This emergency has been cancelled.' 
          : 'This emergency has ended.')
        navigate('/')
        return
      }
      
      // Show all locations from API (sender + accepted responders only)
      const locationsData = response.data.locations || []
      
      console.log('📍 Processing locations:', {
        count: locationsData.length,
        locations: locationsData.map((loc: Location) => ({
          userId: loc.user_id,
          email: loc.user_email,
          lat: loc.latitude,
          lng: loc.longitude
        }))
      })
      
      if (locationsData.length > 0) {
        // Find sender location for reference
        const senderLoc = locationsData.find(
          (loc: Location) => String(loc.user_id) === String(emergencyData.user_id)
        )
        if (senderLoc) {
          setSenderLocation(senderLoc)
          console.log('✅ Sender location found:', senderLoc)
        }
        
        // Set all locations - backend only returns locations for sender + accepted responders
        setLocations(locationsData)
        console.log('✅ Set locations state:', locationsData.length, 'locations')
        
        // Center map on midpoint of all locations
        if (locationsData.length > 1) {
          const avgLat = locationsData.reduce((sum: number, loc: Location) => 
            sum + parseFloat(loc.latitude.toString()), 0) / locationsData.length
          const avgLng = locationsData.reduce((sum: number, loc: Location) => 
            sum + parseFloat(loc.longitude.toString()), 0) / locationsData.length
          setMapCenter({ lat: avgLat, lng: avgLng })
          console.log('✅ Map centered on midpoint:', { lat: avgLat, lng: avgLng })
        } else {
          // Single location - center on it
          const loc = locationsData[0]
          setMapCenter({
            lat: parseFloat(loc.latitude.toString()),
            lng: parseFloat(loc.longitude.toString()),
          })
          console.log('✅ Map centered on single location:', loc)
        }
      } else {
        // No locations yet
        setLocations([])
        console.log('⚠️ No locations in API response')
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        alert('Emergency not found')
        navigate('/')
      } else {
        console.error('Failed to load emergency:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const onMapLoad = useCallback((map: google.maps.Map) => {
    if (!map) {
      return
    }
    
    // Ensure Google Maps API is available
    if (typeof window === 'undefined' || !(window as any).google?.maps) {
      // Retry after a short delay
      setTimeout(() => {
        if ((window as any).google?.maps && map) {
          mapRef.current = map
          setTimeout(() => {
            if (mapRef.current === map) {
              setMapLoaded(true)
            }
          }, 300)
        }
      }, 200)
      return
    }
    
    // Set map reference and mark as loaded after a delay to ensure initialization
    mapRef.current = map
    setTimeout(() => {
      if (mapRef.current === map) { // Ensure map hasn't changed
        setMapLoaded(true)
      }
    }, 300)
  }, [])
  

  const getMarkerIcon = (): google.maps.Symbol | undefined => {
    // More robust check - ensure google exists and SymbolPath is available
    try {
      if (typeof window === 'undefined') return undefined
      const google = (window as any).google
      if (!google) return undefined
      if (!google.maps) return undefined
      if (!google.maps.SymbolPath) return undefined
      
      // Always use red pin for emergency location
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#E53935', // Red for emergency location
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      }
    } catch (error) {
      // Silently fail - marker will use default icon
      return undefined
    }
  }

  const endEmergency = async () => {
    if (!confirm('End this emergency?')) return

    try {
      await api.post(`/emergencies/${id}/end`, {})
      navigate('/')
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert('Only the emergency creator can end the emergency.')
      } else {
        alert(err.response?.data?.error || 'Failed to end emergency')
      }
    }
  }

  // Debug summary on render - MUST be before early return to follow Rules of Hooks
  const acceptedParticipants = participants.filter((p: any) => p.status === 'accepted')

  if (loading) {
    return <div className="loading">Loading emergency...</div>
  }

  const pendingParticipants = participants.filter((p: any) => p.status === 'pending')
  const rejectedParticipants = participants.filter((p: any) => p.status === 'rejected')

  return (
    <div className="emergency-active">
      <header className="emergency-header">
        <h1>Active Emergency</h1>
        <div className="header-actions">
          {emergency?.user_id === getCurrentUserId() && (
            <button onClick={endEmergency} className="end-button">End Emergency</button>
          )}
          <button onClick={() => navigate('/')} className="back-button">Back to Home</button>
        </div>
      </header>

      {/* Google Maps */}
      {GOOGLE_MAPS_API_KEY && (
        <div className="map-container">
          <GoogleMapsLoader>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={locations.length > 0 ? 15 : 2}
              onLoad={onMapLoad}
              options={{
                streetViewControl: false,
                mapTypeControl: true,
                fullscreenControl: true,
              }}
            >
              {/* Show ALL locations as markers - both sender and receiver on both maps */}
              {mapLoaded && mapRef.current && typeof window !== 'undefined' && (window as any).google?.maps && locations.length > 0 && emergency && emergency.user_id && locations.map((location) => {
                const lat = parseFloat(location.latitude.toString())
                const lng = parseFloat(location.longitude.toString())
                
                if (isNaN(lat) || isNaN(lng)) {
                  console.warn('⚠️ Invalid coordinates:', location)
                  return null
                }
                
                const currentUserId = getCurrentUserId()
                const isSenderLocation = String(location.user_id) === String(emergency.user_id)
                const isCurrentUserLocation = String(location.user_id) === String(currentUserId)
                const isSender = String(currentUserId) === String(emergency.user_id)
                const markerIcon = getMarkerIcon()
                
                console.log('📍 Rendering marker:', {
                  userId: location.user_id,
                  email: location.user_email,
                  lat,
                  lng,
                  isSenderLocation,
                  isCurrentUserLocation,
                  currentUserId,
                  emergencyUserId: emergency.user_id
                })
                
                return (
                  <Marker
                    key={`${location.user_id}-${location.timestamp || Date.now()}`}
                    position={{ lat, lng }}
                    icon={markerIcon || undefined}
                    onClick={() => setSelectedLocation(location)}
                  >
                    {selectedLocation?.user_id === location.user_id && (
                      <InfoWindow onCloseClick={() => setSelectedLocation(null)}>
                        <div>
                          <strong>
                            {isSenderLocation 
                              ? '🚨 Emergency Location (Sender)' 
                              : isCurrentUserLocation
                              ? '📍 Your Location (Responder)'
                              : '📍 Responder Location'}
                          </strong>
                          <br />
                          <small>{location.user_email || 'Location'}</small>
                          {/* Navigation button for responders to navigate to sender */}
                          {!isSender && isSenderLocation && senderLocation && (
                            <>
                              <br />
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${senderLocation.latitude},${senderLocation.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ 
                                  display: 'block', 
                                  marginTop: '0.5rem', 
                                  padding: '0.75rem',
                                  backgroundColor: '#4285F4',
                                  color: 'white',
                                  textDecoration: 'none',
                                  borderRadius: '4px',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  textAlign: 'center'
                                }}
                              >
                                📍 Open in Google Maps for Directions
                              </a>
                            </>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                )
              }).filter(Boolean)}
            </GoogleMap>
          </GoogleMapsLoader>
          {locations.length === 0 && (
            <div className="map-placeholder">
              <p>📍 Waiting for emergency location...</p>
              <p className="map-hint">Emergency location will appear here</p>
            </div>
          )}
        </div>
      )}

      {!GOOGLE_MAPS_API_KEY && (
        <div className="map-warning">
          <p>⚠️ Google Maps API key not configured</p>
          <p className="map-hint">Add VITE_GOOGLE_MAPS_API_KEY to your .env file to enable maps</p>
        </div>
      )}

      <div className="participants-list">
        <h2>Emergency Contacts</h2>
        
        {acceptedParticipants.length > 0 && (
          <div className="participant-group">
            <h3>✅ Responding ({acceptedParticipants.length})</h3>
            {acceptedParticipants.map((p: any) => (
              <div key={p.id} className="participant accepted">
                {p.user_email || 'Responder'} - Responding
              </div>
            ))}
          </div>
        )}

        {pendingParticipants.length > 0 && (
          <div className="participant-group">
            <h3>⏳ Deciding... ({pendingParticipants.length})</h3>
            {pendingParticipants.map((p: any) => (
              <div key={p.id} className="participant pending">
                {p.user_email || 'Contact'} - Waiting for response
              </div>
            ))}
          </div>
        )}

        {rejectedParticipants.length > 0 && (
          <div className="participant-group">
            <h3>❌ Unavailable ({rejectedParticipants.length})</h3>
            {rejectedParticipants.map((p: any) => (
              <div key={p.id} className="participant rejected">
                {p.user_email || 'Contact'} - Unavailable
              </div>
            ))}
          </div>
        )}

        {participants.length === 0 && (
          <p className="no-contacts">No emergency contacts added yet.</p>
        )}
      </div>

      <div className="emergency-info">
        <p><strong>Emergency ID:</strong> {id}</p>
        <p><strong>Status:</strong> {emergency?.status}</p>
        <p><strong>Created:</strong> {new Date(emergency?.created_at).toLocaleString()}</p>
      </div>
    </div>
  )
}

export default EmergencyActive

