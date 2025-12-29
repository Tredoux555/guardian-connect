import { useState, useEffect, ReactNode, useRef } from 'react'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

interface GoogleMapsLoaderProps {
  children: ReactNode
}

// Simple check if Google Maps is ready
const isGoogleMapsReady = (): boolean => {
  if (typeof window === 'undefined') return false
  const win = window as any
  return !!(win.google?.maps?.Map && win.google?.maps?.Marker)
}

export const GoogleMapsLoader = ({ children }: GoogleMapsLoaderProps) => {
  const [isReady, setIsReady] = useState(() => isGoogleMapsReady())
  const [error, setError] = useState<string | null>(null)
  const scriptInjectedRef = useRef(false)
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // If already ready, nothing to do
    if (isReady) return

    // Check if script already exists
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]')
    if (existingScripts.length > 0) {
      console.log('🔍 Google Maps script already exists in DOM, waiting for initialization...')
      // Script exists, just wait for it to initialize
      const checkReady = () => {
        if (isGoogleMapsReady()) {
          setIsReady(true)
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current)
            checkIntervalRef.current = null
          }
        }
      }
      
      // Check immediately and then periodically
      checkReady()
      checkIntervalRef.current = setInterval(checkReady, 500)
      
      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
          checkIntervalRef.current = null
        }
      }
    }

    // If no script exists and we haven't injected one, inject it
    if (!scriptInjectedRef.current && GOOGLE_MAPS_API_KEY) {
      scriptInjectedRef.current = true
      console.log('🔍 Injecting Google Maps script manually...')
      
      // Remove any existing scripts first (cleanup)
      const oldScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]')
      oldScripts.forEach(script => script.remove())
      
      // Create new script element
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`
      script.async = true
      script.defer = true
      
      // Detect Safari for longer wait times
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent.toLowerCase())
      const isIOSSafari = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase()) && /safari/i.test(navigator.userAgent.toLowerCase()) && !/chrome|crios|fxios/i.test(navigator.userAgent.toLowerCase())
      
      script.onload = () => {
        console.log('✅ Google Maps script loaded from network')
        console.log('🔍 Waiting for window.google to be initialized...')
        
        // Safari needs longer wait - the global might be delayed
        const initialDelay = isIOSSafari ? 3000 : isSafari ? 2000 : isMobile ? 1500 : 1000
        
        setTimeout(() => {
          const checkGoogle = (attempts = 0) => {
            const win = window as any
            
            if (win.google && typeof win.google !== 'undefined' && win.google.maps) {
              if (win.google.maps.Map && win.google.maps.Marker) {
                setIsReady(true)
                console.log('✅ Google Maps API ready!')
                if (checkIntervalRef.current) {
                  clearInterval(checkIntervalRef.current)
                  checkIntervalRef.current = null
                }
                return
              }
            }
            
            // Log progress every 10 attempts
            if (attempts > 0 && attempts % 10 === 0) {
              console.warn(`⚠️ Still waiting for window.google... (attempt ${attempts})`)
              console.warn('Debug:', {
                hasGoogle: !!win.google,
                googleType: typeof win.google,
                isSafari: isSafari,
                isIOSSafari: isIOSSafari
              })
            }
            
            // Keep checking - don't give up (Safari can take 30+ seconds)
            if (attempts < 200) { // 200 attempts * 500ms = 100 seconds max
              setTimeout(() => checkGoogle(attempts + 1), 500)
            } else {
              console.error('❌ Google Maps API not available after 100 seconds')
              console.error('❌ This is likely due to Safari privacy settings blocking cross-site tracking')
              console.error('💡 User should disable "Prevent Cross-Site Tracking" in Safari Settings → Privacy')
              setError('Google Maps failed to load. Safari privacy settings may be blocking it.')
            }
          }
          
          checkGoogle()
        }, initialDelay)
      }
      
      script.onerror = () => {
        console.error('❌ Failed to load Google Maps script from network')
        setError('Failed to load Google Maps script. Please check your internet connection and API key.')
        scriptInjectedRef.current = false
      }
      
      // Inject script into head
      document.head.appendChild(script)
      
      // Also set up periodic check as fallback
      checkIntervalRef.current = setInterval(() => {
        if (isGoogleMapsReady()) {
          setIsReady(true)
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current)
            checkIntervalRef.current = null
          }
        }
      }, 1000)
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
    }
  }, [isReady])

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
        <p style={{ margin: 0, fontWeight: 'bold' }}>⚠️ Google Maps API Key Missing</p>
        <p style={{ margin: '10px 0 0 0', fontSize: '0.9rem' }}>
          Please configure VITE_GOOGLE_MAPS_API_KEY in your environment variables.
        </p>
      </div>
    )
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
        <button
          onClick={() => {
            setError(null)
            scriptInjectedRef.current = false
            setIsReady(false)
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (isReady) {
    return <>{children}</>
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p>Loading Google Maps...</p>
      <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '10px' }}>
        This may take longer on Safari due to privacy settings
      </p>
    </div>
  )
}
