import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import EmergencyActive from './pages/EmergencyActive'
import EmergencyResponse from './pages/EmergencyResponse'
import Contacts from './pages/Contacts'
import Donations from './pages/Donations'
import Subscriptions from './pages/Subscriptions'
import { FEATURES } from './utils/featureFlags'
import { registerServiceWorker, requestNotificationPermission, subscribeToPushNotifications, showEmergencyNotification, playEmergencySound } from './services/notifications'
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
      // Register service worker
      await registerServiceWorker()
      
      // Request notification permission and subscribe to push (only if user is logged in)
      const token = localStorage.getItem('access_token')
      if (token) {
        const permissionGranted = await requestNotificationPermission()
        if (permissionGranted) {
          // Subscribe to push notifications for background alerts
          await subscribeToPushNotifications()
        }
      }
    }

    initializeNotifications()
  }, [])

  // Listen for emergency_created socket events and show notification with sound
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    // Connect socket if not already connected
    const socket = connectSocket(token)
    
    // Handle emergency created event
    const handleEmergencyCreated = async (data: any) => {
      try {
        // Get current user ID
        const currentUserId = getCurrentUserId()
        
        // Don't notify if user is the sender
        if (currentUserId && data.userId && String(currentUserId) === String(data.userId)) {
          console.log('⚠️ User is the sender - skipping notification and sound')
          return
        }

        // Get sender name from data
        const senderName = data.senderName || data.senderEmail || 'Someone'
        
        // Show notification with sound
        await showEmergencyNotification(
          '🚨 Emergency Alert',
          `${senderName} needs help!`,
          data.emergencyId,
          senderName
        )
        
        // Ensure sound plays (showEmergencyNotification already calls playEmergencySound, but ensure it)
        playEmergencySound()
        
        console.log('🔔 Emergency notification and sound triggered:', {
          emergencyId: data.emergencyId,
          senderName
        })
      } catch (error) {
        console.error('Error handling emergency created event:', error)
      }
    }

    // Set up listener
    onEmergencyCreated(handleEmergencyCreated)

    // Cleanup
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
        {FEATURES.donations && <Route path="/donations" element={<ProtectedRoute><Donations /></ProtectedRoute>} />}
        {FEATURES.subscriptions && <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />}
      </Routes>
    </Router>
  )
}

export default App






