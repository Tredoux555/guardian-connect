import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import api from '../services/api'
import { getCurrentUserId } from '../utils/jwt'
import { GoogleMapsLoader } from '../components/GoogleMapsLoader'
import { 
  connectSocket, 
  joinEmergency, 
  leaveEmergency,
  onEmergencyEnded,
  onEmergencyCancelled,
  removeListener
} from '../services/socket'
import { EmergencyChat } from '../components/EmergencyChat'
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
  const [error, setError] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [mapCenter, setMapCenter] = useState(defaultCenter)
  const [senderLocation, setSenderLocation] = useState<Location | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef<google.maps.Map | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const emergencyEndedRef = useRef(false)
  const locationSharedRef = useRef(false)
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string | null>(null)
  const [googleMapsUrlLoading, setGoogleMapsUrlLoading] = useState(false)

  useEffect(() => {
    if (!id) return

    // Reset refs when emergency ID changes
    emergencyEndedRef.current = false
    locationSharedRef.current = false

    // Connect to socket only for emergency status updates (ended/cancelled)
    const token = localStorage.getItem('access_token')
    if (token) {
      const socket = connectSocket(token)
      joinEmergency(id)

      // Listen for emergency ended/cancelled (no location updates needed)
      const handleEmergencyEnded = (data: any) => {
        // Only show alert if this emergency matches current emergency and hasn't been handled yet
        if (data?.emergencyId === id && !emergencyEndedRef.current) {
          emergencyEndedRef.current = true
          alert('Emergency has ended')
          navigate('/')
        }
      }

      const handleEmergencyCancelled = (data: any) => {
        // Only show alert if this emergency matches current emergency and hasn't been handled yet
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

  useEffect(() => {
    loadEmergency()
    // Refresh emergency data every 10 seconds (reduced from 5s to prevent excessive re-renders)
    const interval = setInterval(loadEmergency, 10000)
    
    return () => {
      clearInterval(interval)
    }
  }, [id])

  // Monitor map loading timeout
  useEffect(() => {
    if (!mapLoaded && id) {
      const timeout = setTimeout(() => {
        if (!mapLoaded && mapRef.current) {
          console.warn('⚠️ Map did not load within expected time. Map ref exists but mapLoaded is still false.')
        } else if (!mapLoaded && !mapRef.current) {
          console.warn('⚠️ Map did not load within expected time. Map ref is null.')
        }
      }, 3000) // Warn after 3 seconds
      
      return () => clearTimeout(timeout)
    }
  }, [mapLoaded, id])

  // Share location once when page loads (for both sender and responder)
  useEffect(() => {
    const currentUserId = getCurrentUserId()
    if (!emergency || !id || !currentUserId) return
    if (locationSharedRef.current) return // Already shared location
    
    // Check if user's location already exists in locations array
    const userLocation = locations.find(loc => String(loc.user_id) === String(currentUserId))
    
    // If location doesn't exist, share it once
    if (!userLocation && navigator.geolocation) {
      locationSharedRef.current = true // Mark as shared to prevent duplicates
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await api.post(`/emergencies/${id}/location`, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            })
            console.log('✅ Location shared once:', {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              userId: currentUserId
            })
            // Reload emergency data to update map
            setTimeout(() => {
              loadEmergency()
            }, 1000)
          } catch (err) {
            console.error('❌ Failed to share location:', err)
            locationSharedRef.current = false // Reset on error so user can try again
          }
        },
        (err) => {
          console.error('❌ Location error:', err)
          locationSharedRef.current = false // Reset on error
          if (err.code === 1) {
            console.warn('⚠️ Location permission denied. Please enable location access.')
          }
        },
        {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 0
        }
      )
    } else if (userLocation) {
      // Location already exists, mark as shared
      locationSharedRef.current = true
    }
  }, [emergency, locations, id])

  /**
   * Load emergency data with comprehensive error handling and retry logic
   */
  const loadEmergency = async (retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3
    const RETRY_DELAY = 2000
    
    try {
      setError(null)
      const response = await api.get(`/emergencies/${id}`)
      
      // Validate API response structure
      if (!response || !response.data) {
        throw new Error('Invalid API response structure')
      }
      
      const emergencyData = response.data.emergency
      
      // Validate emergency data
      if (!emergencyData) {
        throw new Error('Emergency data not found in response')
      }
      
      if (!emergencyData.user_id) {
        console.error('Emergency data missing user_id:', emergencyData)
        setError('Invalid emergency data: missing user ID')
        navigate('/')
        return
      }
      
      setEmergency(emergencyData)
      setParticipants(response.data.participants || [])
      
      // Check if emergency was cancelled or ended
      if (emergencyData.status === 'cancelled' || emergencyData.status === 'ended') {
        const message = emergencyData.status === 'cancelled' 
          ? 'This emergency has been cancelled.' 
          : 'This emergency has ended.'
        alert(message)
        navigate('/')
        return
      }
      
      // Process locations with validation
      const locationsData = response.data.locations || []
      
      // Validate and filter locations
      const validLocations = locationsData.filter((loc: Location) => {
        if (!loc || !loc.user_id) return false
        const lat = parseFloat(loc.latitude?.toString() || '')
        const lng = parseFloat(loc.longitude?.toString() || '')
        return !isNaN(lat) && !isNaN(lng) && 
               lat >= -90 && lat <= 90 && 
               lng >= -180 && lng <= 180
      })
      
      // Remove duplicate locations by user_id (keep most recent)
      const uniqueLocations = validLocations.filter((loc: Location, index: number, self: Location[]) => 
        index === self.findIndex((l: Location) => String(l.user_id) === String(loc.user_id))
      )
      
      if (uniqueLocations.length > 0) {
        // Find sender location for reference
        const senderLoc = uniqueLocations.find(
          (loc: Location) => String(loc.user_id) === String(emergencyData.user_id)
        )
        if (senderLoc) {
          setSenderLocation(senderLoc)
        }
        
        setLocations(uniqueLocations)
        
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
        // No valid locations yet
        setLocations([])
        setSenderLocation(null)
      }
    } catch (err: any) {
      console.error('Failed to load emergency:', err)
      
      // Handle specific error cases
      if (err.response?.status === 404) {
        setError('Emergency not found')
        setTimeout(() => navigate('/'), 2000)
        return
      } else if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.')
        setTimeout(() => navigate('/login'), 2000)
        return
      } else if (err.response?.status >= 500) {
        // Server error - retry silently (don't show error during retries)
        if (retryCount < MAX_RETRIES) {
          // Log to console but don't update UI during retries
          console.log(`Server error. Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
          setTimeout(() => loadEmergency(retryCount + 1), RETRY_DELAY * (retryCount + 1))
          return
        } else {
          // Only show error after all retries have failed
          setError('Server error. Please try again later.')
        }
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        // Network timeout - retry silently (don't show error during retries)
        if (retryCount < MAX_RETRIES) {
          // Log to console but don't update UI during retries
          console.log(`Connection timeout. Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
          setTimeout(() => loadEmergency(retryCount + 1), RETRY_DELAY * (retryCount + 1))
          return
        } else {
          // Only show error after all retries have failed
          setError('Connection timeout. Please check your network connection.')
        }
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to load emergency data')
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle map load event
   * Sets map reference and marks map as loaded after initialization
   */
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
            if (mapRef.current === map && mapRef.current.getDiv()) {
              setMapLoaded(true)
            } else {
              console.warn('⚠️ Map instance changed or invalid during retry initialization')
            }
          }, 500)
        }
      }, 200)
      return
    }
    
    // Set map reference and mark as loaded after a delay to ensure initialization
    mapRef.current = map
    
    // Verify map instance is valid
    if (!mapRef.current.getDiv()) {
      console.warn('⚠️ Map instance does not have a valid div element')
      return
    }
    
    setTimeout(() => {
      if (mapRef.current === map && mapRef.current.getDiv()) {
        setMapLoaded(true)
      } else {
        console.warn('⚠️ Map instance changed or invalid during initialization')
      }
    }, 500)
  }, [])
  

  /**
   * Get marker icon based on location type
   * Sender: red pin (default Google Maps marker)
   * Receiver: blue dot (custom icon)
   * Falls back to default marker if custom icon creation fails
   */
  const getMarkerIcon = (isSenderLocation: boolean): google.maps.Symbol | undefined => {
    // Always validate Google Maps is available first
    if (typeof window === 'undefined') return undefined
    const google = (window as any).google
    if (!google?.maps) return undefined
    
    // Sender location: use default red pin
    if (isSenderLocation) {
      return undefined
    }
    
    // Receiver location: blue dot
    try {
      if (!google.maps.SymbolPath) {
        // Fallback to default marker if SymbolPath not available
        return undefined
      }
      
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12, // Increased from 10 for better visibility
        fillColor: '#4285F4', // Google blue
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3, // Increased from 2 for better contrast
      }
    } catch (error) {
      // Fallback to default marker on error
      console.error('Error creating marker icon:', error)
      return undefined
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers
   */
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Format distance for display
   * Returns formatted string in km or miles based on distance
   */
  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m away`
    } else if (distanceKm < 10) {
      return `${distanceKm.toFixed(1)} km away`
    } else {
      return `${Math.round(distanceKm)} km away`
    }
  }

  /**
   * Format coordinate with optimal precision for Google Maps URLs
   * 6 decimal places = ~10cm accuracy (sufficient and more reliable for Google Maps)
   * 8 decimal places can sometimes cause issues with Google Maps URL parsing
   */
  const formatCoordinate = (coord: number): string => {
    // Use 6 decimal places for Google Maps URLs (more reliable than 8)
    // This provides ~10cm accuracy which is more than sufficient
    return coord.toFixed(6)
  }

  /**
   * Generate Google Maps navigation URL using exact coordinates
   * This ensures Google Maps uses GPS coordinates directly, not geocoded addresses
   * Using coordinates directly prevents the "same location" error when both places
   * geocode to the same district (e.g., "Haidian District, Beijing, China")
   */
  const getGoogleMapsUrl = (
    originLat: number, 
    originLng: number, 
    destLat: number, 
    destLng: number
  ): string => {
    try {
      // Validate coordinates before building URL
      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        throw new Error('Invalid coordinates provided to getGoogleMapsUrl')
      }
      
      // Format coordinates with 6 decimal places (optimal precision)
      const originCoords = `${formatCoordinate(originLat)},${formatCoordinate(originLng)}`
      const destCoords = `${formatCoordinate(destLat)},${formatCoordinate(destLng)}`
      
      // Check if origin and destination are the same (or very close)
      // Calculate distance in degrees (rough approximation)
      const latDiff = Math.abs(originLat - destLat)
      const lngDiff = Math.abs(originLng - destLng)
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
      
      // If locations are identical or extremely close (< 0.0001 degrees ≈ 11 meters), just show destination
      if (distance < 0.0001) {
        return `https://www.google.com/maps/search/?api=1&query=${destCoords}`
      }
      
      // Use the most reliable format for directions with exact coordinates
      // Key elements:
      // 1. Use coordinates directly (not place_id) to avoid geocoding to districts
      // 2. Use 'dir_action=navigate' to force navigation mode
      // 3. Don't encode coordinates - Google Maps handles unencoded coordinates better
      // This format forces Google Maps to treat them as GPS coordinates, not addresses
      return `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}&travelmode=driving&dir_action=navigate`
      
    } catch (error) {
      console.error('Error generating Google Maps URL:', error)
      // Fallback to destination only
      const destCoords = `${formatCoordinate(destLat)},${formatCoordinate(destLng)}`
      return `https://www.google.com/maps/search/?api=1&query=${destCoords}`
    }
  }

  /**
   * Generate comprehensive diagnostic data for Google Maps location issue
   * Tracks coordinates at every step to identify where the problem occurs
   */
  const generateDiagnostics = (senderLoc: Location): any => {
    // Step 1: Raw database values
    const dbLat = senderLoc.latitude
    const dbLng = senderLoc.longitude
    
    // Step 2: Parsed coordinates
    const parsedLat = parseFloat(senderLoc.latitude.toString())
    const parsedLng = parseFloat(senderLoc.longitude.toString())
    
    // Step 3: Formatted coordinates (what goes in URL)
    const formattedLat = formatCoordinate(parsedLat)
    const formattedLng = formatCoordinate(parsedLng)
    
    // Step 4: Map marker coordinates (from locations array)
    const mapMarkerLoc = locations.find(loc => String(loc.user_id) === String(emergency?.user_id))
    const mapMarkerLat = mapMarkerLoc ? parseFloat(mapMarkerLoc.latitude.toString()) : null
    const mapMarkerLng = mapMarkerLoc ? parseFloat(mapMarkerLoc.longitude.toString()) : null
    
    // Step 5: Generate multiple URL formats for testing
    const urlFormats = [
      {
        name: 'Current Format (Option 2 - My Location)',
        url: `https://www.google.com/maps/dir/My+Location/${formattedLat},${formattedLng}`
      },
      {
        name: 'Option 1 (place marker with query)',
        url: `https://www.google.com/maps/@${formattedLat},${formattedLng},15z?q=${formattedLat},${formattedLng}`
      },
      {
        name: 'Option 3 (search with place ID)',
        url: `https://www.google.com/maps/search/?api=1&query=${formattedLat},${formattedLng}&query_place_id=${formattedLat},${formattedLng}`
      },
      {
        name: 'Option 4 (dir with data param)',
        url: `https://www.google.com/maps/dir/?api=1&destination=${formattedLat},${formattedLng}&destination_place_id=&travelmode=driving`
      },
      {
        name: 'Fallback (dir path style)',
        url: `https://www.google.com/maps/dir/${formattedLat},${formattedLng}`
      },
      {
        name: 'Fallback 2 (dir with encoded coords)',
        url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${formattedLat},${formattedLng}`)}&travelmode=driving`
      }
    ]
    
    // Step 6: Compare coordinates
    const dbVsParsed = {
      latMatch: dbLat === parsedLat || Math.abs(Number(dbLat) - parsedLat) < 0.00000001,
      lngMatch: dbLng === parsedLng || Math.abs(Number(dbLng) - parsedLng) < 0.00000001
    }
    
    const parsedVsFormatted = {
      latMatch: parsedLat.toString() === formattedLat || Math.abs(parsedLat - parseFloat(formattedLat)) < 0.00000001,
      lngMatch: parsedLng.toString() === formattedLng || Math.abs(parsedLng - parseFloat(formattedLng)) < 0.00000001
    }
    
    const dbVsMapMarker = mapMarkerLat !== null && mapMarkerLng !== null ? {
      latMatch: Math.abs(Number(dbLat) - mapMarkerLat) < 0.00000001,
      lngMatch: Math.abs(Number(dbLng) - mapMarkerLng) < 0.00000001,
      latDiff: Math.abs(Number(dbLat) - mapMarkerLat),
      lngDiff: Math.abs(Number(dbLng) - mapMarkerLng)
    } : null
    
    // Step 7: Build current URL (same logic as button)
    // Note: For diagnostics, we use a simple synchronous format
    // The actual URL generation with place_id happens in the useEffect
    const responderLoc = currentUserId 
      ? locations.find(loc => String(loc.user_id) === String(currentUserId))
      : null
    
    let currentUrl: string
    if (responderLoc) {
      const originLat = parseFloat(responderLoc.latitude.toString())
      const originLng = parseFloat(responderLoc.longitude.toString())
      if (!isNaN(originLat) && !isNaN(originLng)) {
        // Use simple coordinate format for diagnostics (async place_id lookup happens elsewhere)
        const originCoords = `${formatCoordinate(originLat)},${formatCoordinate(originLng)}`
        currentUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${formattedLat},${formattedLng}&travelmode=driving`
      } else {
        currentUrl = `https://www.google.com/maps/dir/?api=1&destination=${formattedLat},${formattedLng}&travelmode=driving`
      }
    } else {
      currentUrl = `https://www.google.com/maps/dir/?api=1&destination=${formattedLat},${formattedLng}&travelmode=driving`
    }
    
    // Step 8: Extract coordinates from URL to verify
    let urlExtractedLat: string | null = null
    let urlExtractedLng: string | null = null
    
    // Extract destination coordinates from URL
    const destMatch = currentUrl.match(/destination=([^&,]+),([^&]+)/)
    if (destMatch) {
      urlExtractedLat = destMatch[1]
      urlExtractedLng = destMatch[2]
    }
    
    // Extract origin coordinates if present
    let urlExtractedOriginLat: string | null = null
    let urlExtractedOriginLng: string | null = null
    const originMatch = currentUrl.match(/origin=([^&,]+),([^&]+)/)
    if (originMatch) {
      urlExtractedOriginLat = originMatch[1]
      urlExtractedOriginLng = originMatch[2]
    }
    
    return {
      timestamp: new Date().toISOString(),
      database: {
        lat: dbLat,
        lng: dbLng,
        latType: typeof dbLat,
        lngType: typeof dbLng,
        latString: String(dbLat),
        lngString: String(dbLng)
      },
      parsed: {
        lat: parsedLat,
        lng: parsedLng,
        latIsNaN: isNaN(parsedLat),
        lngIsNaN: isNaN(parsedLng)
      },
      formatted: {
        lat: formattedLat,
        lng: formattedLng,
        latPrecision: formattedLat.split('.')[1]?.length || 0,
        lngPrecision: formattedLng.split('.')[1]?.length || 0
      },
      mapMarker: {
        lat: mapMarkerLat,
        lng: mapMarkerLng,
        source: mapMarkerLoc ? 'locations array' : 'not found'
      },
      comparisons: {
        dbVsParsed,
        parsedVsFormatted,
        dbVsMapMarker
      },
      urlFormats,
      currentUrl,
      urlExtraction: {
        destination: {
          lat: urlExtractedLat,
          lng: urlExtractedLng,
          matchesFormatted: urlExtractedLat === formattedLat && urlExtractedLng === formattedLng
        },
        origin: responderLoc ? {
          lat: urlExtractedOriginLat,
          lng: urlExtractedOriginLng
        } : null
      },
      locationObject: senderLoc
    }
  }

  /**
   * End the emergency
   * Only the emergency creator can end an emergency
   */
  const endEmergency = async () => {
    if (!confirm('End this emergency?')) return

    // Set flag immediately to prevent duplicate alerts
    emergencyEndedRef.current = true

    try {
      await api.post(`/emergencies/${id}/end`, {})
      navigate('/')
    } catch (err: any) {
      // Reset flag if API call fails so user can try again
      emergencyEndedRef.current = false
      if (err.response?.status === 403) {
        alert('Only the emergency creator can end the emergency.')
      } else {
        alert(err.response?.data?.error || 'Failed to end emergency')
      }
    }
  }

  // Debug summary on render - MUST be before early return to follow Rules of Hooks
  const acceptedParticipants = participants.filter((p: any) => p && p.status === 'accepted')
  
  // Get current user info - MUST be before early return to follow Rules of Hooks
  const currentUserId = getCurrentUserId()
  const isSender = emergency && currentUserId ? String(currentUserId) === String(emergency.user_id) : false

  // Generate Google Maps URL with exact coordinates when locations are available
  useEffect(() => {
    if (isSender || !emergency?.user_id || !locations.length) {
      setGoogleMapsUrl(null)
      setGoogleMapsUrlLoading(false)
      return
    }

    const generateUrl = () => {
      setGoogleMapsUrlLoading(true)
      try {
        // Find sender location from locations array (same as what's shown on map)
        const senderLoc = locations.find(loc => loc && loc.user_id && String(loc.user_id) === String(emergency.user_id))
        
        if (!senderLoc) {
          setGoogleMapsUrl(null)
          setGoogleMapsUrlLoading(false)
          return
        }

        // Parse coordinates exactly the same way as map markers do
        const destLat = parseFloat(senderLoc.latitude.toString())
        const destLng = parseFloat(senderLoc.longitude.toString())
        
        // Validate destination coordinates
        if (isNaN(destLat) || isNaN(destLng) || 
            destLat < -90 || destLat > 90 || 
            destLng < -180 || destLng > 180) {
          setGoogleMapsUrl(null)
          setGoogleMapsUrlLoading(false)
          return
        }
        
        // Find responder location (current user) from locations array (optional)
        const responderLoc = currentUserId 
          ? locations.find(loc => loc && loc.user_id && String(loc.user_id) === String(currentUserId))
          : null
        
        let url: string
        
        if (responderLoc) {
          const originLat = parseFloat(responderLoc.latitude.toString())
          const originLng = parseFloat(responderLoc.longitude.toString())
          
          // Validate origin coordinates
          if (!isNaN(originLat) && !isNaN(originLng) &&
              originLat >= -90 && originLat <= 90 &&
              originLng >= -180 && originLng <= 180) {
            // Use both origin and destination coordinates directly (no place_id lookup)
            url = getGoogleMapsUrl(originLat, originLng, destLat, destLng)
          } else {
            // Fallback to destination only
            const destCoords = `${formatCoordinate(destLat)},${formatCoordinate(destLng)}`
            url = `https://www.google.com/maps/search/?api=1&query=${destCoords}`
          }
        } else {
          // Responder location not available yet - use destination only
          const destCoords = `${formatCoordinate(destLat)},${formatCoordinate(destLng)}`
          url = `https://www.google.com/maps/search/?api=1&query=${destCoords}`
        }
        
        // Validate URL
        if (url && url.startsWith('https://www.google.com/maps')) {
          setGoogleMapsUrl(url)
        } else {
          setGoogleMapsUrl(null)
        }
      } catch (error) {
        console.error('Error generating Google Maps URL:', error)
        setGoogleMapsUrl(null)
      } finally {
        setGoogleMapsUrlLoading(false)
      }
    }

    generateUrl()
  }, [isSender, emergency?.user_id, locations, currentUserId, formatCoordinate, getGoogleMapsUrl])

  // Google Maps button - MUST be before early return to follow Rules of Hooks
  const googleMapsButton = useMemo(() => {
    if (isSender || !emergency?.user_id) return null
    
    // Find sender location from locations array (same as what's shown on map)
    const senderLoc = locations.find(loc => loc && loc.user_id && String(loc.user_id) === String(emergency.user_id))
    
    // If no sender location yet, show message
    if (!senderLoc) {
      return (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fff3cd', 
          borderRadius: '8px', 
          margin: '1rem 0',
          textAlign: 'center',
          color: '#856404'
        }}>
          <p style={{ margin: 0 }}>⏳ Waiting for emergency location data...</p>
        </div>
      )
    }

    // If URL is loading, show loading state
    if (googleMapsUrlLoading) {
      return (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '8px', 
          margin: '1rem 0',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0 }}>📍 Generating directions link...</p>
        </div>
      )
    }

    // If no URL generated, show error
    if (!googleMapsUrl) {
      return (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f8d7da', 
          borderRadius: '8px', 
          margin: '1rem 0',
          textAlign: 'center',
          color: '#721c24'
        }}>
          <p style={{ margin: 0 }}>❌ Error generating Google Maps directions URL</p>
        </div>
      )
    }

    // Generate comprehensive diagnostics
    const diagnostics = generateDiagnostics(senderLoc)
      
    return (
      <div>
        <div className="maps-link-container" style={{ 
          padding: '1rem', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '8px', 
          margin: '1rem 0',
          textAlign: 'center'
        }}>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              // Verify URL is valid before opening
              if (!googleMapsUrl || !googleMapsUrl.startsWith('https://www.google.com/maps')) {
                e.preventDefault()
                alert('Invalid Google Maps URL. Please try again.')
                return false
              }
            }}
              style={{ 
                display: 'inline-block', 
                padding: '1rem 2rem',
                backgroundColor: '#4285F4',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}
            >
              Open in Google Maps for Directions
            </a>
          </div>
          
          {/* Diagnostic Panel */}
          <div style={{ 
            margin: '1rem 0',
            padding: '0.5rem',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {showDiagnostics ? '▼ Hide' : '▶ Show'} Location Diagnostics
            </button>
            
            {showDiagnostics && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'white',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                maxHeight: '600px',
                overflow: 'auto'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Coordinate Tracking</h4>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Database (Raw):</strong>
                  <div style={{ paddingLeft: '1rem', color: '#666' }}>
                    Lat: {String(diagnostics.database.lat)} (type: {diagnostics.database.latType})<br/>
                    Lng: {String(diagnostics.database.lng)} (type: {diagnostics.database.lngType})
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Parsed:</strong>
                  <div style={{ paddingLeft: '1rem', color: '#666' }}>
                    Lat: {diagnostics.parsed.lat} {diagnostics.parsed.latIsNaN && <span style={{color: 'red'}}>⚠ NaN</span>}<br/>
                    Lng: {diagnostics.parsed.lng} {diagnostics.parsed.lngIsNaN && <span style={{color: 'red'}}>⚠ NaN</span>}
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Formatted (URL):</strong>
                  <div style={{ paddingLeft: '1rem', color: '#666' }}>
                    Lat: {diagnostics.formatted.lat} ({diagnostics.formatted.latPrecision} decimals)<br/>
                    Lng: {diagnostics.formatted.lng} ({diagnostics.formatted.lngPrecision} decimals)
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Map Marker:</strong>
                  <div style={{ paddingLeft: '1rem', color: '#666' }}>
                    {diagnostics.mapMarker.lat !== null ? (
                      <>
                        Lat: {diagnostics.mapMarker.lat}<br/>
                        Lng: {diagnostics.mapMarker.lng}<br/>
                        Source: {diagnostics.mapMarker.source}
                      </>
                    ) : (
                      <span style={{color: 'red'}}>Not found in locations array</span>
                    )}
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Comparisons:</strong>
                  <div style={{ paddingLeft: '1rem', color: '#666' }}>
                    DB vs Parsed: 
                    <span style={{color: diagnostics.comparisons.dbVsParsed.latMatch && diagnostics.comparisons.dbVsParsed.lngMatch ? 'green' : 'red'}}>
                      {diagnostics.comparisons.dbVsParsed.latMatch && diagnostics.comparisons.dbVsParsed.lngMatch ? ' ✓ Match' : ' ✗ Mismatch'}
                    </span><br/>
                    Parsed vs Formatted: 
                    <span style={{color: diagnostics.comparisons.parsedVsFormatted.latMatch && diagnostics.comparisons.parsedVsFormatted.lngMatch ? 'green' : 'red'}}>
                      {diagnostics.comparisons.parsedVsFormatted.latMatch && diagnostics.comparisons.parsedVsFormatted.lngMatch ? ' ✓ Match' : ' ✗ Mismatch'}
                    </span><br/>
                    {diagnostics.comparisons.dbVsMapMarker && (
                      <>
                        DB vs Map Marker: 
                        <span style={{color: diagnostics.comparisons.dbVsMapMarker.latMatch && diagnostics.comparisons.dbVsMapMarker.lngMatch ? 'green' : 'red'}}>
                          {diagnostics.comparisons.dbVsMapMarker.latMatch && diagnostics.comparisons.dbVsMapMarker.lngMatch ? ' ✓ Match' : ' ✗ Mismatch'}
                        </span>
                        {!diagnostics.comparisons.dbVsMapMarker.latMatch && (
                          <span style={{color: 'red'}}> (Diff: {diagnostics.comparisons.dbVsMapMarker.latDiff.toFixed(8)}, {diagnostics.comparisons.dbVsMapMarker.lngDiff.toFixed(8)})</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Current URL:</strong>
                  <div style={{ paddingLeft: '1rem', color: '#666', wordBreak: 'break-all' }}>
                    {diagnostics.currentUrl}
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>URL Extraction:</strong>
                  <div style={{ paddingLeft: '1rem', color: '#666' }}>
                    Extracted Lat: {diagnostics.urlExtraction.lat || 'Not found'}<br/>
                    Extracted Lng: {diagnostics.urlExtraction.lng || 'Not found'}<br/>
                    Matches Formatted: 
                    <span style={{color: diagnostics.urlExtraction.matchesFormatted ? 'green' : 'red'}}>
                      {diagnostics.urlExtraction.matchesFormatted ? ' ✓ Yes' : ' ✗ No'}
                    </span>
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Alternative URL Formats (for testing):</strong>
                  <div style={{ paddingLeft: '1rem' }}>
                    {diagnostics.urlFormats.map((format: any, idx: number) => (
                      <div key={idx} style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{format.name}:</div>
                        <a 
                          href={format.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#4285F4', wordBreak: 'break-all', fontSize: '0.8rem' }}
                        >
                          {format.url}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <strong>Note:</strong> Check console for full diagnostic object. Compare coordinates above with what Google Maps shows.
                </div>
              </div>
            )}
          </div>
        </div>
      )
  }, [isSender, emergency?.user_id, locations, googleMapsUrl, googleMapsUrlLoading, showDiagnostics, formatCoordinate, generateDiagnostics])

  if (loading) {
    return (
      <div className="emergency-active">
        <div className="loading" style={{ 
          padding: '2rem', 
          textAlign: 'center',
          fontSize: '1.2rem'
        }}>
          <p>Loading emergency data...</p>
          {error && <p style={{ color: '#ff6b6b', marginTop: '1rem' }}>{error}</p>}
        </div>
      </div>
    )
  }
  
  if (error && !emergency) {
    return (
      <div className="emergency-active">
        <div className="error" style={{ 
          padding: '2rem', 
          textAlign: 'center',
          fontSize: '1.2rem',
          color: '#ff6b6b'
        }}>
          <p><strong>Error:</strong> {error}</p>
          <button 
            onClick={() => navigate('/')} 
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const pendingParticipants = participants.filter((p: any) => p && p.status === 'pending')
  const rejectedParticipants = participants.filter((p: any) => p && p.status === 'rejected')

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
            {typeof window !== 'undefined' && (window as any).google?.maps ? (
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
              {/* Render markers for all locations - both sender and receiver */}
              {/* Only render markers when Google Maps API is fully available and map is ready */}
              {locations.length > 0 && emergency && emergency.user_id && 
               typeof window !== 'undefined' && (window as any).google?.maps && 
               mapLoaded && mapRef.current && locations.map((location, index) => {
                // Validate location object
                if (!location || !location.user_id) {
                  return null
                }
                
                // Validate coordinates
                if (location.latitude === null || location.latitude === undefined ||
                    location.longitude === null || location.longitude === undefined) {
                  return null
                }
                
                // Parse coordinates - MUST use same method as Google Maps URL generation
                // This ensures map markers and directions URL use identical coordinates
                const lat = parseFloat(location.latitude.toString())
                const lng = parseFloat(location.longitude.toString())
                
                // Validate coordinate ranges
                if (isNaN(lat) || isNaN(lng) || 
                    lat < -90 || lat > 90 || 
                    lng < -180 || lng > 180) {
                  console.warn('Invalid coordinates:', { lat, lng, location })
                  return null
                }
                
                // Safe comparison with null checks
                const isSenderLocation = emergency && emergency.user_id && location.user_id
                  ? String(location.user_id) === String(emergency.user_id) 
                  : false
                const isCurrentUserLocation = currentUserId && location.user_id
                  ? String(location.user_id) === String(currentUserId) 
                  : false
                
                // Use exact coordinates for all markers (no offset)
                // These coordinates MUST match what's sent to Google Maps directions URL
                const markerLat = lat
                const markerLng = lng
                
                // Double-check Google Maps is available and map is ready before rendering Marker
                if (typeof window === 'undefined' || !(window as any).google?.maps?.Marker || !mapRef.current) {
                  return null
                }
                
                try {
                  // Get icon - sender uses default red pin (undefined), receiver uses blue dot
                  const markerIcon = isSenderLocation ? undefined : getMarkerIcon(false)
                  
                  return (
                    <Marker
                      key={`${location.user_id}-${location.timestamp || Date.now()}`}
                      position={{ lat: markerLat, lng: markerLng }}
                      icon={markerIcon}
                      zIndex={isSenderLocation ? 1 : 2} // Blue dot (receiver) above red pin (sender)
                      onClick={() => setSelectedLocation(location)}
                      label={isSenderLocation ? {
                        text: '🚨',
                        color: '#FFFFFF',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      } : undefined}
                    >
                      {selectedLocation?.user_id === location.user_id && (() => {
                        // Calculate distance to other location
                        let distanceText = ''
                        if (isSenderLocation && !isSender) {
                          // Responder viewing sender location - show distance from responder to sender
                          const responderLoc = locations.find(loc => String(loc.user_id) === String(currentUserId))
                          if (responderLoc) {
                            const responderLat = parseFloat(responderLoc.latitude.toString())
                            const responderLng = parseFloat(responderLoc.longitude.toString())
                            const distance = calculateDistance(responderLat, responderLng, lat, lng)
                            distanceText = formatDistance(distance)
                          }
                        } else if (!isSenderLocation && isSender) {
                          // Sender viewing responder location - show distance from sender to responder
                          const senderLoc = locations.find(loc => String(loc.user_id) === String(emergency.user_id))
                          if (senderLoc) {
                            const senderLat = parseFloat(senderLoc.latitude.toString())
                            const senderLng = parseFloat(senderLoc.longitude.toString())
                            const distance = calculateDistance(senderLat, senderLng, lat, lng)
                            distanceText = formatDistance(distance)
                          }
                        } else if (!isSenderLocation && !isSender) {
                          // Responder viewing another responder location - show distance from current responder
                          const currentLoc = locations.find(loc => String(loc.user_id) === String(currentUserId))
                          if (currentLoc) {
                            const currentLat = parseFloat(currentLoc.latitude.toString())
                            const currentLng = parseFloat(currentLoc.longitude.toString())
                            const distance = calculateDistance(currentLat, currentLng, lat, lng)
                            distanceText = formatDistance(distance)
                          }
                        }
                        
                        return (
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
                              {distanceText && (
                                <>
                                  <br />
                                  <small style={{ color: '#666', fontWeight: 'bold' }}>{distanceText}</small>
                                </>
                              )}
                            </div>
                          </InfoWindow>
                        )
                      })()}
                    </Marker>
                  )
                } catch (error) {
                  console.error('Error rendering marker:', error, location)
                  return null
                }
              }).filter(Boolean)}
              </GoogleMap>
            ) : (
              <div style={{ 
                padding: '2rem', 
                textAlign: 'center',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                margin: '1rem 0'
              }}>
                <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                  Loading Google Maps...
                </p>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                  Please wait while the map loads
                </p>
              </div>
            )}
          </GoogleMapsLoader>
          {locations.length === 0 && (
            <div className="map-placeholder" style={{
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              margin: '1rem 0'
            }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                📍 Waiting for emergency location...
              </p>
              <p className="map-hint" style={{ color: '#666', fontSize: '0.9rem' }}>
                Emergency location will appear here once shared
              </p>
              {emergency && String(emergency.user_id) === String(currentUserId) && (
                <p style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  If your location doesn't appear, please allow location access in Safari settings.
                </p>
              )}
            </div>
          )}
          
          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              margin: '1rem 0',
              color: '#856404'
            }}>
              <strong>⚠️ Warning:</strong> {error}
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

      {/* Google Maps directions - only for responders */}
      {googleMapsButton}

      {/* Emergency Chat */}
      <EmergencyChat emergencyId={id || ''} />

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

