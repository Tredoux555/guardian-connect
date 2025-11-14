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
    // Refresh emergency data every 10 seconds (reduced from 5s to prevent excessive re-renders)
    const interval = setInterval(loadEmergency, 10000)
    
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
      
      // Show ALL locations from API - both sender and accepted responders
      const locationsData = response.data.locations || []
      const currentUserId = getCurrentUserId()
      const isSender = String(currentUserId) === String(emergencyData.user_id)
      
      // Remove duplicate locations by user_id (keep most recent)
      const uniqueLocations = locationsData.filter((loc: Location, index: number, self: Location[]) => 
        index === self.findIndex((l: Location) => String(l.user_id) === String(loc.user_id))
      )
      
      console.log('📍 Processing locations:', {
        count: uniqueLocations.length,
        originalCount: locationsData.length,
        isSender,
        currentUserId,
        emergencyUserId: emergencyData.user_id,
        locations: uniqueLocations.map((loc: Location) => ({
          userId: loc.user_id,
          email: loc.user_email,
          lat: loc.latitude,
          lng: loc.longitude,
          isSenderLocation: String(loc.user_id) === String(emergencyData.user_id),
          isCurrentUserLocation: String(loc.user_id) === String(currentUserId)
        }))
      })
      
      if (uniqueLocations.length > 0) {
        // Find sender location for reference
        const senderLoc = uniqueLocations.find(
          (loc: Location) => String(loc.user_id) === String(emergencyData.user_id)
        )
        if (senderLoc) {
          setSenderLocation(senderLoc)
        }
        
        // IMPORTANT: Set ALL locations - both sender and receiver locations
        // This ensures both markers appear on both maps
        setLocations(uniqueLocations)
        console.log('✅ Set locations state - ALL locations will be shown:', {
          totalLocations: uniqueLocations.length,
          senderLocation: senderLoc ? 'Found' : 'Missing',
          responderLocations: uniqueLocations.filter(l => String(l.user_id) !== String(emergencyData.user_id)).length
        })
        
        // Center map on midpoint of all locations
        if (uniqueLocations.length > 1) {
          const avgLat = uniqueLocations.reduce((sum: number, loc: Location) => 
            sum + parseFloat(loc.latitude.toString()), 0) / uniqueLocations.length
          const avgLng = uniqueLocations.reduce((sum: number, loc: Location) => 
            sum + parseFloat(loc.longitude.toString()), 0) / uniqueLocations.length
          setMapCenter({ lat: avgLat, lng: avgLng })
        } else {
          // Single location - center on it
          const loc = uniqueLocations[0]
          setMapCenter({
            lat: parseFloat(loc.latitude.toString()),
            lng: parseFloat(loc.longitude.toString()),
          })
        }
      } else {
        // No locations yet
        setLocations([])
        console.log('⚠️ No locations in API response yet')
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
  

  // Use default Google Maps markers - more reliable than custom icons
  // Default markers will always render correctly
  const getMarkerIcon = (): google.maps.Symbol | undefined => {
    // Return undefined to use default Google Maps marker
    // This ensures markers always render even if icon creation fails
    return undefined
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
              {mapLoaded && mapRef.current && typeof window !== 'undefined' && (window as any).google?.maps && locations.length > 0 && emergency && emergency.user_id && locations.map((location, index) => {
                const lat = parseFloat(location.latitude.toString())
                const lng = parseFloat(location.longitude.toString())
                
                if (isNaN(lat) || isNaN(lng)) {
                  return null
                }
                
                const currentUserId = getCurrentUserId()
                const isSenderLocation = String(location.user_id) === String(emergency.user_id)
                const isCurrentUserLocation = String(location.user_id) === String(currentUserId)
                const isSender = String(currentUserId) === String(emergency.user_id)
                
                // Add minimal offset for overlapping markers (very small - only if multiple markers at same spot)
                // This prevents complete overlap while keeping accurate GPS coordinates
                const offset = locations.length > 1 && index > 0 ? 0.00005 : 0
                const markerLat = lat + (index * offset)
                const markerLng = lng + (index * offset)
                
                return (
                  <Marker
                    key={`${location.user_id}-${location.timestamp || Date.now()}`}
                    position={{ lat: markerLat, lng: markerLng }}
                    // Use default Google Maps marker (more reliable than custom icons)
                    onClick={() => setSelectedLocation(location)}
                    label={{
                      text: isSenderLocation ? '🚨' : '📍',
                      color: '#FFFFFF',
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}
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
                          {!isSender && isSenderLocation && senderLocation && (() => {
                            // Parse coordinates to ensure they're numbers
                            const destLat = parseFloat(senderLocation.latitude.toString())
                            const destLng = parseFloat(senderLocation.longitude.toString())
                            
                            // Find current user's location to use as origin
                            const currentUserLoc = locations.find(loc => String(loc.user_id) === String(getCurrentUserId()))
                            const origin = currentUserLoc 
                              ? `${parseFloat(currentUserLoc.latitude.toString())},${parseFloat(currentUserLoc.longitude.toString())}`
                              : undefined
                            
                            // Build Google Maps URL with origin if available
                            const mapsUrl = origin
                              ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destLat},${destLng}`
                              : `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`
                            
                            return (
                              <>
                                <br />
                                <a
                                  href={mapsUrl}
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
                            )
                          })()}
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

