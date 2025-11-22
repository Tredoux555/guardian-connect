import { useState, useEffect, ReactNode, useRef } from 'react'
import { LoadScript } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

interface GoogleMapsLoaderProps {
  children: ReactNode
}

// Enhanced Safari detection with privacy feature checks
const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua) || /iphone|ipad|ipod/i.test(ua)
  
  // Additional checks for Safari-specific features
  const hasSafariFeatures = 'safari' in window || 
    ((window as any).webkit && (window as any).webkit.messageHandlers)
  
  return isSafariBrowser || hasSafariFeatures
}

// Detect iOS Safari separately (more aggressive privacy restrictions)
const isIOSSafari = (): boolean => {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)
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

// Enhanced check for Google Maps API readiness - verifies window.google exists
const isGoogleMapsReady = (): boolean => {
  if (typeof window === 'undefined') return false
  const win = window as Record<string, any>
  
  // Critical: Check that window.google exists as a defined variable (not undefined)
  if (!win['google'] || typeof win['google'] === 'undefined') {
    return false
  }
  
  // Check for google.maps and essential classes
  const hasGoogleMaps = !!win['google']?.maps
  const hasMapClass = !!win['google']?.maps?.Map
  const hasMarkerClass = !!win['google']?.maps?.Marker
  const hasInfoWindowClass = !!win['google']?.maps?.InfoWindow
  
  return hasGoogleMaps && hasMapClass && hasMarkerClass && hasInfoWindowClass
}

// Manual script injection fallback for Safari when LoadScript fails
const injectGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (isGoogleMapsReady()) {
      resolve()
      return
    }

    // Remove any existing script tags
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]')
    existingScripts.forEach(script => script.remove())

    // Reset window.google if it exists but is incomplete
    if (typeof window !== 'undefined') {
      const win = window as Record<string, any>
      if (win['google'] && !win['google']?.maps) {
        delete win['google']
      }
    }

    // Create new script element
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true

    // Safari-specific: Use longer timeout
    const safariTimeout = isSafari() ? 15000 : 8000
    const isIOS = isIOSSafari()

    const timeout = setTimeout(() => {
      reject(new Error('Google Maps script load timeout'))
    }, safariTimeout)

    script.onload = () => {
      clearTimeout(timeout)
      
      // Safari: Wait longer for the global to be set
      const waitForGlobal = (attempts = 0, maxAttempts = isIOS ? 100 : 80) => {
        if (isGoogleMapsReady()) {
          resolve()
          return
        }
        
        if (attempts < maxAttempts) {
          setTimeout(() => waitForGlobal(attempts + 1, maxAttempts), isIOS ? 300 : 200)
        } else {
          reject(new Error('Google Maps global object not available after script load'))
        }
      }
      
      // Start checking after initial delay (longer for Safari/iOS)
      setTimeout(() => waitForGlobal(), isIOS ? 2000 : 1000)
    }

    script.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Google Maps script failed to load'))
    }

    document.head.appendChild(script)
  })
}

export const GoogleMapsLoader = ({ children }: GoogleMapsLoaderProps) => {
  const [isReady, setIsReady] = useState(() => {
    // Check if already loaded and ready
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
  const iosSafariMode = isIOSSafari()

  // Safari needs longer delays and more retries (even more aggressive for iOS)
  const getRetryConfig = () => {
    if (iosSafariMode) {
      return {
        maxAttempts: 100, // iOS Safari needs most attempts (100 * 600ms = 60 seconds max)
        checkInterval: 600, // Check every 600ms for iOS Safari
        initialDelay: 4000, // Wait 4 seconds before first check in iOS Safari
        finalRetryDelay: 10000, // Final retry after 10 seconds in iOS Safari
      }
    }
    if (safariMode) {
      return {
        maxAttempts: 80, // Safari needs more attempts (80 * 600ms = 48 seconds max)
        checkInterval: 600, // Check every 600ms for Safari
        initialDelay: 3000, // Wait 3 seconds before first check in Safari
        finalRetryDelay: 8000, // Final retry after 8 seconds in Safari
      }
    }
    return {
      maxAttempts: 40,
      checkInterval: 300,
      initialDelay: 1000,
      finalRetryDelay: 3000,
    }
  }

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
    // If already ready, nothing to do
    if (isReady) return

    const config = getRetryConfig()

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
      }, config.checkInterval)
      
      return cleanup
    }

    // Check periodically if maps loaded (in case script loads asynchronously)
    setIsLoading(true)
    checkIntervalRef.current = setInterval(() => {
      if (isGoogleMapsReady()) {
        setIsReady(true)
        setIsLoading(false)
        cleanup()
      }
    }, config.checkInterval)
    
    return cleanup
  }, [isReady])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [])

  const handleRetry = () => {
    setError(null)
    setIsReady(false)
    setIsLoading(true)
    scriptLoadingRef.current = false
    cleanup()
    // Force reload by removing script tag if it exists
    const scripts = document.getElementsByTagName('script')
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].src.includes('maps.googleapis.com')) {
        scripts[i].remove()
      }
    }
    // Reset window.google to force reload
    if (typeof window !== 'undefined') {
      const win = window as Record<string, any>
      if (win['google']) {
        delete win['google']
      }
    }
  }

  const handleManualLoad = async () => {
    if (!GOOGLE_MAPS_API_KEY) return
    
    setError(null)
    setIsLoading(true)
    scriptLoadingRef.current = true
    
    try {
      await injectGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      setIsReady(true)
      setIsLoading(false)
      scriptLoadingRef.current = false
      console.log('✅ Google Maps API loaded via manual injection' + (safariMode ? ' (Safari)' : ''))
    } catch (err: any) {
      console.error('Manual Google Maps load failed:', err)
      setIsLoading(false)
      scriptLoadingRef.current = false
      setError(
        safariMode
          ? 'Manual script injection failed. Safari\'s privacy settings are likely blocking Google Maps. Please disable "Prevent Cross-Site Tracking" in Safari Settings → Privacy.'
          : 'Manual script injection failed. Please check your internet connection and API key.'
      )
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

  // If maps already loaded and ready, render children directly
  if (isReady && isGoogleMapsReady()) {
    return <>{children}</>
  }

  // Show error state with improved Safari guidance
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
          <div style={{ 
            margin: '0 0 20px 0', 
            fontSize: '0.85rem', 
            textAlign: 'left',
            backgroundColor: '#fff3cd',
            padding: '15px',
            borderRadius: '4px',
            border: '1px solid #ffc107'
          }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Safari Privacy Settings Fix:</p>
            {iosSafariMode ? (
              <ol style={{ margin: '0', paddingLeft: '20px' }}>
                <li>Open <strong>Settings</strong> app on your iPhone/iPad</li>
                <li>Go to <strong>Safari</strong></li>
                <li>Scroll to <strong>Privacy & Security</strong></li>
                <li>Disable <strong>"Prevent Cross-Site Tracking"</strong></li>
                <li>Enable <strong>"Block All Cookies"</strong> → Set to <strong>"Allow from Websites I Visit"</strong></li>
                <li>Return to Safari and refresh this page</li>
              </ol>
            ) : (
              <ol style={{ margin: '0', paddingLeft: '20px' }}>
                <li>Open <strong>Safari</strong> menu → <strong>Settings</strong> (or Preferences)</li>
                <li>Click the <strong>Privacy</strong> tab</li>
                <li>Uncheck <strong>"Prevent Cross-Site Tracking"</strong></li>
                <li>Set <strong>"Cookies and website data"</strong> to <strong>"Allow from websites I visit"</strong></li>
                <li>Close Settings and refresh this page</li>
              </ol>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
            Retry with LoadScript
          </button>
          <button
            onClick={handleManualLoad}
            style={{
              padding: '10px 20px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}
          >
            Try Manual Load
          </button>
        </div>
      </div>
    )
  }

  // If script is already loading or loaded, wait for it
  if (scriptLoadingRef.current || isScriptLoaded()) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        {isLoading && (
          <div>
            <p>Loading Google Maps...</p>
            {safariMode && (
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '10px' }}>
                <p>Safari detected: Loading may take longer due to privacy settings.</p>
                {iosSafariMode && (
                  <p style={{ marginTop: '5px', fontStyle: 'italic' }}>
                    iOS Safari: If loading takes too long, try adjusting privacy settings in Settings → Safari
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Mark as loading and create LoadScript instance
  scriptLoadingRef.current = true
  setIsLoading(true)

  const config = getRetryConfig()

  // Use LoadScript to load the API
  return (
    <LoadScript 
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      loadingElement={
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Loading Google Maps...</p>
          {safariMode && (
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '10px' }}>
              <p>Safari detected: This may take longer than usual due to privacy settings.</p>
              {iosSafariMode && (
                <p style={{ marginTop: '5px', fontStyle: 'italic' }}>
                  iOS Safari: Consider disabling "Prevent Cross-Site Tracking" if loading fails
                </p>
              )}
            </div>
          )}
        </div>
      }
      onLoad={() => {
        // Safari-specific: Wait longer before checking
        const checkReady = (attempt = 0) => {
          // First check if google object exists at all
          const win = window as Record<string, any>
          if (!win['google'] || typeof win['google'] === 'undefined') {
            // Google object not ready yet, keep checking
            if (attempt < config.maxAttempts) {
              retryTimeoutRef.current = setTimeout(() => checkReady(attempt + 1), config.checkInterval)
              return
            } else {
              // Max attempts reached, google still not available
              console.warn('⚠️ LoadScript onLoad fired but window.google not available after multiple attempts' + (safariMode ? ' (Safari)' : '') + (iosSafariMode ? ' [iOS]' : ''))
              scriptLoadingRef.current = false
              setIsLoading(false)
              setError(
                safariMode 
                  ? 'Google Maps API failed to initialize in Safari. This is likely due to Safari\'s privacy settings blocking cross-site scripts. Try disabling "Prevent Cross-Site Tracking" in Safari Settings → Privacy, or use the "Try Manual Load" button below.'
                  : 'Google Maps API failed to initialize. Please check your API key and network connection.'
              )
              // Final retry after longer delay
              retryTimeoutRef.current = setTimeout(() => {
                if (isGoogleMapsReady()) {
                  scriptLoadingRef.current = false
                  setIsReady(true)
                  setIsLoading(false)
                  setError(null)
                  console.log('✅ Google Maps API loaded (delayed)' + (safariMode ? ' (Safari)' : '') + (iosSafariMode ? ' [iOS]' : ''))
                }
              }, config.finalRetryDelay)
              return
            }
          }
          
          // Google object exists, now check if maps API is ready
          if (isGoogleMapsReady()) {
            scriptLoadingRef.current = false
            setIsReady(true)
            setIsLoading(false)
            console.log('✅ Google Maps API loaded successfully' + (safariMode ? ' (Safari)' : '') + (iosSafariMode ? ' [iOS]' : ''))
            return
          }
          
          if (attempt < config.maxAttempts) {
            retryTimeoutRef.current = setTimeout(() => checkReady(attempt + 1), config.checkInterval)
          } else {
            console.warn('⚠️ LoadScript onLoad fired but window.google.maps not available after multiple attempts' + (safariMode ? ' (Safari)' : '') + (iosSafariMode ? ' [iOS]' : ''))
            scriptLoadingRef.current = false
            setIsLoading(false)
            setError(
              safariMode 
                ? 'Google Maps API failed to initialize in Safari. This is likely due to Safari\'s privacy settings blocking cross-site scripts. Try disabling "Prevent Cross-Site Tracking" in Safari Settings → Privacy, or use the "Try Manual Load" button below.'
                : 'Google Maps API failed to initialize. Please check your API key and network connection.'
            )
            // Final retry after longer delay
            retryTimeoutRef.current = setTimeout(() => {
              if (isGoogleMapsReady()) {
                scriptLoadingRef.current = false
                setIsReady(true)
                setIsLoading(false)
                setError(null)
                console.log('✅ Google Maps API loaded (delayed)' + (safariMode ? ' (Safari)' : '') + (iosSafariMode ? ' [iOS]' : ''))
              }
            }, config.finalRetryDelay)
          }
        }
        
        // Start checking after initial delay (longer for Safari)
        retryTimeoutRef.current = setTimeout(() => checkReady(), config.initialDelay)
      }}
      onError={(error) => {
        scriptLoadingRef.current = false
        setIsLoading(false)
        console.error('❌ Google Maps load error:', error)
        
        // If script already exists, check if it's ready
        if (isScriptLoaded()) {
          retryTimeoutRef.current = setTimeout(() => {
            if (isGoogleMapsReady()) {
              scriptLoadingRef.current = false
              setIsReady(true)
              setIsLoading(false)
              setError(null)
              console.log('✅ Google Maps API already loaded (recovered from error)' + (safariMode ? ' (Safari)' : '') + (iosSafariMode ? ' [iOS]' : ''))
            } else {
              // Retry loading the script after delay (longer for Safari)
              retryTimeoutRef.current = setTimeout(() => {
                handleRetry()
              }, safariMode ? (iosSafariMode ? 10000 : 8000) : 5000)
            }
          }, safariMode ? (iosSafariMode ? 3000 : 2000) : 1000)
        } else {
          // No script found, set error and allow retry
          setError(
            safariMode
              ? 'Failed to load Google Maps script in Safari. Safari\'s privacy settings may be blocking the script. Try the manual load option or adjust Safari privacy settings.'
              : 'Failed to load Google Maps script. Please check your internet connection and API key configuration.'
          )
        }
      }}
    >
      {/* Only render children when API is ready */}
      {isReady && isGoogleMapsReady() ? children : (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Loading Google Maps...</p>
          {safariMode && (
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '10px' }}>
              Safari detected: This may take longer than usual due to privacy settings
            </p>
          )}
        </div>
      )}
    </LoadScript>
  )
}
