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
        console.log('🔍 LoadScript onLoad fired - checking script status...')
        
        // First, verify the script is actually in the DOM
        const scripts = document.querySelectorAll('script[src*="maps.googleapis.com"]')
        console.log('🔍 Script tags found:', scripts.length)
        if (scripts.length > 0) {
          scripts.forEach((script, i) => {
            const scriptEl = script as HTMLScriptElement
            const scriptAny = scriptEl as any
            console.log(`🔍 Script ${i}:`, scriptEl.src)
            console.log(`🔍 Script ${i} loaded:`, scriptEl.async || scriptAny.readyState === 'complete' || scriptAny.readyState === 'loaded')
            
            // Check for errors
            scriptEl.onerror = () => {
              console.error(`❌ Script ${i} failed to load from network!`)
              console.error('❌ This could be due to:')
              console.error('   - Network connectivity issues')
              console.error('   - CORS blocking')
              console.error('   - Safari privacy settings blocking third-party scripts')
            }
            
            scriptEl.onload = () => {
              console.log(`✅ Script ${i} onload event fired`)
            }
          })
        } else {
          console.error('❌ No Google Maps script tag found in DOM!')
          console.error('❌ LoadScript onLoad fired but script tag is missing')
        }
        
        // Check if script is being blocked by checking for network errors
        const checkNetworkStatus = () => {
          const scripts = document.querySelectorAll('script[src*="maps.googleapis.com"]')
          if (scripts.length > 0) {
            const script = scripts[0] as HTMLScriptElement
            // If script exists but google is undefined after 3 seconds, likely blocked
            setTimeout(() => {
              const win = window as any
              if (!win.google) {
                console.warn('⚠️ Script tag exists but window.google is still undefined after 3 seconds')
                console.warn('⚠️ This suggests Safari privacy settings may be blocking the global variable')
                console.warn('💡 User should check: Settings → Safari → Privacy → "Prevent Cross-Site Tracking"')
              }
            }, 3000)
          }
        }
        checkNetworkStatus()
        
        // Now check for google object with comprehensive diagnostics
        const checkReady = (attempt = 0) => {
          const win = window as any
          
          // Check if google object exists AND has maps
          if (win.google && typeof win.google !== 'undefined' && win.google.maps) {
            if (win.google.maps.Map && win.google.maps.Marker) {
              setIsReady(true)
              console.log('✅ Google Maps API loaded successfully')
              return
            }
          }
          
          // Log diagnostic info every 5 attempts
          if (attempt > 0 && attempt % 5 === 0) {
            const scriptsInDOM = document.querySelectorAll('script[src*="maps.googleapis.com"]').length
            const allGoogleScripts = Array.from(document.querySelectorAll('script'))
              .map(s => (s as HTMLScriptElement).src)
              .filter(s => s && s.includes('google'))
            
            console.warn(`⚠️ Still waiting for Google Maps API... (attempt ${attempt})`)
            console.warn('🔍 Diagnostic info:', {
              hasGoogle: !!win.google,
              googleType: typeof win.google,
              hasMaps: !!win.google?.maps,
              hasMapClass: !!win.google?.maps?.Map,
              hasMarkerClass: !!win.google?.maps?.Marker,
              scriptTagsInDOM: scriptsInDOM,
              allGoogleScripts: allGoogleScripts,
              userAgent: navigator.userAgent,
              isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent.toLowerCase())
            })
            
            // After 20 attempts (10 seconds), provide user guidance
            if (attempt >= 20) {
              console.error('❌ Google Maps API still not available after 10 seconds')
              console.error('❌ Possible causes:')
              console.error('   1. Safari privacy settings blocking cross-site tracking')
              console.error('   2. Network connectivity issues')
              console.error('   3. API key configuration problem')
              console.error('   4. Script blocked by content security policy')
            }
          }
          
          // Keep checking - don't give up (but log warnings)
          setTimeout(() => checkReady(attempt + 1), 500)
        }
        
        // Start checking after delay (longer on mobile Safari)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent.toLowerCase())
        const initialDelay = (isMobile && isSafari) ? 2000 : isMobile ? 1500 : 1000
        
        console.log(`🔍 Starting readiness check after ${initialDelay}ms delay (mobile: ${isMobile}, Safari: ${isSafari})`)
        setTimeout(() => checkReady(), initialDelay)
      }}
      onError={(error) => {
        console.error('❌ Google Maps LoadScript onError:', error)
        const scripts = document.querySelectorAll('script[src*="maps.googleapis.com"]')
        console.error('❌ Script tags in DOM:', scripts.length)
        if (scripts.length === 0) {
          console.error('❌ No script tag found - LoadScript failed to inject script')
        } else {
          console.error('❌ Script tag exists but error occurred - check network tab for details')
        }
        console.error('❌ Check Safari privacy settings - "Prevent Cross-Site Tracking" may be blocking the script')
        console.error('❌ Check browser console Network tab for failed requests to maps.googleapis.com')
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
