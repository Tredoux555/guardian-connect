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
        // Simple check - if LoadScript says it loaded, verify and set ready
        const checkReady = () => {
          if (isGoogleMapsReady()) {
            setIsReady(true)
            console.log('✅ Google Maps API loaded successfully')
          } else {
            // Retry once after a short delay
            setTimeout(() => {
              if (isGoogleMapsReady()) {
                setIsReady(true)
                console.log('✅ Google Maps API loaded (delayed)')
              } else {
                console.warn('⚠️ Google Maps API not ready after onLoad')
              }
            }, 1000)
          }
        }
        checkReady()
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
