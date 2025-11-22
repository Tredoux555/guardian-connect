import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import './Profile.css'

interface User {
  id: string
  email: string
  display_name: string | null
}

function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      setError(null)
      const response = await api.get('/user/me')
      setUser(response.data.user)
    } catch (err: any) {
      console.error('Failed to load user profile:', err)
      setError(err.response?.data?.error || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(`${label} copied to clipboard!`)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      setCopySuccess('Failed to copy. Please select and copy manually.')
      setTimeout(() => setCopySuccess(null), 2000)
    }
  }

  const copyEmail = () => {
    if (user?.email) {
      copyToClipboard(user.email, 'Email')
    }
  }

  const copyProfileInfo = () => {
    if (user) {
      const profileInfo = `${user.display_name || user.email}\n${user.email}`
      copyToClipboard(profileInfo, 'Profile info')
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading">Loading profile...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="error-container">
          <h1>My Profile</h1>
          <div className="error-message">
            <p>Error loading profile: {error}</p>
            <button onClick={loadUserProfile}>Try Again</button>
          </div>
          <div className="profile-actions">
            <button onClick={() => navigate('/')}>Back to Home</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>My Profile</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/')}>Home</button>
          <button onClick={() => navigate('/contacts')}>Contacts</button>
        </div>
      </header>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-info">
            <div className="profile-field">
              <label>Display Name:</label>
              <div className="field-value">
                {user?.display_name || 'Not set'}
              </div>
            </div>

            <div className="profile-field">
              <label>Email Address:</label>
              <div className="field-value">
                {user?.email}
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button
              onClick={copyEmail}
              className="copy-button"
            >
              📋 Copy Email
            </button>
            <button
              onClick={copyProfileInfo}
              className="copy-button"
            >
              📋 Copy Profile Info
            </button>
          </div>

          {copySuccess && (
            <div className="copy-success">
              {copySuccess}
            </div>
          )}

          <div className="profile-note">
            <p>
              <strong>Use this information when adding emergency contacts.</strong> Share your email address with people you want to connect with.
              Your display name is shown in emergency alerts instead of your email for privacy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
