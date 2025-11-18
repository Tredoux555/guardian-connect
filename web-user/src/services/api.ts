import axios from 'axios'

// Auto-detect API URL based on current hostname
// If accessed from network IP (e.g., 192.168.1.3:3003), use same IP for API
// If accessed from ngrok (HTTPS), use network IP for backend (HTTP)
// If accessed from localhost, use localhost for API
const getApiBaseUrl = (): string => {
  // Use explicit VITE_API_URL if set (and not localhost)
  if (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Auto-detect: if we're on a network IP, use that IP for API
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = '3001'; // Backend port
  const networkIP = '192.168.1.3'; // Server's network IP
  
  // If accessed via ngrok (HTTPS), backend is still on network IP (HTTP)
  if (hostname.includes('.ngrok.io') || hostname.includes('.ngrok-free.app') || hostname.includes('.ngrok.app')) {
    // Frontend is HTTPS via ngrok, but backend is still HTTP on network
    return `http://${networkIP}:${port}/api`;
  }
  
  // If hostname is an IP address (network access), use it
  // BUT: If the hostname is the phone's IP (192.168.1.14), use the server's IP (192.168.1.3)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    // If accessing from phone's IP, use server's IP for backend
    if (hostname === '192.168.1.14') {
      return `${protocol}//${networkIP}:${port}/api`;
    }
    return `${protocol}//${hostname}:${port}/api`;
  }
  
  // Otherwise use localhost (development)
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

// Only log API URL in development
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL)
  console.log('Environment VITE_API_URL:', import.meta.env.VITE_API_URL)
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout (increased from 10)
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Don't set Content-Type for FormData - let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  // Only log API requests in development
  if (import.meta.env.DEV) {
    console.log('API Request:', config.method?.toUpperCase(), config.url)
  }
  return config
}, (error) => {
  console.error('Request interceptor error:', error)
  return Promise.reject(error)
})

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => {
    // Only log API responses in development
    if (import.meta.env.DEV) {
      console.log('API Response:', response.status, response.config.url)
    }
    return response
  },
  async (error) => {
    // Only log API errors in development (or for critical errors)
    if (import.meta.env.DEV || error.response?.status >= 500) {
      console.error('API Error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: error.config?.url,
        timeout: error.code === 'ECONNABORTED'
      })
    }
    
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })
          localStorage.setItem('access_token', response.data.accessToken)
          // Retry original request
          return api.request(error.config)
        } catch (refreshError) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      } else {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api


