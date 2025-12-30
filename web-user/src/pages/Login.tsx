import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import './Login.css'

function Login() {
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('user1@example.com')
  const [password, setPassword] = useState('password123')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const navigate = useNavigate()

  // Hide splash screen after a brief moment
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegistering) {
        // Registration
        const response = await api.post('/auth/register', {
          email,
          password,
          display_name: displayName.trim() || undefined, // Only send if provided
        })
        
        if (response.data.user) {
          setError('Registration successful! Please verify your email or ask an admin to verify your account.')
          setIsRegistering(false) // Switch back to login
          setDisplayName('')
        }
      } else {
        // Login
        const response = await api.post('/auth/login', { email, password })
        
        if (response.data.accessToken && response.data.refreshToken) {
          localStorage.setItem('access_token', response.data.accessToken)
          localStorage.setItem('refresh_token', response.data.refreshToken)
          
          // Validate token works before navigating
          try {
            await api.get('/user/me')
            navigate('/')
          } catch (validationError) {
            console.error('Token validation failed:', validationError)
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            setError('Login succeeded but token validation failed. Please try again.')
          }
        } else {
          setError('Invalid response from server')
        }
      }
    } catch (err: any) {
      console.error(isRegistering ? 'Registration error:' : 'Login error:', err)
      
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Request timed out. Please check your connection and try again.')
      } else if (err.response?.status === 403) {
        setError('Please verify your email before logging in. Check the admin panel to verify your account.')
      } else if (err.response?.status === 401) {
        setError('Invalid email or password')
      } else if (err.response?.data?.error) {
        setError(err.response.data.error)
      } else if (err.message) {
        setError(`${isRegistering ? 'Registration' : 'Login'} failed: ${err.message}`)
      } else {
        setError(`${isRegistering ? 'Registration' : 'Login'} failed. Please try again.`)
      }
    } finally {
      setLoading(false)
    }
  }

  // Show splash screen
  if (showSplash) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <div className="splash-icon">🚨</div>
          <h1 className="splash-title">Guardian Connect</h1>
          <div className="splash-spinner"></div>
        </div>
      </div>
    )
  }

  // Show loading state when submitting
  if (loading) {
    return (
      <div className="login-loading">
        <div className="login-loading-content">
          <div className="login-loading-icon">🚨</div>
          <p className="login-loading-text">
            {isRegistering ? 'Registering...' : 'Logging in...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Guardian Connect</h1>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(false)
              setError('')
            }}
            style={{
              padding: '0.5rem 1rem',
              background: !isRegistering ? '#E53935' : 'transparent',
              color: !isRegistering ? 'white' : '#E53935',
              border: '1px solid #E53935',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(true)
              setError('')
            }}
            style={{
              padding: '0.5rem 1rem',
              background: isRegistering ? '#E53935' : 'transparent',
              color: isRegistering ? 'white' : '#E53935',
              border: '1px solid #E53935',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Register
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {isRegistering && (
            <input
              type="text"
              placeholder="Display Name (optional)"
              value={displayName}
              onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '') // Only allow alphanumeric
                setDisplayName(value)
              }}
              maxLength={50}
              style={{
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          )}
          {isRegistering && displayName && (
            <small style={{ color: '#666', fontSize: '0.85rem', display: 'block', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
              {displayName.length < 5 ? 'Display name should be 5-10 characters (optional)' : 'Letters and numbers only'}
            </small>
          )}
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? (isRegistering ? 'Registering...' : 'Logging in...') : (isRegistering ? 'Register' : 'Login')}
          </button>
        </form>
        {!isRegistering && (
          <div className="test-users">
            <p><strong>Test Users:</strong></p>
            <p>user1@example.com / password123</p>
            <p>user2@example.com / password123</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login


