import { useState, useEffect, ReactNode, useRef } from 'react'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

interface GoogleMapsLoaderProps {
  children: ReactNode
}

// Check if Google Maps script is already in the DOM
const isScriptLoaded = (): boolean => {
  if (typeof window === 'undefined') return false
  // Use bracket notation to avoid TypeScript global declaration conflicts
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

// Check if Google Maps API is actually ready with all required classes
const isGoogleMapsReady = (): boolean => {
  if (typeof window === 'undefined') return false
  // Use bracket notation to avoid TypeScript global declaration conflicts
  const win = window as Record<string, any>
  // Check for google.maps and the Map class (required for GoogleMap component)
  return !!(win['google']?.maps && win['google']?.maps?.Map)
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

    // PRIMARY METHOD: Manual script injection (works best, especially on mobile)
    if (!isScriptLoaded() && !scriptLoadingRef.current && GOOGLE_MAPS_API_KEY) {
      console.log('🔍 Injecting Google Maps script manually...')
      setIsLoading(true)
      scriptLoadingRef.current = true
      
      // Check if script already exists
      const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]')
      if (existingScripts.length === 0) {
        // Inject script manually
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`
        script.async = true
        script.defer = true
        script.onload = () => {
          console.log('✅ Google Maps script loaded manually')
          // Wait for initialization
          const checkReady = (attempt = 0, maxAttempts = 50) => {
            if (isGoogleMapsReady()) {
              scriptLoadingRef.current = false
              setIsReady(true)
              setIsLoading(false)
              cleanup()
              console.log('✅ Google Maps API ready (manual injection)')
              return
            }
            if (attempt < maxAttempts) {
              retryTimeoutRef.current = setTimeout(() => checkReady(attempt + 1, maxAttempts), 300)
            } else {
              scriptLoadingRef.current = false
              setIsLoading(false)
              console.warn('⚠️ Manual script injection: window.google.maps not available after multiple attempts')
              setError('Google Maps API failed to initialize after manual injection.')
            }
          }
          retryTimeoutRef.current = setTimeout(() => checkReady(), 1000)
        }
        script.onerror = (e) => {
          console.error('❌ Manual Google Maps script load error:', e)
          scriptLoadingRef.current = false
          setIsLoading(false)
          setError('Failed to load Google Maps script manually. Check API key and network.')
        }
        document.head.appendChild(script)
        return cleanup
      }
    }

    // Fallback: Check periodically if maps loaded (in case script loads asynchronously by other means)
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

  // Show error state
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

  // Show loading state
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p>Loading Google Maps...</p>
    </div>
  )
}