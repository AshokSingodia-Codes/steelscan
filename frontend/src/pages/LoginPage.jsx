import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  ScanLine,
  ShieldCheck,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react'

import { scannerApi } from '../api/scannerApi'
import { useBackendStatus } from '../hooks/useBackendStatus'

const TOKEN_KEY = 'steelscan_auth_token'
const USER_KEY = 'steelscan_auth_user'

function getNextPath(user) {
  if (user?.must_change_password) {
    return '/change-password'
  }

  if (user?.role === 'admin') {
    return '/admin/dashboard'
  }

  return '/scanner'
}

function saveSession(data) {
  const user = {
    username: data.username,
    full_name: data.full_name,
    role: data.role,
    must_change_password: Boolean(data.must_change_password),
  }

  localStorage.setItem(TOKEN_KEY, data.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))

  return user
}

export default function LoginPage() {
  const { online } = useBackendStatus()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [debugText, setDebugText] = useState('')

  useEffect(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      const rawUser = localStorage.getItem(USER_KEY)

      if (!token || !rawUser) return

      const savedUser = JSON.parse(rawUser)
      window.location.replace(getNextPath(savedUser))
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    setLocalError('')
    setDebugText('')

    const cleanUsername = username.trim().toLowerCase()
    const cleanPassword = password.trim()

    if (!cleanUsername || !cleanPassword) {
      setLocalError('Please enter username and password.')
      return
    }

    try {
      setLoading(true)
      setDebugText('Authenticating...')

      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)

      const data = await scannerApi.login({
        username: cleanUsername,
        password: cleanPassword,
      })

      if (!data?.access_token) {
        setLocalError('Login accepted, but access token was missing.')
        setDebugText('Invalid login response from backend.')
        return
      }

      const user = saveSession(data)

      const savedToken = localStorage.getItem(TOKEN_KEY)
      const savedUser = localStorage.getItem(USER_KEY)

      if (!savedToken || !savedUser) {
        setLocalError(
          'Login accepted, but phone browser did not save session. Clear browser site data and try again.'
        )
        setDebugText('Local storage failed.')
        return
      }

      const nextPath = getNextPath(user)

      setDebugText(`Login successful. Opening ${nextPath}...`)

      window.location.href = nextPath
    } catch (err) {
      console.error(err)

      const status = err.response?.status
      const detail = err.response?.data?.detail

      if (status === 401) {
        setLocalError('Invalid username or password.')
      } else if (status === 403) {
        setLocalError(detail || 'Account is inactive. Contact IT Department.')
      } else if (err.isNetworkError || !err.response) {
        setLocalError(
          'Phone cannot reach backend. Check Wi-Fi, Cloudflare tunnel, firewall, and backend server.'
        )
      } else {
        setLocalError(detail || err.message || 'Login failed. Contact IT Department.')
      }

      setDebugText(status ? `Backend returned HTTP ${status}` : 'Network/frontend error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden text-industrial-100 bg-industrial-950">
      {/* Light Background Pattern */}
      <div className="absolute inset-0 opacity-[0.2] scanline-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.05),transparent_60%)]" />

      <main className="relative z-10 min-h-screen flex items-center justify-center px-5 py-8">
        <section className="w-full max-w-md">
          <div className="relative text-center mb-8 rounded-3xl glass-card px-6 py-6 shadow-card">
            <div className="relative mx-auto mb-4 h-16 w-16 rounded-2xl border-2 border-scan-cyan bg-scan-cyan/10 flex items-center justify-center shadow-sm">
              <ScanLine size={30} className="text-scan-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.5)]" />
            </div>

            <h1 className="relative font-display text-6xl sm:text-7xl tracking-widest text-scan-cyan leading-none drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]">
              STEELSCAN
            </h1>

            <p className="relative mt-2 font-mono text-[11px] sm:text-xs uppercase tracking-[0.26em] text-industrial-400">
              Industrial OCR System
            </p>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl glass-card p-6 sm:p-8 shadow-card">
              <div className="relative mb-7 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-5xl tracking-widest text-industrial-100 leading-none">
                    SIGN IN
                  </h2>

                  <p className="mt-2 font-mono text-xs uppercase tracking-wider text-industrial-400">
                    Authorized access
                  </p>
                </div>

                <div
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-wider uppercase ${
                    online
                      ? 'border-signal-green/50 bg-signal-green/10 text-signal-green drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]'
                      : 'border-alert-red/50 bg-alert-red/10 text-alert-red drop-shadow-[0_0_8px_rgba(255,59,48,0.4)]'
                  }`}
                >
                  {online ? <Wifi size={13} /> : <WifiOff size={13} />}
                  {online ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="relative space-y-4">
                <div>
                  <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-industrial-600">
                    Username
                  </label>

                  <div className="relative">
                    <User
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400"
                    />

                    <input
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value)
                        setLocalError('')
                        setDebugText('')
                      }}
                      autoFocus
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="text"
                      placeholder="Enter username"
                      className="w-full rounded-xl border border-industrial-700 bg-industrial-900 px-10 py-3.5 font-mono text-sm text-industrial-100 outline-none transition-all placeholder:text-industrial-500 focus:border-scan-cyan focus:ring-1 focus:ring-scan-cyan/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-industrial-600">
                    Password
                  </label>

                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400"
                    />

                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setLocalError('')
                        setDebugText('')
                      }}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="text"
                      placeholder="Enter password"
                      className="w-full rounded-xl border border-industrial-700 bg-industrial-900 px-10 py-3.5 pr-12 font-mono text-sm text-industrial-100 outline-none transition-all placeholder:text-industrial-500 focus:border-scan-cyan focus:ring-1 focus:ring-scan-cyan/20"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-industrial-400 hover:text-scan-cyan transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {localError && (
                  <div className="rounded-xl border border-alert-red/50 bg-alert-red/10 px-4 py-3 font-mono text-xs text-alert-red">
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                       size={14}
                        className="mt-0.5 flex-shrink-0 text-alert-red drop-shadow-[0_0_8px_rgba(255,59,48,0.4)]"
                      />

                      <div>
                        <div className="uppercase tracking-wider font-bold">
                          Access Denied
                        </div>

                        <div className="mt-1 leading-relaxed opacity-90">
                          {localError}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {debugText && (
                  <div className="rounded-xl border border-industrial-700 bg-industrial-900 px-4 py-2 font-mono text-[11px] text-industrial-400">
                    {debugText}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !username.trim() || !password.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl btn-primary px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck size={16} />
                  {loading ? 'Authenticating...' : 'Login'}
                </button>
              </form>

              <div className="relative mt-6 rounded-xl border border-industrial-700 bg-industrial-900/50 px-4 py-3 text-center">
                <p className="font-mono text-xs leading-relaxed text-industrial-400">
                  Use your registered operator or administrator account.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {['SCAN', 'VERIFY', 'SAVE'].map((item) => (
              <div
                key={item}
                className="glass-card rounded-xl px-3 py-3 text-center shadow-sm"
              >
                <div className="font-display text-xl tracking-widest text-scan-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]">
                  {item}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 text-center font-mono text-[10px] uppercase tracking-wider text-industrial-500">
            STEELSCAN Secure Factory Login
          </div>
        </section>
      </main>
    </div>
  )
}