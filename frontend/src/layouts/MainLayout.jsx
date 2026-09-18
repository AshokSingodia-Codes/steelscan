import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  ScanLine,
  Database,
  Wifi,
  WifiOff,
  Keyboard,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { useBackendStatus } from '../hooks/useBackendStatus'
import { SHIFT_OPTIONS, useShiftStore } from '../store/shiftStore'
import { useAuthStore } from '../store/authStore'

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed = false,
  onNavigate,
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-3 rounded transition-all duration-150 group border-l-[3px] border-transparent ${
          isActive
            ? 'bg-brass-500/10 border-l-scan-cyan text-brass-500'
            : 'text-industrial-400 hover:text-industrial-200 hover:bg-industrial-800'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={
              isActive
                ? 'text-brass-500'
                : 'text-industrial-400 group-hover:text-industrial-200'
            }
          />

          {!collapsed && (
            <span className="font-mono text-sm uppercase tracking-wider whitespace-nowrap">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function MainLayout() {
  const navigate = useNavigate()
  const { online } = useBackendStatus()
  const { currentShift, setCurrentShift } = useShiftStore()
  const { user, logout } = useAuthStore()

  const isAdmin = user?.role === 'admin'

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true)
        setMobileSidebarOpen(false)
      }
    }

    handleResize()

    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleLogout = () => {
    logout()
    setMobileSidebarOpen(false)
    navigate('/login', { replace: true })
  }

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false)
  }

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      setMobileSidebarOpen((value) => !value)
      return
    }

    setSidebarCollapsed((value) => !value)
  }

  const sidebarWidthClass = sidebarCollapsed ? 'md:w-16' : 'md:w-60'

  const SidebarContent = ({ mobile = false }) => {
    const collapsed = mobile ? false : sidebarCollapsed

    return (
      <aside
        className={`h-full flex flex-col bg-industrial-900 border-r border-industrial-600 z-30 ${
          mobile ? 'w-72' : `hidden md:flex ${sidebarWidthClass}`
        }`}
      >
        <div className="h-16 flex items-center px-4 border-b border-industrial-600 gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 border-2 border-brass-500 rounded-sm flex items-center justify-center">
              <ScanLine size={14} className="text-scan-cyan" />
            </div>

            <motion.div
              className="absolute inset-0 border-2 border-scan-cyan rounded-sm"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-xl text-brass-500 tracking-[0.05em] leading-none">
                STEELSCAN
              </div>

              <div className="font-mono text-xs text-industrial-400 tracking-wider">
                OCR SYSTEM v4.1
              </div>
            </div>
          )}

          {mobile && (
            <button
              onClick={closeMobileSidebar}
              className="ml-auto w-9 h-9 rounded-lg border border-industrial-200 text-industrial-500 hover:text-industrial-800 hover:bg-industrial-100 flex items-center justify-center"
              title="Close menu"
            >
              <X size={17} />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="px-3 py-3 border-b border-industrial-600">
            <div className="rounded-lg bg-industrial-800 shadow-sm border border-industrial-600 px-3 py-2">
              <div className="flex items-center gap-2 text-brass-500 font-mono text-xs uppercase tracking-wider">
                <ShieldCheck size={13} />
                {user?.role || 'user'}
              </div>

              <div className="font-mono text-xs text-industrial-200 mt-1 truncate">
                {user?.full_name || user?.username}
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {isAdmin && (
            <NavItem
              to="/admin/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              collapsed={collapsed}
              onNavigate={closeMobileSidebar}
            />
          )}

          <NavItem
            to="/scanner"
            icon={ScanLine}
            label="Scanner"
            collapsed={collapsed}
            onNavigate={closeMobileSidebar}
          />

          <NavItem
            to="/manual-entry"
            icon={Keyboard}
            label="Manual Entry"
            collapsed={collapsed}
            onNavigate={closeMobileSidebar}
          />

          <NavItem
            to="/records"
            icon={Database}
            label="Records"
            collapsed={collapsed}
            onNavigate={closeMobileSidebar}
          />

          {!collapsed && (
            <div className="pt-4 mt-4 border-t border-industrial-600">
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-2 px-2">
                Current Shift
              </label>

              <select
                value={currentShift}
                onChange={(e) => setCurrentShift(e.target.value)}
                className="w-full bg-industrial-800 shadow-sm border border-industrial-600 text-industrial-200 rounded px-2 py-2 font-mono text-xs outline-none focus:border-brass-500"
              >
                {SHIFT_OPTIONS.map((shift) => (
                  <option key={shift.value} value={shift.value}>
                    {shift.label}
                  </option>
                ))}
              </select>

              <div className="font-mono text-[10px] text-industrial-400 mt-2 px-2 leading-relaxed">
                {
                  SHIFT_OPTIONS.find((s) => s.value === currentShift)?.time
                }
              </div>
            </div>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-industrial-600 space-y-2">
          <div
            className={`flex items-center gap-2 px-2 py-2 rounded ${
              online ? 'text-signal-green' : 'text-alert-red'
            }`}
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}

            {!collapsed && (
              <span className="font-mono text-xs tracking-wider">
                {online ? 'ONLINE' : 'OFFLINE'}
              </span>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-2 rounded text-industrial-400 hover:text-alert-red hover:bg-alert-red/10 border border-transparent transition-all"
          >
            <LogOut size={14} />

            {!collapsed && (
              <span className="font-mono text-xs tracking-wider uppercase">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-industrial-950 text-industrial-50">
      <SidebarContent />

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            onClick={closeMobileSidebar}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="absolute inset-y-0 left-0">
            <SidebarContent mobile />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden relative min-w-0">
        <div className="pointer-events-none fixed inset-0 scanline-overlay z-0" />

        <div className="relative z-10 h-full flex flex-col min-w-0">
          <div className="h-14 flex-shrink-0 flex items-center gap-3 px-4 border-b border-industrial-600 bg-industrial-900">
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 rounded-lg border border-industrial-600 bg-industrial-800 shadow-sm text-industrial-200 hover:text-brass-500 hover:border-brass-500 flex items-center justify-center transition-all"
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              <Menu size={18} />
            </button>

            <div className="min-w-0">
              <div className="font-display text-xl tracking-[0.05em] text-brass-500 leading-none">
                STEELSCAN
              </div>

              <div className="font-mono text-[10px] text-industrial-400 uppercase tracking-wider truncate">
                {isAdmin ? 'Admin Mode' : 'Operator Mode'} • {currentShift}
              </div>
            </div>

            <div
              className={`ml-auto hidden sm:flex items-center gap-2 font-mono text-xs ${
                online ? 'text-signal-green' : 'text-alert-red'
              }`}
            >
              {online ? <Wifi size={13} /> : <WifiOff size={13} />}
              {online ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}