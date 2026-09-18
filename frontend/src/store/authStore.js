import { create } from 'zustand'
import { scannerApi } from '../api/scannerApi'
import { useScannerStore } from './scannerStore'

const TOKEN_KEY = 'steelscan_auth_token'
const USER_KEY = 'steelscan_auth_user'

function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function normalizeUser(data) {
  return {
    username: data.username,
    full_name: data.full_name,
    role: data.role,
    must_change_password: Boolean(data.must_change_password),
  }
}

function clearScannerForAccountSwitch() {
  try {
    useScannerStore.getState().clearScannerForNewSession()
  } catch {
    // ignore scanner cleanup errors
  }
}

export const useAuthStore = create((set, get) => ({
  token: loadToken(),
  user: loadUser(),
  loading: false,
  error: null,

  isAuthenticated: () => Boolean(get().token && get().user),

  isAdmin: () => get().user?.role === 'admin',

  mustChangePassword: () => Boolean(get().user?.must_change_password),

  login: async ({ username, password }) => {
    set({
      loading: true,
      error: null,
    })

    try {
      const data = await scannerApi.login({
        username,
        password,
      })

      const user = normalizeUser(data)

      // Important: clear old scanner UI before new user enters system.
      clearScannerForAccountSwitch()

      localStorage.setItem(TOKEN_KEY, data.access_token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))

      set({
        token: data.access_token,
        user,
        loading: false,
        error: null,
      })

      return user
    } catch (err) {
      console.error(err)

      const msg =
        err.response?.data?.detail ||
        'Login failed. Check username and password.'

      set({
        loading: false,
        error: msg,
      })

      throw err
    }
  },

  fetchMe: async () => {
    if (!get().token) return null

    try {
      const me = await scannerApi.me()
      const user = normalizeUser(me)

      localStorage.setItem(USER_KEY, JSON.stringify(user))

      set({
        user,
      })

      return user
    } catch {
      get().logout()
      return null
    }
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    set({
      loading: true,
      error: null,
    })

    try {
      const data = await scannerApi.changePassword({
        currentPassword,
        newPassword,
      })

      const current = get().user || {}

      const user = {
        ...current,
        full_name: data.full_name,
        role: data.role,
        username: data.username,
        must_change_password: Boolean(data.must_change_password),
      }

      localStorage.setItem(USER_KEY, JSON.stringify(user))

      set({
        user,
        loading: false,
        error: null,
      })

      return user
    } catch (err) {
      console.error(err)

      const msg =
        err.response?.data?.detail ||
        'Password change failed.'

      set({
        loading: false,
        error: msg,
      })

      throw err
    }
  },

  logout: () => {
    // Important: clear scanner result before leaving account.
    clearScannerForAccountSwitch()

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)

    set({
      token: null,
      user: null,
      loading: false,
      error: null,
    })
  },
}))