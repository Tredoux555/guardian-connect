import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import EmergencyActive from './pages/EmergencyActive'
import EmergencyResponse from './pages/EmergencyResponse'
import Contacts from './pages/Contacts'
import Profile from './pages/Profile'
// Lazy load Stripe pages - only loads when route is accessed
const Donations = lazy(() => import('./pages/Donations'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
import { FEATURES } from './utils/featureFlags'
import { registerServiceWorker, requestNotificationPermission, subscribeToPushNotifications, showEmergencyNotification, playEmergencySound, stopEmergencySound } from './services/notifications'
import { connectSocket, onEmergencyCreated, removeListener } from './services/socket'
import { getCurrentUserId } from './utils/jwt'
import './App.css'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('access_token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  // Register service worker and request notification permission on app load
  useEffect(() => {
    const initializeNotifications = async () => {
      await registerServiceWorker()
      
      const token = localStorage.getItem('access_token')
      if (token) {
        const permissionGranted = await requestNotificationPermission()
        if (permissionGranted) {
          await subscribeToPushNotifications()
        }
      }
    }

    initializeNotifications()
  }, [])

  // Listen for service worker messages (notification clicks)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'EMERGENCY_NOTIFICATION_CLICKED') {
          console.log('🔔 Notification clicked - starting emergency sound')
          playEmergencySound()
        } else if (event.data && event.data.type === 'STOP_EMERGENCY_SOUND') {
          stopEmergencySound()
        }
      }

      navigator.serviceWorker.addEventListener('message', handleMessage)

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [])

  // Listen for emergency_created socket events and show notification with sound
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const socket = connectSocket(token)
    
    const handleEmergencyCreated = async (data: any) => {
      try {
        const currentUserId = getCurrentUserId()
        
        if (currentUserId && data.userId && String(currentUserId) === String(data.userId)) {
          console.log('⚠️ User is the sender - skipping notification')
          return
        }

        const senderName = data.senderName || data.senderEmail || 'Someone'
        
        await showEmergencyNotification(
          '🚨 Emergency Alert',
          `${senderName} needs help!`,
          data.emergencyId,
          senderName
        )
        
        console.log('🔔 Emergency notification triggered:', {
          emergencyId: data.emergencyId,
          senderName
        })
      } catch (error) {
        console.error('Error handling emergency created event:', error)
      }
    }

    onEmergencyCreated(handleEmergencyCreated)

    return () => {
      removeListener('emergency_created', handleEmergencyCreated)
    }
  }, [])

  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/emergency/:id" element={<ProtectedRoute><EmergencyActive /></ProtectedRoute>} />
        <Route path="/respond/:id" element={<ProtectedRoute><EmergencyResponse /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        {FEATURES.donations && (
          <Route 
            path="/donations" 
            element={
              <ProtectedRoute>
                <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
                  <Donations />
                </Suspense>
              </ProtectedRoute>
            } 
          />
        )}
        {FEATURES.subscriptions && (
          <Route 
            path="/subscriptions" 
            element={
              <ProtectedRoute>
                <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
                  <Subscriptions />
                </Suspense>
              </ProtectedRoute>
            } 
          />
        )}
      </Routes>
    </Router>
  )
}

export default App
