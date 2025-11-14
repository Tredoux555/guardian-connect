import { useState } from 'react'
import api from '../services/api'
import './RegisterUser.css'

function RegisterUser() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      // Registration is a public endpoint, so we need to call it without the admin token
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // Handle both error formats: { error: "..." } or { errors: [...] }
        let errorMessage = 'Registration failed'
        
        if (data.error) {
          errorMessage = data.error
        } else if (data.errors && Array.isArray(data.errors)) {
          errorMessage = data.errors.map((err: any) => {
            if (typeof err === 'string') return err
            if (err.msg) return err.msg
            if (err.message) return err.message
            return JSON.stringify(err)
          }).join(', ')
        } else if (data.message) {
          errorMessage = data.message
        }
        
        throw new Error(errorMessage)
      }
      
      setSuccess(`User registered successfully! Email: ${email}. Remember to verify them in the Users page.`)
      setEmail('')
      setPassword('')
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your input and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-user-page">
      <h1>Register New User</h1>
      
      <form onSubmit={handleSubmit} className="register-form">
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>

        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            minLength={8}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register User'}
        </button>
      </form>

      <div className="info-box">
        <p><strong>Note:</strong> After registration, users need to verify their email before they can log in.</p>
        <p>For testing, you can manually verify users in the database or check the email verification endpoint.</p>
      </div>
    </div>
  )
}

export default RegisterUser

