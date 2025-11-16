import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import './Dashboard.css'

function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeEmergencies: 0,
    responseRate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await api.get('/admin/analytics', { timeout: 5000 })
      setStats(response.data)
    } catch (err: any) {
      console.error('Failed to load stats:', err)
      if (err.response?.status === 401 || err.response?.status === 403) {
        // Token expired or invalid - redirect to login
        localStorage.removeItem('admin_token')
        window.location.href = '/login'
        return
      }
      // If analytics fails (timeout, network error, etc.), set default stats and continue
      setStats({
        totalUsers: 0,
        activeEmergencies: 0,
        responseRate: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    navigate('/login')
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Guardian Connect Admin</h1>
        <button onClick={handleLogout}>Logout</button>
      </header>
      <nav className="dashboard-nav">
        <button onClick={() => navigate('/users')}>Users</button>
        <button onClick={() => navigate('/register-user')}>Register User</button>
        <button onClick={() => navigate('/messaging')}>Messaging</button>
      </nav>
      <main className="dashboard-content">
        <div className="stats-grid">
          <div className="stat-card">
            <h2>Total Users</h2>
            <p className="stat-value">{stats.totalUsers}</p>
          </div>
          <div className="stat-card">
            <h2>Active Emergencies</h2>
            <p className="stat-value">{stats.activeEmergencies}</p>
          </div>
          <div className="stat-card">
            <h2>Response Rate</h2>
            <p className="stat-value">{stats.responseRate}%</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard

