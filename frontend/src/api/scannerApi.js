import axios from 'axios'
import { useScannerStore } from '../store/scannerStore'

// =====================================================
// DIRECT BACKEND API URL
// =====================================================
// Keep cloudflared terminal running.
// If Cloudflare gives a new URL, replace only this value.
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const TOKEN_KEY = 'steelscan_auth_token'
const USER_KEY = 'steelscan_auth_user'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 600000,
})

function clearScannerForAccountSwitch() {
  try {
    useScannerStore.getState().clearScannerForNewSession()
  } catch {
    // ignore cleanup errors
  }
}

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY)

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response) => response,

  (error) => {
    if (!error.response) {
      error.isNetworkError = true
    }

    if (error.response?.status === 429) {
      error.isOcrBusy = true
    }

    const isLoginPage = window.location.pathname.includes('/login')

    if (error.response?.status === 401 && !isLoginPage) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)

      clearScannerForAccountSwitch()

      window.location.href = '/login'
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
    const response = await apiClient.patch(
      `/auth/users/${userId}/status`,
      {
        is_active: isActive,
      }
    )

    return response.data
  },

  updateUserDetails: async ({ userId, full_name, email, role }) => {
    const response = await apiClient.patch(
      `/auth/users/${userId}`,
      {
        full_name,
        email,
        role,
      }
    )

    return response.data
  },

  resetUserPassword: async ({ userId, newPassword, forceChange = true }) => {
    const response = await apiClient.patch(
      `/auth/users/${userId}/password`,
      {
        new_password: newPassword,
        force_change: forceChange,
      }
    )

    return response.data
  },

  scan: async (imageFile) => {
    const formData = new FormData()
    formData.append('file', imageFile)

    const response = await apiClient.post(
      '/scan',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    return response.data
  },

  uploadRecordsCsv: async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post(
      '/admin/upload-records',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

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
      params: {
        year,
        month,
      },
    })

    return response.data
  },

  deleteRecordsByDate: async ({ date }) => {
    const response = await apiClient.delete('/records/date', {
      params: {
        date,
      },
    })

    return response.data
  },

  ping: async () => {
    try {
      const response = await axios.get(
        `${BASE_URL}/health`,
        {
          timeout: 3000,
        }
      )

      return response.status === 200
    } catch {
      return false
    }
  },
}

export default scannerApi