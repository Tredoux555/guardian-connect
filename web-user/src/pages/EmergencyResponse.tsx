import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import './EmergencyResponse.css'

function EmergencyResponse() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [senderName, setSenderName] = useState('Someone')

  useEffect(() => {
    // Load emergency details to get sender name
    loadEmergency()
  }, [id])

  const loadEmergency = async () => {
    try {
      const response = await api.get(`/emergencies/${id}`)
      // Get sender name from emergency
      setSenderName('Emergency Contact')
    } catch (err) {
      console.error('Failed to load emergency:', err)
    }
  }

  const acceptEmergency = async () => {
    setLoading(true)
    try {
      await api.post(`/emergencies/${id}/accept`, {})
      
      // Request location permission and share location BEFORE navigating
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                await api.post(`/emergencies/${id}/location`, {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                })
                console.log('✅ Responder location shared:', {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                })
                // Small delay to ensure location is saved
                setTimeout(() => resolve(), 500)
              } catch (err) {
                console.error('Failed to share location:', err)
                resolve() // Continue even if location sharing fails
              }
            },
            (error) => {
              console.warn('Location permission denied:', error)
              resolve() // Continue even if location permission denied
            }
          )
        })
      }
      
      // Navigate after location is shared (or if geolocation is not available)
      navigate(`/emergency/${id}`)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to accept emergency')
    } finally {
      setLoading(false)
    }
  }

  const rejectEmergency = async () => {
    if (!confirm('Mark yourself as unavailable for this emergency?')) return

    setLoading(true)
    try {
      await api.post(`/emergencies/${id}/reject`, {})
      alert('You have been marked as unavailable.')
      navigate('/')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject emergency')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="emergency-response">
      <div className="response-container">
        <div className="emergency-icon">🚨</div>
        <h1>Emergency Alert</h1>
        <p className="sender-name">{senderName} needs help!</p>

        <div className="response-buttons">
          <button
            className="accept-button"
            onClick={acceptEmergency}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'I CAN HELP'}
          </button>
          <button
            className="reject-button"
            onClick={rejectEmergency}
            disabled={loading}
          >
            UNAVAILABLE
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmergencyResponse

