import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, Suspense, lazy } from 'react'
import Login from './pages/Login'
import Home from './pages/Home'
import EmergencyActive from './pages/EmergencyActive'
import EmergencyResponse from './pages/EmergencyResponse'
import Contacts from './pages/Contacts'
// Lazy load Stripe pages - only loads when route is accessed (prevents Stripe initialization errors)
const Donations = lazy(() => import('./pages/Donations'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
import { FEATURES } from './utils/featureFlags'
import { registerServiceWorker, requestNotificationPermission, subscribeToPushNotifications } from './services/notifications'
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
        {FEATURES.donations && (
          <Route 
            path="/donations" 
            element={
              <ProtectedRoute>
                <Suspense fallback={<div className="loading" style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
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
                <Suspense fallback={<div className="loading" style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
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






