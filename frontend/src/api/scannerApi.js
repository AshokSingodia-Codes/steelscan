import axios from 'axios'
import { useScannerStore } from '../store/scannerStore'

// =====================================================
// BACKEND API BASE URL
// =====================================================
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000'

const ACCESS_TOKEN_KEY = 'steelscan_auth_token'
const REFRESH_TOKEN_KEY = 'steelscan_refresh_token'
const USER_KEY = 'steelscan_auth_user'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

function clearScannerForAccountSwitch() {
  try {
    useScannerStore.getState().clearScannerForNewSession()
  } catch {
    // ignore cleanup errors
  }
}

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor: 401 Refresh Token Handling
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (!error.response) {
      error.isNetworkError = true
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        error.friendlyMessage = 'Server is waking up, please retry in a moment.'
      } else {
        error.friendlyMessage = 'Server is waking up, please retry.'
      }
      return Promise.reject(error)
    }

    if (error.response.status === 429) {
      error.isOcrBusy = true
    }

    const isLoginPage = window.location.pathname.includes('/login')

    if (error.response.status === 401 && !originalRequest._retry && !isLoginPage) {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

      if (!refreshToken) {
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        clearScannerForAccountSwitch()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })

        const { access_token, refresh_token: newRefreshToken } = response.data

        localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
        if (newRefreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)
        }

        apiClient.defaults.headers.common.Authorization = `Bearer ${access_token}`
        processQueue(null, access_token)

        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return apiClient(originalRequest)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        clearScannerForAccountSwitch()
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export const scannerApi = {
  login: async ({ username, password }) => {
    const response = await apiClient.post('/auth/login', {
      username,
      password,
    })
    return response.data
  },

  refreshToken: async (refreshToken) => {
    const response = await apiClient.post('/auth/refresh', {
      refresh_token: refreshToken,
    })
    return response.data
  },

  me: async () => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    const response = await apiClient.patch('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return response.data
  },

  getUsers: async () => {
    const response = await apiClient.get('/auth/users')
    return response.data
  },

  createUser: async (data) => {
    const response = await apiClient.post('/auth/users', data)
    return response.data
  },

  updateUserStatus: async ({ userId, isActive }) => {
    const response = await apiClient.patch(`/auth/users/${userId}/status`, {
      is_active: isActive,
    })
    return response.data
  },

  updateUserDetails: async ({ userId, full_name, email, role }) => {
    const response = await apiClient.patch(`/auth/users/${userId}`, {
      full_name,
      email,
      role,
    })
    return response.data
  },

  resetUserPassword: async ({ userId, newPassword, forceChange = true }) => {
    const response = await apiClient.patch(`/auth/users/${userId}/password`, {
      new_password: newPassword,
      force_change: forceChange,
    })
    return response.data
  },

  scan: async (imageFile) => {
    const formData = new FormData()
    formData.append('file', imageFile)

    const response = await apiClient.post('/scan', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  uploadRecordsCsv: async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post('/admin/upload-records', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  getRecords: async () => {
    const response = await apiClient.get('/records')
    return response.data
  },

  saveRecord: async (data) => {
    const response = await apiClient.post('/records', data)
    return response.data
  },

  deleteRecord: async (id) => {
    const response = await apiClient.delete(`/records/${id}`)
    return response.data
  },

  deleteRecordsByMonth: async ({ year, month }) => {
    const response = await apiClient.delete('/records/month', {
      params: { year, month },
    })
    return response.data
  },

  deleteRecordsByDate: async ({ date }) => {
    const response = await apiClient.delete('/records/date', {
      params: { date },
    })
    return response.data
  },

  ping: async () => {
    try {
      const response = await axios.get(`${BASE_URL}/health`, { timeout: 3000 })
      return response.status === 200
    } catch {
      return false
    }
  },
}

export default scannerApi