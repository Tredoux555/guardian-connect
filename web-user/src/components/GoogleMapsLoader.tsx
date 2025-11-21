import { useState, useEffect, ReactNode } from 'react'
import { LoadScript } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

interface GoogleMapsLoaderProps {
  children: ReactNode
}

// Global state to track if maps are loaded
let mapsLoaded = false
let scriptLoading = false

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

// Check if Google Maps API is actually ready
const isGoogleMapsReady = (): boolean => {
  if (typeof window === 'undefined') return false
  // Use bracket notation to avoid TypeScript global declaration conflicts
  const win = window as Record<string, any>
  return !!win['google']?.maps
}

export const GoogleMapsLoader = ({ children }: GoogleMapsLoaderProps) => {
  const [isReady, setIsReady] = useState(() => {
    // Check if already loaded and ready
    if (isGoogleMapsReady()) {
      mapsLoaded = true
      return true
    }
    return false
  })

  useEffect(() => {
    // If already ready, nothing to do
    if (isReady) return

    // If script is already loading or loaded, check periodically
    if (scriptLoading || isScriptLoaded()) {
      const checkInterval = setInterval(() => {
        if (isGoogleMapsReady()) {
          mapsLoaded = true
          scriptLoading = false
          setIsReady(true)
          clearInterval(checkInterval)
        }
      }, 200)
      
      return () => clearInterval(checkInterval)
    }

    // Check periodically if maps loaded (in case script loads asynchronously)
    const checkInterval = setInterval(() => {
      if (isGoogleMapsReady()) {
        mapsLoaded = true
        setIsReady(true)
        clearInterval(checkInterval)
      }
    }, 100)
    
    return () => clearInterval(checkInterval)
  }, [isReady])

  if (!GOOGLE_MAPS_API_KEY) {
    return <>{children}</>
  }

  // If maps already loaded and ready, render children directly
  if (isReady && isGoogleMapsReady()) {
    return <>{children}</>
  }

  // If script is already loading or loaded, wait for it
  if (scriptLoading || isScriptLoaded()) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Google Maps...</div>
  }

  // Mark as loading and create LoadScript instance
  scriptLoading = true

  // Use LoadScript to load the API
  return (
    <LoadScript 
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      loadingElement={<div style={{ padding: '20px', textAlign: 'center' }}>Loading Google Maps...</div>}
      onLoad={() => {
        // Wait longer and check multiple times to ensure google.maps is fully initialized
        const checkReady = (attempt = 0, maxAttempts = 20) => {
          if (isGoogleMapsReady()) {
            // Double-check that Marker class is available
            const win = window as Record<string, any>
            if (win['google']?.maps?.Marker || win['google']?.maps?.marker?.AdvancedMarkerElement) {
              mapsLoaded = true
              scriptLoading = false
              setIsReady(true)
              console.log('✅ Google Maps API loaded successfully')
              return
            }
          }
          
          if (attempt < maxAttempts) {
            setTimeout(() => checkReady(attempt + 1, maxAttempts), 200)
          } else {
            console.warn('⚠️ LoadScript onLoad fired but window.google.maps not available after multiple attempts')
            scriptLoading = false
            // Final retry after longer delay
            setTimeout(() => {
              if (isGoogleMapsReady()) {
                mapsLoaded = true
                setIsReady(true)
                console.log('✅ Google Maps API loaded (delayed)')
              }
            }, 2000)
          }
        }
        
        // Start checking after initial delay
        setTimeout(() => checkReady(), 500)
      }}
      onError={(error) => {
        scriptLoading = false
        console.error('❌ Google Maps load error:', error)
        // If script already exists, check if it's ready
        if (isScriptLoaded()) {
          setTimeout(() => {
            if (isGoogleMapsReady()) {
              mapsLoaded = true
              setIsReady(true)
              console.log('✅ Google Maps API already loaded (recovered from error)')
            }
          }, 1000)
        }
      }}
    >
      {/* Only render children when API is ready */}
      {isReady && isGoogleMapsReady() ? children : (
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading Google Maps...</div>
      )}
    </LoadScript>
  )
}
