import axios from 'axios'

// Use localhost for local development, network IP only if explicitly set and needed
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Log API URL for debugging
console.log('API Base URL:', API_BASE_URL)
console.log('Environment VITE_API_URL:', import.meta.env.VITE_API_URL)

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
  console.log('API Request:', config.method?.toUpperCase(), config.url)
  return config
}, (error) => {
  console.error('Request interceptor error:', error)
  return Promise.reject(error)
})

// Enhanced retry logic for network reliability
const shouldRetryRequest = (error: any, retryCount: number): boolean => {
  // Don't retry more than 3 times
  if (retryCount >= 3) return false

  // Retry on network errors
  if (!error.response) {
    console.warn(`🔄 Network error (attempt ${retryCount + 1}/3):`, error.message)
    return true
  }

  // Retry on specific HTTP status codes
  const retryableStatuses = [408, 429, 500, 502, 503, 504]
  if (retryableStatuses.includes(error.response.status)) {
    console.warn(`🔄 HTTP ${error.response.status} error (attempt ${retryCount + 1}/3):`, error.config?.url)
    return true
  }

  // Retry on timeout
  if (error.code === 'ECONNABORTED') {
    console.warn(`🔄 Request timeout (attempt ${retryCount + 1}/3):`, error.config?.url)
    return true
  }

  return false
}

const calculateRetryDelay = (retryCount: number): number => {
  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, retryCount), 4000)
}

// Handle token refresh on 401 and add retry logic
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url)
    return response
  },
  async (error) => {
    console.error('API Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      url: error.config?.url,
      timeout: error.code === 'ECONNABORTED'
    })

    // Handle 401 (token refresh) - don't retry this
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })
          localStorage.setItem('access_token', response.data.accessToken)
          // Retry original request once after token refresh
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

    // Add retry logic for emergency operations and network issues
    const isEmergencyOperation = error.config?.url?.includes('/emergenc')
    const retryCount = (error.config?.retryCount || 0)

    if ((isEmergencyOperation || shouldRetryRequest(error, retryCount)) && retryCount < 3) {
      const delay = calculateRetryDelay(retryCount)

      console.log(`⏳ Retrying ${error.config.method?.toUpperCase()} ${error.config.url} in ${delay}ms (attempt ${retryCount + 1}/3)`)

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, delay))

      // Increment retry count and retry
      error.config.retryCount = retryCount + 1
      return api.request(error.config)
    }

    // If we've exhausted retries or it's not retryable, reject
    return Promise.reject(error)
  }
)

// Emergency-specific API operations with enhanced error handling
export const emergencyAPI = {
  // Accept emergency with better error handling
  acceptEmergency: async (emergencyId: string) => {
    try {
      const response = await api.post(`/emergencies/${emergencyId}/accept`, {})
      console.log('✅ Emergency accepted successfully')
      return response
    } catch (error: any) {
      console.error('❌ Failed to accept emergency:', error)

      // Provide user-friendly error messages
      if (error.response?.status === 404) {
        throw new Error('Emergency not found or has ended.')
      } else if (error.response?.status === 403) {
        throw new Error('You are not authorized to respond to this emergency.')
      } else if (error.response?.status === 409) {
        throw new Error('This emergency has already been accepted by someone else.')
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Request timed out. Please check your connection and try again.')
      } else {
        throw new Error(error.response?.data?.error || 'Failed to accept emergency. Please try again.')
      }
    }
  },

  // Share location with retry logic
  shareLocation: async (emergencyId: string, latitude: number, longitude: number, retries = 2) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`📍 Sharing location (attempt ${attempt + 1}/${retries + 1})`)
        const response = await api.post(`/emergencies/${emergencyId}/location`, {
          latitude,
          longitude,
        })
        console.log('✅ Location shared successfully')
        return response
      } catch (error: any) {
        console.warn(`⚠️ Location sharing attempt ${attempt + 1} failed:`, error.message)

        if (attempt === retries) {
          // Provide user-friendly error messages
          if (error.response?.status === 403) {
            throw new Error('You must accept the emergency before sharing your location.')
          } else if (error.response?.status === 404) {
            throw new Error('Emergency not found.')
          } else {
            throw new Error('Failed to share location. Please try again.')
          }
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 3000)
        console.log(`⏳ Retrying location share in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  },

  // Reject emergency with better error handling
  rejectEmergency: async (emergencyId: string) => {
    try {
      const response = await api.post(`/emergencies/${emergencyId}/reject`, {})
      console.log('✅ Emergency rejected successfully')
      return response
    } catch (error: any) {
      console.error('❌ Failed to reject emergency:', error)

      if (error.response?.status === 403) {
        throw new Error('You cannot reject this emergency.')
      } else if (error.response?.status === 404) {
        throw new Error('Emergency not found.')
      } else {
        throw new Error(error.response?.data?.error || 'Failed to reject emergency.')
      }
    }
  }
}

export default api


