import { useState, useEffect, ReactNode, useRef } from 'react'
import { LoadScript } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

interface GoogleMapsLoaderProps {
  children: ReactNode
}

// Detect Safari browser - ONLY actual Safari, not all iOS browsers
const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  
  // Desktop Safari: has Safari but NOT Chrome
  const isDesktopSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edg/i.test(ua) && !/iphone|ipad|ipod/i.test(ua)
  
  // iOS Safari: has Safari, is iOS, and NOT Chrome/Firefox
  const isIOSSafari = /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/chrome|crios|fxios|edg/i.test(ua)
  
  return isDesktopSafari || isIOSSafari
}

// Check if Google Maps script is already in the DOM
const isScriptLoaded = (): boolean => {
  if (typeof window === 'undefined') return false
  const win = window as Record<string, any>
  if (win['google']?.maps) return true
  const scripts = document.getElementsByTagName('script')
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src.includes('maps.googleapis.com')) {
      return true
    }
  }
  return false
}

// Check if Google Maps API is ready
const isGoogleMapsReady = (): boolean => {
  if (typeof window === 'undefined') return false
  const win = window as Record<string, any>
  
  // First check if google object exists
  if (!win['google'] || typeof win['google'] === 'undefined') {
    return false
  }
  
  // Then check for maps API
  return !!(
    win['google']?.maps && 
    win['google']?.maps?.Map &&
    win['google']?.maps?.Marker
  )
}

export const GoogleMapsLoader = ({ children }: GoogleMapsLoaderProps) => {
  const [isReady, setIsReady] = useState(() => {
    if (isGoogleMapsReady()) {
      return true
    }
    return false
  })
  
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const scriptLoadingRef = useRef(false)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const safariMode = isSafari()

  // Cleanup function
  const cleanup = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }

  useEffect(() => {
    if (isReady) return

    // If script is already loading or loaded, check periodically
    if (scriptLoadingRef.current || isScriptLoaded()) {
      setIsLoading(true)
      checkIntervalRef.current = setInterval(() => {
        if (isGoogleMapsReady()) {
          scriptLoadingRef.current = false
          setIsReady(true)
          setIsLoading(false)
          cleanup()
        }
      }, 300)
      
      return cleanup
    }

    // Check periodically if maps loaded
    setIsLoading(true)
    checkIntervalRef.current = setInterval(() => {
      if (isGoogleMapsReady()) {
        setIsReady(true)
        setIsLoading(false)
        cleanup()
      }
    }, 300)
    
    return cleanup
  }, [isReady])

  useEffect(() => {
    return cleanup
  }, [])

  const handleRetry = () => {
    setError(null)
    setIsReady(false)
    setIsLoading(true)
    scriptLoadingRef.current = false
    cleanup()
    const scripts = document.getElementsByTagName('script')
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].src.includes('maps.googleapis.com')) {
        scripts[i].remove()
      }
    }
    if (typeof window !== 'undefined') {
      const win = window as Record<string, any>
      if (win['google']) {
        delete win['google']
      }
    }
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '8px',
        color: '#856404'
      }}>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>⚠️ Google Maps API Key Missing</p>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          Please configure VITE_GOOGLE_MAPS_API_KEY in your environment variables.
        </p>
      </div>
    )
  }

  if (isReady && isGoogleMapsReady()) {
    return <>{children}</>
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        backgroundColor: '#f8d7da',
        border: '1px solid #dc3545',
        borderRadius: '8px',
        color: '#721c24'
      }}>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>❌ Failed to Load Google Maps</p>
        <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem' }}>{error}</p>
        {safariMode && (
          <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', fontStyle: 'italic' }}>
            Safari detected: Try disabling "Prevent Cross-Site Tracking" in Safari Settings → Privacy
          </p>
        )}
        <button
          onClick={handleRetry}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 'bold'
          }}
        >
          Retry Loading Maps
        </button>
      </div>
    )
  }

  if (scriptLoadingRef.current || isScriptLoaded()) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        {isLoading && <p>Loading Google Maps...</p>}
      </div>
    )
  }

  scriptLoadingRef.current = true
  setIsLoading(true)

  return (
    <LoadScript 
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      loadingElement={<div style={{ padding: '20px', textAlign: 'center' }}>Loading Google Maps...</div>}
      onLoad={() => {
        const checkReady = (attempt = 0, maxAttempts = 50) => {
          const win = window as Record<string, any>
          
          // Check if google object exists first
          if (win['google'] && typeof win['google'] !== 'undefined') {
            // Then check if maps API is ready
            if (isGoogleMapsReady()) {
              scriptLoadingRef.current = false
              setIsReady(true)
              setIsLoading(false)
              console.log('✅ Google Maps API loaded successfully')
              return
            }
          }
          
          if (attempt < maxAttempts) {
            retryTimeoutRef.current = setTimeout(() => checkReady(attempt + 1, maxAttempts), 300)
          } else {
            console.warn('⚠️ LoadScript onLoad fired but window.google.maps not available after multiple attempts')
            console.warn('Debug info:', {
              hasGoogle: !!win['google'],
              googleType: typeof win['google'],
              hasMaps: !!win['google']?.maps,
              hasMapClass: !!win['google']?.maps?.Map,
              hasMarkerClass: !!win['google']?.maps?.Marker
            })
            scriptLoadingRef.current = false
            setIsLoading(false)
            setError('Google Maps API failed to initialize. Please check your API key and network connection.')
            retryTimeoutRef.current = setTimeout(() => {
              if (isGoogleMapsReady()) {
                scriptLoadingRef.current = false
                setIsReady(true)
                setIsLoading(false)
                setError(null)
                console.log('✅ Google Maps API loaded (delayed)')
              }
            }, 3000)
          }
        }
        
        // Start checking after short delay to allow script to initialize
        setTimeout(() => checkReady(), 500)
      }}
      onError={(error) => {
        scriptLoadingRef.current = false
        setIsLoading(false)
        console.error('❌ Google Maps load error:', error)
        
        if (isScriptLoaded()) {
          retryTimeoutRef.current = setTimeout(() => {
            if (isGoogleMapsReady()) {
              scriptLoadingRef.current = false
              setIsReady(true)
              setIsLoading(false)
              setError(null)
              console.log('✅ Google Maps API already loaded (recovered from error)')
            } else {
              retryTimeoutRef.current = setTimeout(() => {
                handleRetry()
              }, 3000)
            }
          }, 1000)
        } else {
          setError('Failed to load Google Maps script. Please check your internet connection and API key configuration.')
        }
      }}
    >
      {isReady && isGoogleMapsReady() ? children : (
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading Google Maps...</div>
      )}
    </LoadScript>
  )
}
