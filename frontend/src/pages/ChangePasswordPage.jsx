import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  KeyRound,
  Lock,
  ScanLine,
  ShieldCheck,
} from 'lucide-react'

import { useAuthStore } from '../store/authStore'

export default function ChangePasswordPage() {
  const navigate = useNavigate()

  const {
    user,
    loading,
    error,
    changePassword,
    logout,
  } = useAuthStore()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setLocalError('All password fields are required.')
      return
    }

    if (newPassword.length < 10) {
      setLocalError('New password must be at least 10 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setLocalError('New password and confirm password do not match.')
      return
    }

    if (currentPassword === newPassword) {
      setLocalError('New password must be different from temporary password.')
      return
    }

    try {
      const updatedUser = await changePassword({
        currentPassword,
        newPassword,
      })

      if (updatedUser.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate('/scanner', { replace: true })
      }
    } catch {
      // handled by store
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-industrial-950 text-industrial-100">
      <div className="pointer-events-none fixed inset-0 scanline-overlay z-0" />

      <div className="absolute inset-0">
        <div className="absolute -top-48 -right-48 w-[34rem] h-[34rem] rounded-full bg-scan-cyan/20 blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-[34rem] h-[34rem] rounded-full bg-scan-cyan/10 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 border-2 border-scan-cyan rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.3)] bg-industrial-900">
              <ScanLine size={22} className="text-scan-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
            </div>

            <div>
              <div className="font-display text-5xl text-scan-cyan tracking-widest leading-none drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]">
                STEELSCAN
              </div>

              <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider">
                Password Security
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-8 border border-scan-cyan/50 shadow-[0_0_30px_rgba(0,229,255,0.1)]">
            <div className="flex items-start gap-3 mb-7">
              <div className="w-11 h-11 rounded-lg border border-scan-cyan/50 bg-scan-cyan/10 flex items-center justify-center text-scan-cyan">
                <KeyRound size={20} />
              </div>

              <div>
                <h1 className="font-display text-4xl tracking-widest text-industrial-100 leading-none drop-shadow-md">
                  CHANGE PASSWORD
                </h1>

                <p className="font-mono text-xs text-industrial-400 mt-2">
                  Temporary password detected for {user?.username}
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-lg border border-molten-amber/50 bg-molten-amber/10 px-4 py-3 font-mono text-xs text-molten-amber flex gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Create a new password before accessing production modules (minimum 10 characters).
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-industrial-400 mb-2">
                  Current Temporary Password
                </label>

                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400"
                  />

                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    className="w-full bg-industrial-950/50 border border-industrial-700 rounded-lg px-10 py-3.5 text-industrial-100 font-mono text-sm outline-none focus:border-scan-cyan focus:ring-1 focus:ring-scan-cyan/40 transition-all focus:shadow-[0_0_10px_rgba(0,229,255,0.15)]"
                    placeholder="Enter temporary password"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-industrial-400 mb-2">
                  New Password
                </label>

                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400"
                  />

                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-industrial-950/50 border border-industrial-700 rounded-lg px-10 py-3.5 text-industrial-100 font-mono text-sm outline-none focus:border-scan-cyan focus:ring-1 focus:ring-scan-cyan/40 transition-all focus:shadow-[0_0_10px_rgba(0,229,255,0.15)]"
                    placeholder="Create new password (min 10 chars)"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-industrial-400 mb-2">
                  Confirm New Password
                </label>

                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400"
                  />

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-industrial-950/50 border border-industrial-700 rounded-lg px-10 py-3.5 text-industrial-100 font-mono text-sm outline-none focus:border-scan-cyan focus:ring-1 focus:ring-scan-cyan/40 transition-all focus:shadow-[0_0_10px_rgba(0,229,255,0.15)]"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              {(localError || error) && (
                <div className="rounded-lg border border-alert-red/60 bg-alert-red/10 px-4 py-3 font-mono text-xs text-alert-red flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{localError || error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed py-3.5 rounded-lg"
              >
                <ShieldCheck size={16} />
                {loading ? 'Updating Password...' : 'Save New Password'}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="btn-ghost w-full py-3 rounded-lg"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}