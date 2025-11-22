import { useState, useEffect, ReactNode } from 'react'
import { LoadScript } from '@react-google-maps/api'

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

  useEffect(() => {
    // Check periodically if maps loaded (in case it loads before LoadScript mounts)
    if (!isReady) {
      const interval = setInterval(() => {
        if (isGoogleMapsReady()) {
          setIsReady(true)
          clearInterval(interval)
        }
      }, 500)

      return () => clearInterval(interval)
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

  if (isReady) {
    return <>{children}</>
  }

  return (
    <LoadScript 
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      loadingElement={
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Loading Google Maps...</p>
        </div>
      }
      onLoad={() => {
        // Wait longer on mobile Safari - the global might not be ready immediately
        // Check multiple times to ensure google object is fully initialized
        const checkReady = (attempt = 0, maxAttempts = 20) => {
          const win = window as any
          
          // Check if google object exists AND has maps
          if (win.google && typeof win.google !== 'undefined' && win.google.maps) {
            // Double-check Map and Marker classes exist
            if (win.google.maps.Map && win.google.maps.Marker) {
              setIsReady(true)
              console.log('✅ Google Maps API loaded successfully')
              return
            }
          }
          
          if (attempt < maxAttempts) {
            setTimeout(() => checkReady(attempt + 1, maxAttempts), 300)
          } else {
            console.warn('⚠️ Google Maps API not ready after onLoad - max attempts reached')
            console.warn('Debug info:', {
              hasGoogle: !!win.google,
              googleType: typeof win.google,
              hasMaps: !!win.google?.maps,
              hasMapClass: !!win.google?.maps?.Map,
              hasMarkerClass: !!win.google?.maps?.Marker
            })
          }
        }
        
        // Start checking after a delay (longer on mobile for Safari)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        setTimeout(() => checkReady(), isMobile ? 1000 : 500)
      }}
      onError={(error) => {
        console.error('❌ Google Maps load error:', error)
      }}
    >
      {isReady ? children : (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Loading Google Maps...</p>
        </div>
      )}
    </LoadScript>
  )
}
