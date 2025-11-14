import { useState, useEffect, ReactNode } from 'react'
import { LoadScript } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

interface GoogleMapsLoaderProps {
  children: ReactNode
}

// Global state to track if maps are loaded
let mapsLoaded = false

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

  // Use LoadScript to load the API
  return (
    <LoadScript 
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      loadingElement={<div style={{ padding: '20px', textAlign: 'center' }}>Loading Google Maps...</div>}
      onLoad={() => {
        // Wait a bit to ensure google.maps is fully initialized
        setTimeout(() => {
          if (isGoogleMapsReady()) {
            mapsLoaded = true
            setIsReady(true)
            console.log('✅ Google Maps API loaded successfully')
          } else {
            console.warn('⚠️ LoadScript onLoad fired but window.google.maps not available')
            // Retry after a delay
            setTimeout(() => {
              if (isGoogleMapsReady()) {
                mapsLoaded = true
                setIsReady(true)
              }
            }, 500)
          }
        }, 100)
      }}
      onError={(error) => {
        console.error('❌ Google Maps load error:', error)
        // If script already exists, check if it's ready
        if (isScriptLoaded()) {
          setTimeout(() => {
            if (isGoogleMapsReady()) {
              mapsLoaded = true
              setIsReady(true)
              console.log('✅ Google Maps API already loaded (recovered from error)')
            }
          }, 500)
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
