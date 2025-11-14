import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests (except public endpoints)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  // Don't add token to public auth endpoints
  if (token && !config.url?.includes('/auth/register') && !config.url?.includes('/auth/login')) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

