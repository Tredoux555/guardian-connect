import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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

// Simplified: No Google Maps API needed - direct link only

interface Location {
  user_id: string
  latitude: string | number  // Now stored as TEXT in database - exact GPS coordinates
  longitude: string | number  // Now stored as TEXT in database - exact GPS coordinates
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
  const [senderLocation, setSenderLocation] = useState<Location | null>(null)
  const emergencyEndedRef = useRef(false)
  const locationSharedRef = useRef(false)
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  // Helper function to refresh Eruda console after important logs
  const refreshErudaConsole = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).eruda?._console) {
      try {
        (window as any).eruda._console._refresh()
      } catch (e) {
        // Ignore errors
      }
    }
  }, [])

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

  // Listen for real-time location updates via socket (speeds up location display)
  useEffect(() => {
    if (!id || !emergency) return
    
    const handleLocationUpdate = (data: any) => {
      // Validate location data
      if (!data || !data.user_id || data.latitude === undefined || data.longitude === undefined) {
        return
      }
      
      // Use unified coordinate parsing for consistency
      const lat = parseCoordinate(data.latitude)
      const lng = parseCoordinate(data.longitude)
      
      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return
      }
      
      // Create location object matching Location interface
      const newLocation: Location = {
        user_id: String(data.user_id),
        latitude: lat,
        longitude: lng,
        timestamp: data.timestamp || new Date().toISOString(),
        user_email: data.user_email,
        user_display_name: data.user_display_name
      }
      
      // Update locations state immediately (remove old location for this user, add new one)
      setLocations(prevLocations => {
        const filtered = prevLocations.filter(loc => String(loc.user_id) !== String(data.user_id))
        const updated = [...filtered, newLocation]
        
        // Update sender location if this is the sender
        if (emergency && String(data.user_id) === String(emergency.user_id)) {
          setSenderLocation(newLocation)
        }
        
        // Update map center if needed
        // Map removed - no need to set center
        
        return updated
      })
      
      // Only log in development
      if (import.meta.env.DEV) {
        console.log('📍 Real-time location update received:', {
          userId: data.user_id,
          lat: lat,
          lng: lng,
          isSender: emergency && String(data.user_id) === String(emergency.user_id)
        })
      }
    }
    
    // Set up socket listener for location updates
    onLocationUpdate(handleLocationUpdate)
    
    return () => {
      removeListener('location_update', handleLocationUpdate)
    }
  }, [id, emergency])

  useEffect(() => {
    loadEmergency()
    // Refresh emergency data every 10 seconds (reduced from 5s to prevent excessive re-renders)
    const interval = setInterval(loadEmergency, 10000)
    
    return () => {
      clearInterval(interval)
    }
  }, [id])

  // Map removed - no map loading timeout needed

  // Share location once when page loads (for both sender and responder)
  useEffect(() => {
    const currentUserId = getCurrentUserId()
    if (!emergency || !id || !currentUserId) return
    if (locationSharedRef.current) return // Already shared location
    
    // Skip automatic location sharing on HTTP - browsers completely block it
    // Users must use the manual "Share Location" button instead
    const isHttp = window.location.protocol === 'http:' && window.location.hostname !== 'localhost'
    
    if (isHttp) {
      // On HTTP, skip automatic location sharing entirely
      // The manual button will be shown instead
      if (import.meta.env.DEV) {
        console.log('⚠️ Skipping automatic geolocation on HTTP (blocked by browser security policy)')
        console.log('💡 Users can use the "Share Location" button, but it may also be blocked on HTTP')
      }
      return
    }
    
    const isSender = emergency && String(emergency.user_id) === String(currentUserId)
    
    // Check if user's location already exists in locations array
    const userLocation = locations.find(loc => String(loc.user_id) === String(currentUserId))
    
    // If location doesn't exist, share it once
    if (!userLocation && navigator.geolocation) {
      locationSharedRef.current = true // Mark as shared to prevent duplicates
      
      // Capture variables in closure for error handler
      const senderCheck = isSender
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await api.post(`/emergencies/${id}/location`, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            })
            // Always log location sharing (critical for debugging)
            console.log('✅ Location shared once:', {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              userId: currentUserId,
              emergencyId: id,
              isSender: senderCheck
            })
            // Reload emergency data to update map
            setTimeout(() => {
              loadEmergency()
            }, 1000)
          } catch (err) {
            // Always log location sharing failures (critical for debugging)
            console.error('❌ Failed to share location:', {
              error: err,
              userId: currentUserId,
              emergencyId: id,
              isSender: senderCheck,
              message: (err as any)?.response?.data?.error || (err as any)?.message
            })
            // Don't reset locationSharedRef on API error - location was obtained, just failed to send
            // This prevents infinite retry loop
          }
        },
        (err) => {
          // Always log geolocation errors (critical for debugging)
          const errorDetails = {
            code: err.code,
            message: err.message,
            userId: currentUserId,
            emergencyId: id,
            isSender: senderCheck,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
          
          console.error('❌ Location error:', errorDetails)
          
          // Log specific error codes for better debugging
          if (err.code === 1) {
            console.error('❌ Error Code 1: PERMISSION_DENIED - User denied location permission')
          } else if (err.code === 2) {
            console.error('❌ Error Code 2: POSITION_UNAVAILABLE - Location unavailable (kCLErrorLocationUnknown)')
          } else if (err.code === 3) {
            console.error('❌ Error Code 3: TIMEOUT - Location request timed out')
          }
          
          // CRITICAL: Don't reset locationSharedRef on permission denied (code 1)
          // This prevents infinite retry loop on HTTP/iPhone
          // Only reset on other errors (timeout, unavailable)
          if (err.code === 1) {
            // Permission denied - don't retry (especially on HTTP/iPhone)
            // Mark as shared to prevent retry loop
            locationSharedRef.current = true
            console.warn('⚠️ Location permission denied. Skipping automatic location sharing.', {
              userId: currentUserId,
              isSender: senderCheck,
            })
            console.info('💡 Tip: Geolocation requires HTTPS (or localhost). Use HTTPS or enable location manually.')
          } else if (err.code === 2) {
            // Position unavailable (kCLErrorLocationUnknown on iOS) - this is a temporary error
            // Don't mark as shared, allow retry but with longer delay
            console.warn('⚠️ Location unavailable (kCLErrorLocationUnknown). This may be temporary.', {
              userId: currentUserId,
              isSender: senderCheck,
              suggestion: 'Location services may need time to acquire GPS signal. Try again in a few seconds.'
            })
            locationSharedRef.current = false // Allow retry
          } else {
            // Other errors (timeout, unavailable) - allow retry
            locationSharedRef.current = false
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
   * Uses exponential backoff following Google Maps Platform best practices
   */
  const loadEmergency = async (retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3
    const INITIAL_DELAY = 100  // Start with 100ms (following Google's recommendation)
    const MAX_DELAY = 5000     // Cap at 5 seconds (following Google's recommendation)
    
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
      
      // DEBUG: Log locations received from API
      console.log('📍 [DEBUG] Locations received from API:', {
        count: locationsData.length,
        locations: locationsData,
        emergencyId: id,
        timestamp: new Date().toISOString(),
        responseKeys: Object.keys(response.data)
      })
      
      // Validate and filter locations using unified coordinate parsing
      const validLocations = locationsData.filter((loc: Location) => {
        if (!loc || !loc.user_id) {
          console.warn('⚠️ [DEBUG] Invalid location (missing user_id):', loc)
          return false
        }
        const lat = parseCoordinate(loc.latitude)
        const lng = parseCoordinate(loc.longitude)
        const isValid = !isNaN(lat) && !isNaN(lng) && 
               lat >= -90 && lat <= 90 && 
               lng >= -180 && lng <= 180
        if (!isValid) {
          console.warn('⚠️ [DEBUG] Invalid location coordinates:', { 
            loc, 
            parsedLat: lat, 
            parsedLng: lng,
            rawLat: loc.latitude,
            rawLng: loc.longitude
          })
        }
        return isValid
      })
      
      console.log('📍 [DEBUG] Valid locations after filtering:', {
        count: validLocations.length,
        locations: validLocations
      })
      
      // Remove duplicate locations by user_id (keep most recent)
      const uniqueLocations = validLocations.filter((loc: Location, index: number, self: Location[]) => 
        index === self.findIndex((l: Location) => String(l.user_id) === String(loc.user_id))
      )
      
      console.log('📍 [DEBUG] Unique locations after deduplication:', {
        count: uniqueLocations.length,
        locations: uniqueLocations
      })
      
      if (uniqueLocations.length > 0) {
        // Find sender location for reference
        const senderLoc = uniqueLocations.find(
          (loc: Location) => String(loc.user_id) === String(emergencyData.user_id)
        )
        if (senderLoc) {
          setSenderLocation(senderLoc)
          console.log('✅ [DEBUG] Sender location set:', senderLoc)
        } else {
          console.warn('⚠️ [DEBUG] Sender location not found in unique locations', {
            senderUserId: emergencyData.user_id,
            uniqueLocationUserIds: uniqueLocations.map((l: Location) => l.user_id)
          })
        }
        
        setLocations(uniqueLocations)
        
        // Map removed - no need to set center
        if (uniqueLocations.length > 1) {
          console.log('✅ [DEBUG] Multiple locations found:', { count: uniqueLocations.length })
        } else {
          console.log('✅ [DEBUG] Single location found:', { loc: uniqueLocations[0] })
        }
        
        console.log('✅ [DEBUG] Locations set on map successfully:', {
          count: uniqueLocations.length,
          mapCenter: uniqueLocations.length > 1 
            ? { lat: uniqueLocations.reduce((sum: number, loc: Location) => sum + parseCoordinate(loc.latitude), 0) / uniqueLocations.length, 
                lng: uniqueLocations.reduce((sum: number, loc: Location) => sum + parseCoordinate(loc.longitude), 0) / uniqueLocations.length }
            : { lat: parseCoordinate(uniqueLocations[0].latitude), lng: parseCoordinate(uniqueLocations[0].longitude) }
        })
      } else {
        // No valid locations yet
        console.warn('⚠️ [DEBUG] No valid locations to display on map', {
          locationsDataCount: locationsData.length,
          validLocationsCount: validLocations.length,
          uniqueLocationsCount: uniqueLocations.length,
          emergencyId: id,
          senderUserId: emergencyData.user_id
        })
        setLocations([])
        setSenderLocation(null)
      }
    } catch (err: any) {
      // Only log errors in development or for critical failures
      if (import.meta.env.DEV || retryCount === 0) {
        console.error('Failed to load emergency:', err)
      }
      
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
        // Server error - retry with exponential backoff (following Google Maps Platform best practices)
        if (retryCount < MAX_RETRIES) {
          // Exponential backoff: delay doubles each retry (100ms, 200ms, 400ms, capped at 5000ms)
          const delay = Math.min(INITIAL_DELAY * Math.pow(2, retryCount), MAX_DELAY)
          // Only log retries in development
          if (import.meta.env.DEV) {
            console.log(`Server error. Retrying in ${delay}ms... (${retryCount + 1}/${MAX_RETRIES})`)
          }
          setTimeout(() => loadEmergency(retryCount + 1), delay)
          return
        } else {
          // Only show error after all retries have failed
          setError('Server error. Please try again later.')
        }
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        // Network timeout - retry with exponential backoff (following Google Maps Platform best practices)
        if (retryCount < MAX_RETRIES) {
          // Exponential backoff: delay doubles each retry (100ms, 200ms, 400ms, capped at 5000ms)
          const delay = Math.min(INITIAL_DELAY * Math.pow(2, retryCount), MAX_DELAY)
          // Only log retries in development
          if (import.meta.env.DEV) {
            console.log(`Connection timeout. Retrying in ${delay}ms... (${retryCount + 1}/${MAX_RETRIES})`)
          }
          setTimeout(() => loadEmergency(retryCount + 1), delay)
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

  // Map removed - onMapLoad function removed
  

  /**
   * Unified coordinate parsing function
   * Ensures consistent parsing from database (DECIMAL) to JavaScript number
   * Database stores: DECIMAL(10,8) for latitude, DECIMAL(11,8) for longitude
   * This function handles both string and number types from API responses
   */
  const parseCoordinate = (coord: string | number | null | undefined): number => {
    if (coord === null || coord === undefined) {
      return NaN
    }
    // Handle string types (from database DECIMAL)
    if (typeof coord === 'string') {
      return parseFloat(coord)
    }
    // Handle number types
    return Number(coord)
  }

  // Map removed - these functions no longer needed:
  // getMarkerIcon, calculateDistance, formatDistance, formatCoordinate, coordinatesToPlusCode

  /**
   * Generate Google Maps URL - SIMPLIFIED: Direct link with exact coordinates
   * Coordinates are stored as TEXT in database - zero precision loss
   * Use ?q=lat,lng format - drops pin at exact GPS coordinates
   */
  const getGoogleMapsUrl = (destLat: string | number, destLng: string | number): string => {
    // Convert to string (coordinates are stored as TEXT - exact GPS precision)
    const destLatStr = typeof destLat === 'string' ? destLat : destLat.toString()
    const destLngStr = typeof destLng === 'string' ? destLng : destLng.toString()
    
    // Simple, bulletproof format: ?q=lat,lng drops pin at exact coordinates
    return `https://www.google.com/maps?q=${destLatStr},${destLngStr}`
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
    
    // Step 3: Formatted coordinates (what goes in URL) - use directly as strings (stored as TEXT)
    const formattedLat = typeof senderLoc.latitude === 'string' ? senderLoc.latitude : senderLoc.latitude.toString()
    const formattedLng = typeof senderLoc.longitude === 'string' ? senderLoc.longitude : senderLoc.longitude.toString()
    
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
        // Use simple coordinate format for diagnostics - use directly as strings (stored as TEXT)
        const originLatStr = typeof responderLoc.latitude === 'string' ? responderLoc.latitude : responderLoc.latitude.toString()
        const originLngStr = typeof responderLoc.longitude === 'string' ? responderLoc.longitude : responderLoc.longitude.toString()
        const originCoords = `${originLatStr},${originLngStr}`
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
      return
    }

    // SIMPLIFIED: Generate URL directly from sender location coordinates (stored as TEXT - exact GPS)
    const senderLoc = locations.find(loc => loc && loc.user_id && String(loc.user_id) === String(emergency.user_id))
    
    if (!senderLoc) {
      setGoogleMapsUrl(null)
      return
    }

    // Coordinates are stored as TEXT - use directly (zero precision loss)
    const destLatStr = typeof senderLoc.latitude === 'string' ? senderLoc.latitude : senderLoc.latitude.toString()
    const destLngStr = typeof senderLoc.longitude === 'string' ? senderLoc.longitude : senderLoc.longitude.toString()
    
    // Simple, bulletproof: ?q=lat,lng format drops pin at exact coordinates
    const url = getGoogleMapsUrl(destLatStr, destLngStr)
    setGoogleMapsUrl(url)
  }, [isSender, emergency?.user_id, locations])

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
          backgroundColor: '#D4E8F5', /* Lighter medium baby blue - replaces yellow */
          borderRadius: '8px', 
          margin: '1rem 0',
          textAlign: 'center',
          color: '#4A6FA5' /* Darker blue text for contrast */
        }}>
          <p style={{ margin: 0, marginBottom: '0.5rem' }}>⏳ Waiting for emergency location data...</p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
            The sender needs to share their location. If they're on HTTP, they should use the "Share Location" button.
          </p>
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
          backgroundColor: '#C5E1F5', /* Medium baby blue - replaces grey */
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
                color: '#F5FAFF', /* Lightest baby blue - replaces white text */
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
            backgroundColor: '#D4E8F5', /* Lighter medium baby blue - replaces lighter grey */
            borderRadius: '4px',
            border: '1px solid #B3D9FF' /* Darker baby blue border */
          }}>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#9CC5E8', /* Darker baby blue - replaces grey button */
                color: '#F5FAFF', /* Lightest baby blue - replaces white text */
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
                backgroundColor: '#E6F2FF', /* Soft baby blue - replaces white */
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
                      <div key={idx} style={{ marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#C5E1F5', /* Medium baby blue - replaces grey */ borderRadius: '4px' }}>
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
                
                <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#D4E8F5', /* Lighter medium baby blue - replaces yellow */ borderRadius: '4px', fontSize: '0.8rem' }}>
                  <strong>Note:</strong> Check console for full diagnostic object. Compare coordinates above with what Google Maps shows.
                </div>
              </div>
            )}
          </div>
        </div>
      )
  }, [isSender, emergency?.user_id, locations, googleMapsUrl, showDiagnostics, generateDiagnostics])

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

      {/* Emergency Location - Direct Google Maps Link */}
      {senderLocation && (
        <div className="location-container" style={{
          padding: '1.5rem',
          backgroundColor: '#E8F4F8',
          borderRadius: '8px',
          margin: '1rem 0',
          textAlign: 'center'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>📍 Emergency Location</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            {senderLocation.user_display_name || senderLocation.user_email || 'Sender'} needs help
          </p>
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#4285F4',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                marginTop: '0.5rem'
              }}
            >
              🗺️ Get Directions in Google Maps
            </a>
          )}
          {!googleMapsUrl && (
            <p style={{ color: '#999', fontSize: '0.9rem' }}>
              Generating directions link...
            </p>
          )}
        </div>
      )}
      
      {!senderLocation && locations.length === 0 && (
        <div className="location-placeholder" style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#E8F4F8',
          borderRadius: '8px',
          margin: '1rem 0'
        }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            📍 Waiting for emergency location...
          </p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Emergency location will appear here once shared
          </p>
        </div>
      )}
      
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#FFF3CD',
          border: '1px solid #FFC107',
          borderRadius: '8px',
          margin: '1rem 0',
          color: '#856404'
        }}>
          <strong>⚠️ Warning:</strong> {error}
        </div>
      )}

      {/* Google Maps directions - Direct link with exact coordinates */}
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
                {p.user_display_name || p.user_email || 'Responder'} - Responding
              </div>
            ))}
          </div>
        )}

        {pendingParticipants.length > 0 && (
          <div className="participant-group">
            <h3>⏳ Deciding... ({pendingParticipants.length})</h3>
            {pendingParticipants.map((p: any) => (
              <div key={p.id} className="participant pending">
                {p.user_display_name || p.user_email || 'Contact'} - Waiting for response
              </div>
            ))}
          </div>
        )}

        {rejectedParticipants.length > 0 && (
          <div className="participant-group">
            <h3>❌ Unavailable ({rejectedParticipants.length})</h3>
            {rejectedParticipants.map((p: any) => (
              <div key={p.id} className="participant rejected">
                {p.user_display_name || p.user_email || 'Contact'} - Unavailable
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

