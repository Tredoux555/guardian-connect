import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import './Home.css'

function Home() {
  const navigate = useNavigate()
  const [activeEmergency, setActiveEmergency] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [pendingEmergencies, setPendingEmergencies] = useState<any[]>([])

  const loadUser = async () => {
    try {
      // Get user info from token (simplified - in real app, decode JWT or call /api/user/me)
      const token = localStorage.getItem('access_token')
      if (token) {
        // For now, just set a placeholder
        setUser({ email: 'user@example.com' })
      }
    } catch (err) {
      console.error('Failed to load user:', err)
    }
  }

  const checkPendingEmergencies = async () => {
    try {
      const response = await api.get('/emergencies/pending')
      setPendingEmergencies(response.data)
    } catch (err) {
      console.error('Failed to check pending emergencies:', err)
    }
  }

  const checkActiveEmergency = async () => {
    try {
      const response = await api.get('/emergencies/active')
      if (response.data.emergency) {
        setActiveEmergency(response.data.emergency)
      }
    } catch (err) {
      console.error('Failed to check active emergency:', err)
    }
  }

  useEffect(() => {
    loadUser()
    checkActiveEmergency()
    checkPendingEmergencies()
    const interval = setInterval(() => {
      checkActiveEmergency()
      checkPendingEmergencies()
    }, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    navigate('/login')
  }

  const triggerEmergency = async () => {
    if (!confirm('Trigger emergency? This will alert all your emergency contacts.')) {
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/emergencies/create', {})
      const emergencyId = response.data.emergency.id
      
      // Immediately share location when emergency is created
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await api.post(`/emergencies/${emergencyId}/location`, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              })
            } catch (err) {
              console.error('Failed to share initial location:', err)
            }
          },
          () => {
            // Location permission denied - still navigate to emergency
          }
        )
      }
      
      setActiveEmergency(response.data.emergency)
      navigate(`/emergency/${emergencyId}`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to trigger emergency')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Guardian Connect</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/contacts')}>Contacts</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="home-main">
        {pendingEmergencies.length > 0 && (
          <div className="pending-emergencies">
            <h2>⚠️ Pending Emergency Alerts</h2>
            {pendingEmergencies.map((emergency: any) => (
              <div key={emergency.id} className="pending-emergency-card">
                <p><strong>{emergency.sender_email}</strong> needs help!</p>
                <button onClick={() => navigate(`/respond/${emergency.id}`)}>
                  Respond Now
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="emergency-section">
          <h2>Emergency Alert</h2>
          <p className="subtitle">Click the button to trigger an emergency</p>
          
          {activeEmergency ? (
            <div className="active-emergency">
              <p>Emergency Active!</p>
              <button onClick={() => navigate(`/emergency/${activeEmergency.id}`)}>
                View Emergency
              </button>
            </div>
          ) : (
            <button
              className="emergency-button"
              onClick={triggerEmergency}
              disabled={loading}
            >
              {loading ? 'Triggering...' : '🚨 EMERGENCY'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default Home

