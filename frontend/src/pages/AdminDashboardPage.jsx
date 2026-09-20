import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Database,
  Edit3,
  Factory,
  Keyboard,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react'

import { scannerApi } from '../api/scannerApi'
import { useAuthStore } from '../store/authStore'
import { useRecordsStore } from '../store/recordsStore'
import { useShiftStore } from '../store/shiftStore'
import { toast } from '../store/toastStore'

function dateValue(value) {
  if (!value) return ''

  const d = new Date(value)

  if (Number.isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function monthValue(value) {
  if (!value) return ''

  const d = new Date(value)

  if (Number.isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

function roleLabel(role) {
  return role === 'admin' ? 'ADMIN' : 'USER / OPERATOR'
}

function CommandButton({
  icon: Icon,
  label,
  active,
  danger = false,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border font-mono text-xs uppercase tracking-wider transition-all ${
        active
          ? danger
            ? 'bg-alert-red/20 border-alert-red text-alert-red shadow-sm'
            : 'bg-scan-cyan border-scan-cyan text-industrial-950 shadow-sm font-bold'
          : danger
            ? 'bg-industrial-800/80 shadow-sm border-industrial-700 text-alert-red/70 hover:border-alert-red hover:bg-alert-red/20 hover:text-alert-red'
            : 'bg-industrial-800/80 shadow-sm border-industrial-700 text-industrial-400 hover:border-scan-cyan hover:text-scan-cyan'
      }`}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = 'text-industrial-100',
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className="glass-card rounded-xl p-5 text-left hover:border-scan-cyan hover:bg-industrial-900 shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-lg bg-industrial-800 border border-industrial-700 flex items-center justify-center">
          <Icon size={19} className="text-industrial-400 group-hover:text-scan-cyan transition-colors" />
        </div>
      </div>

      <div className="mt-4 font-mono text-xs text-industrial-400 uppercase tracking-wider">
        {label}
      </div>

      <div className={`font-display text-4xl tracking-widest mt-1 ${color}`}>
        {value}
      </div>

      <div className="font-mono text-[11px] text-industrial-300 mt-1">
        {subtext}
      </div>
    </button>
  )
}

function Modal({
  title,
  subtitle,
  icon: Icon,
  danger = false,
  children,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl glass-card rounded-2xl border border-industrial-600 shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-industrial-700">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
                danger
                  ? 'border-alert-red/50 bg-alert-red/10 text-alert-red'
                  : 'border-scan-cyan bg-scan-cyan/10 text-scan-cyan'
              }`}
            >
              <Icon size={18} />
            </div>

            <div>
              <h2
                className={`font-display text-3xl tracking-widest leading-none ${
                  danger ? 'text-alert-red' : 'text-industrial-200'
                }`}
              >
                {title}
              </h2>

              <p className="font-mono text-xs text-industrial-400 mt-2">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-industrial-600 text-industrial-400 hover:text-industrial-200 hover:bg-industrial-800 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()

  const { user, logout } = useAuthStore()
  const { currentShift } = useShiftStore()

  const {
    records,
    fetchRecords,
    deleteRecordsByDate,
    deleteRecordsByMonth,
  } = useRecordsStore()

  const [activePanel, setActivePanel] = useState('overview')

  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [memberFilter, setMemberFilter] = useState('all')
  const [memberSearch, setMemberSearch] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)

  const [selectedMember, setSelectedMember] = useState(null)
  const [savingMember, setSavingMember] = useState(false)
  const [addError, setAddError] = useState(null)
  const [editError, setEditError] = useState(null)
  const [resetError, setResetError] = useState(null)

  const [addForm, setAddForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'employee',
  })

  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: 'employee',
  })

  const [resetForm, setResetForm] = useState({
    newPassword: '',
    confirmPassword: '',
  })

  const [deleteType, setDeleteType] = useState('date')
  const [deleteTarget, setDeleteTarget] = useState('')

  useEffect(() => {
    fetchRecords()
    loadUsers()
  }, [fetchRecords])

  const today = dateValue(new Date())
  const currentMonth = monthValue(new Date())

  const totalRecords = records.length

  const todayRecords = records.filter(
    (record) => dateValue(record.created_at) === today
  ).length

  const currentShiftRecords = records.filter(
    (record) => (record.shift || 'General Shift') === currentShift
  ).length

  const monthRecords = records.filter(
    (record) => monthValue(record.created_at) === currentMonth
  ).length

  const activeUsers = users.filter((member) => member.is_active).length
  const inactiveUsers = users.length - activeUsers

  const adminCount = users.filter((member) => member.role === 'admin').length
  const userCount = users.filter((member) => member.role === 'employee').length

  const availableDates = useMemo(() => {
    return Array.from(
      new Set(
        records
          .map((record) => dateValue(record.created_at))
          .filter(Boolean)
      )
    ).sort().reverse()
  }, [records])

  const availableMonths = useMemo(() => {
    return Array.from(
      new Set(
        records
          .map((record) => monthValue(record.created_at))
          .filter(Boolean)
      )
    ).sort().reverse()
  }, [records])

  const filteredMembers = useMemo(() => {
    const search = memberSearch.trim().toLowerCase()

    return users.filter((member) => {
      const roleOk =
        memberFilter === 'all' ||
        (memberFilter === 'admin' && member.role === 'admin') ||
        (memberFilter === 'user' && member.role === 'employee')

      const searchText = [
        member.full_name,
        member.username,
        member.email,
        member.role,
        roleLabel(member.role),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const searchOk =
        !search ||
        searchText.includes(search)

      return roleOk && searchOk
    })
  }, [users, memberFilter, memberSearch])

  const loadUsers = async () => {
    setLoadingUsers(true)

    try {
      const data = await scannerApi.getUsers()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || err.friendlyMessage || 'Failed to load members')
    } finally {
      setLoadingUsers(false)
    }
  }

  const refreshDashboardData = async () => {
    await fetchRecords()

    if (activePanel === 'members') {
      await loadUsers()
    }
  }

  const openAddMember = () => {
    setAddForm({
      username: '',
      password: '',
      full_name: '',
      email: '',
      role: 'employee',
    })
    setAddError(null)
    setShowAddModal(true)
  }

  const openEditMember = (member) => {
    setSelectedMember(member)
    setEditForm({
      full_name: member.full_name || '',
      email: member.email || '',
      role: member.role || 'employee',
    })
    setEditError(null)
    setShowEditModal(true)
  }

  const openResetPassword = (member) => {
    setSelectedMember(member)
    setResetForm({
      newPassword: '',
      confirmPassword: '',
    })
    setResetError(null)
    setShowResetModal(true)
  }

  const createMember = async (e) => {
    e.preventDefault()

    const username = addForm.username.trim().toLowerCase()
    const password = addForm.password.trim()

    if (!username || !password) {
      setAddError('Username and temporary password are required.')
      return
    }

    if (password.length < 10) {
      setAddError('Temporary password must be at least 10 characters long.')
      return
    }

    setSavingMember(true)
    setAddError(null)

    try {
      await scannerApi.createUser({
        username,
        password,
        full_name: addForm.full_name.trim(),
        email: addForm.email.trim(),
        role: addForm.role,
      })

      toast.success('Member added successfully')
      setShowAddModal(false)
      await loadUsers()
    } catch (err) {
      console.error(err)
      const detail = err.response?.data?.detail || err.friendlyMessage || 'Could not save. Please try again.'
      setAddError(detail)
      toast.error(detail)
    } finally {
      setSavingMember(false)
    }
  }

  const updateMember = async (e) => {
    e.preventDefault()

    if (!selectedMember) return

    setSavingMember(true)
    setEditError(null)

    try {
      await scannerApi.updateUserDetails({
        userId: selectedMember.id,
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      })

      toast.success('Member details updated')
      setShowEditModal(false)
      setSelectedMember(null)
      await loadUsers()
    } catch (err) {
      console.error(err)
      const detail = err.response?.data?.detail || err.friendlyMessage || 'Could not save. Please try again.'
      setEditError(detail)
      toast.error(detail)
    } finally {
      setSavingMember(false)
    }
  }

  const resetPassword = async (e) => {
    e.preventDefault()

    if (!selectedMember) return

    const newPassword = resetForm.newPassword.trim()
    const confirmPassword = resetForm.confirmPassword.trim()

    if (!newPassword || !confirmPassword) {
      setResetError('Temporary password and confirmation are required.')
      return
    }

    if (newPassword.length < 10) {
      setResetError('Temporary password must be at least 10 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setResetError('Temporary password confirmation does not match.')
      return
    }

    setSavingMember(true)
    setResetError(null)

    try {
      await scannerApi.resetUserPassword({
        userId: selectedMember.id,
        newPassword,
        forceChange: true,
      })

      toast.success('Password reset. User must change password on next login.')
      setShowResetModal(false)
      setSelectedMember(null)
      await loadUsers()
    } catch (err) {
      console.error(err)
      const detail = err.response?.data?.detail || err.friendlyMessage || 'Password reset failed.'
      setResetError(detail)
      toast.error(detail)
    } finally {
      setSavingMember(false)
    }
  }

  const toggleUserStatus = async (member) => {
    const currentUsername = user?.username

    if (member.username === currentUsername) {
      toast.error('You cannot deactivate your own account')
      return
    }

    const action = member.is_active ? 'deactivate' : 'activate'
    const ok = window.confirm(
      `Are you sure you want to ${action} ${member.username}?`
    )

    if (!ok) return

    try {
      await scannerApi.updateUserStatus({
        userId: member.id,
        isActive: !member.is_active,
      })

      toast.success(
        member.is_active
          ? 'Member deactivated'
          : 'Member activated'
      )

      await loadUsers()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Status update failed')
    }
  }

  const bulkDelete = async () => {
    if (!deleteTarget) {
      toast.error('Select target before deleting records')
      return
    }

    const message =
      deleteType === 'date'
        ? `ADMIN ACTION\n\nThis will permanently delete records from ${deleteTarget}.\n\nType DELETE to confirm.`
        : `ADMIN ACTION\n\nThis will permanently delete all records from ${deleteTarget}.\n\nType DELETE to confirm.`

    const confirmation = window.prompt(message)

    if (confirmation !== 'DELETE') return

    try {
      if (deleteType === 'date') {
        await deleteRecordsByDate({
          date: deleteTarget,
        })
      } else {
        const [yearText, monthText] = deleteTarget.split('-')

        await deleteRecordsByMonth({
          year: Number(yearText),
          month: Number(monthText),
        })
      }

      setDeleteTarget('')
      await fetchRecords()
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-industrial-950 text-industrial-100 relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 scanline-overlay z-0" />

      <div className="relative z-10">
        <header className="sticky top-0 z-30 border-b border-industrial-700 bg-industrial-950/80 backdrop-blur-md">
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 border-2 border-scan-cyan rounded-lg flex items-center justify-center shadow-sm bg-scan-cyan/10 shrink-0">
                  <ScanLine size={20} className="text-scan-cyan" />
                </div>

                <div className="min-w-0">
                  <div className="font-display text-4xl text-scan-cyan tracking-widest leading-none drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]">
                    STEELSCAN
                  </div>

                  <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider truncate">
                    Admin Production Control Center
                  </div>
                </div>
              </div>

              <div className="hidden lg:flex items-center gap-2 rounded-lg border border-industrial-700 bg-industrial-900 shadow-sm px-3 py-2">
                <ShieldCheck size={14} className="text-scan-cyan" />

                <div className="font-mono text-xs">
                  <span className="text-industrial-400">ADMIN </span>
                  <span className="text-industrial-100">
                    {user?.full_name || user?.username}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max pb-1">
                <CommandButton
                  icon={Factory}
                  label="Overview"
                  active={activePanel === 'overview'}
                  onClick={() => setActivePanel('overview')}
                />

                <CommandButton
                  icon={ScanLine}
                  label="Scanner"
                  onClick={() => navigate('/scanner')}
                />

                <CommandButton
                  icon={Keyboard}
                  label="Manual Entry"
                  onClick={() => navigate('/manual-entry')}
                />

                <CommandButton
                  icon={Database}
                  label="Records"
                  onClick={() => navigate('/records')}
                />

                <CommandButton
                  icon={Upload}
                  label="Upload Data"
                  onClick={() => navigate('/admin/upload-records')}
                />

                <CommandButton
                  icon={Users}
                  label="Members"
                  active={activePanel === 'members'}
                  onClick={() => setActivePanel('members')}
                />

                <CommandButton
                  icon={Trash2}
                  label="Bulk Records"
                  active={activePanel === 'bulk'}
                  danger
                  onClick={() => setActivePanel('bulk')}
                />

                <CommandButton
                  icon={LogOut}
                  label="Logout"
                  danger
                  onClick={handleLogout}
                />
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 py-6 space-y-6">
          {activePanel !== 'members' && (
            <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-scan-cyan uppercase tracking-wider mb-2">
                  <Activity size={14} />
                  Control panel active
                </div>

                <h1 className="font-display text-5xl tracking-widest text-industrial-100 leading-none">
                  ADMIN DASHBOARD
                </h1>

                <p className="font-mono text-xs text-industrial-400 tracking-wider mt-2">
                  PRODUCTION RECORDS • MEMBER ACCESS • DATA MAINTENANCE
                </p>
              </div>

              <button
                onClick={refreshDashboardData}
                className="btn-ghost px-4 py-2 text-xs flex items-center gap-2 w-fit"
              >
                <RefreshCw size={14} />
                Refresh Data
              </button>
            </section>
          )}

          {activePanel === 'overview' && (
            <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
              <StatCard
                icon={Database}
                label="Total Records"
                value={totalRecords}
                subtext="Open complete saved history"
                onClick={() => navigate('/records')}
              />

              <StatCard
                icon={CalendarDays}
                label="Today Records"
                value={todayRecords}
                subtext={today}
                color="text-scan-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]"
                onClick={() => navigate(`/records?date=${today}`)}
              />

              <StatCard
                icon={Activity}
                label="Current Shift"
                value={currentShiftRecords}
                subtext={currentShift}
                color="text-signal-green drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]"
                onClick={() => navigate(`/records?shift=${encodeURIComponent(currentShift)}`)}
              />

              <StatCard
                icon={CalendarDays}
                label="This Month"
                value={monthRecords}
                subtext={currentMonth}
                color="text-molten-amber drop-shadow-[0_0_8px_rgba(255,109,0,0.4)]"
                onClick={() => navigate(`/records?month=${currentMonth}`)}
              />
            </section>
          )}

          {activePanel === 'members' && (
            <section className="glass-card rounded-xl p-5">
              <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-4 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg border border-scan-cyan bg-scan-cyan/10 text-scan-cyan flex items-center justify-center">
                    <Users size={18} />
                  </div>

                  <div>
                    <h2 className="font-display text-3xl tracking-widest text-industrial-100 leading-none">
                      MEMBER ACCESS CONTROL
                    </h2>

                    <p className="font-mono text-xs text-industrial-400 mt-2">
                      Manage admins, users, account status, profile details, and password reset support.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <button
                    onClick={openAddMember}
                    className="btn-primary px-4 py-2 text-xs flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Add Member
                  </button>

                  <div>
                    <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                      Member Type
                    </label>

                    <select
                      value={memberFilter}
                      onChange={(e) => setMemberFilter(e.target.value)}
                      className="bg-industrial-800 border border-industrial-600 text-industrial-200 rounded px-3 py-2 font-mono text-xs outline-none focus:border-scan-cyan min-w-[160px]"
                    >
                      <option value="all">All Members</option>
                      <option value="admin">Admin Only</option>
                      <option value="user">User / Operator Only</option>
                    </select>
                  </div>

                  <div className="min-w-[260px]">
                    <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                      Search
                    </label>

                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400"
                      />

                      <input
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Name, username, email..."
                        className="w-full bg-industrial-800 border border-industrial-600 text-industrial-200 rounded pl-9 pr-3 py-2 font-mono text-xs outline-none focus:border-scan-cyan"
                      />
                    </div>
                  </div>

                  <button
                    onClick={loadUsers}
                    className="btn-ghost px-4 py-2 text-xs flex items-center gap-2"
                  >
                    <RefreshCw size={13} className={loadingUsers ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
                <div className="rounded-lg border border-industrial-700 bg-industrial-900 px-4 py-3 shadow-sm">
                  <div className="font-mono text-[10px] text-industrial-400 uppercase tracking-wider">
                    Total
                  </div>

                  <div className="font-display text-3xl tracking-widest text-industrial-200">
                    {users.length}
                  </div>
                </div>

                <div className="rounded-lg border border-scan-cyan bg-scan-cyan/10 px-4 py-3 shadow-sm">
                  <div className="font-mono text-[10px] text-scan-cyan uppercase tracking-wider">
                    Admin
                  </div>

                  <div className="font-display text-3xl tracking-widest text-scan-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]">
                    {adminCount}
                  </div>
                </div>

                <div className="rounded-lg border border-industrial-700 bg-industrial-900 shadow-sm px-4 py-3">
                  <div className="font-mono text-[10px] text-industrial-400 uppercase tracking-wider">
                    Users
                  </div>

                  <div className="font-display text-3xl tracking-widest text-industrial-200">
                    {userCount}
                  </div>
                </div>

                <div className="rounded-lg border border-signal-green/50 bg-signal-green/10 px-4 py-3 shadow-sm">
                  <div className="font-mono text-[10px] text-signal-green uppercase tracking-wider">
                    Active
                  </div>

                  <div className="font-display text-3xl tracking-widest text-signal-green drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]">
                    {activeUsers}
                  </div>
                </div>

                <div className="rounded-lg border border-molten-amber/50 bg-molten-amber/10 px-4 py-3 shadow-sm">
                  <div className="font-mono text-[10px] text-molten-amber uppercase tracking-wider">
                    Showing
                  </div>

                  <div className="font-display text-3xl tracking-widest text-molten-amber drop-shadow-[0_0_8px_rgba(255,109,0,0.4)]">
                    {filteredMembers.length}
                  </div>
                </div>
              </div>

              <div className="overflow-auto rounded-lg border border-industrial-700 bg-industrial-950/50 shadow-card">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-industrial-900">
                    <tr className="border-b border-industrial-700">
                      <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                        Member
                      </th>

                      <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                        Role
                      </th>

                      <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                        Status
                      </th>

                      <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                        Password State
                      </th>

                      <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-4 py-10 text-center font-mono text-sm text-industrial-400"
                        >
                          No members found for selected filter/search.
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((member) => {
                        const isCurrentUser = member.username === user?.username

                        return (
                          <tr
                            key={member.id}
                            className="border-b border-industrial-700 hover:bg-industrial-800/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="font-mono text-sm text-industrial-200 font-bold">
                                {member.full_name || member.username}
                              </div>

                              <div className="font-mono text-xs text-industrial-400 mt-1">
                                @{member.username}
                                {member.email ? ` • ${member.email}` : ''}
                              </div>

                              {isCurrentUser && (
                                <div className="mt-1 font-mono text-[10px] text-scan-cyan uppercase tracking-wider">
                                  Current session
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded border font-mono text-[10px] uppercase tracking-wider ${
                                  member.role === 'admin'
                                    ? 'border-scan-cyan bg-scan-cyan/10 text-scan-cyan'
                                    : 'border-industrial-600 bg-industrial-800 text-industrial-400'
                                }`}
                              >
                                {roleLabel(member.role)}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded border font-mono text-[10px] uppercase tracking-wider ${
                                  member.is_active
                                    ? 'border-emerald-600/40 bg-emerald-950/30 text-emerald-300'
                                    : 'border-rose-600/40 bg-rose-950/30 text-rose-300'
                                }`}
                              >
                                {member.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded border font-mono text-[10px] uppercase tracking-wider ${
                                  member.must_change_password
                                    ? 'border-molten-amber/50 bg-molten-amber/10 text-molten-amber'
                                    : 'border-industrial-600 bg-industrial-800 text-industrial-400'
                                }`}
                              >
                                {member.must_change_password
                                  ? 'Change Required'
                                  : 'Configured'}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditMember(member)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-industrial-600 text-industrial-400 hover:text-scan-cyan hover:border-scan-cyan font-mono text-xs transition-colors"
                                >
                                  <Edit3 size={12} />
                                  Edit
                                </button>

                                <button
                                  onClick={() => openResetPassword(member)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-molten-amber/50 text-molten-amber hover:bg-molten-amber/20 font-mono text-xs transition-colors"
                                >
                                  <KeyRound size={12} />
                                  Reset
                                </button>

                                <button
                                  onClick={() => toggleUserStatus(member)}
                                  disabled={isCurrentUser}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                                    member.is_active
                                      ? 'border-alert-red/50 text-alert-red hover:bg-alert-red/20'
                                      : 'border-signal-green/50 text-signal-green hover:bg-signal-green/20'
                                  }`}
                                >
                                  {member.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
                                  {member.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 rounded-lg border border-industrial-700 bg-industrial-900 px-4 py-3 font-mono text-[11px] text-industrial-400 leading-relaxed shadow-sm">
                Passwords are never displayed. For forgotten passwords, use Reset to issue a temporary password.
                The user will be forced to create a private password after login.
              </div>
            </section>
          )}

          {activePanel === 'bulk' && (
            <section className="rounded-xl border border-alert-red/50 bg-alert-red/10 p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg border border-alert-red/50 bg-alert-red/20 text-alert-red flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>

                <div>
                  <h2 className="font-display text-4xl tracking-widest text-alert-red leading-none">
                    BULK RECORD MAINTENANCE
                  </h2>

                  <p className="font-mono text-xs text-industrial-300 mt-2">
                    Admin-only permanent delete area. Use only after backup or supervisor approval.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[170px]">
                  <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                    Delete By
                  </label>

                  <select
                    value={deleteType}
                    onChange={(e) => {
                      setDeleteType(e.target.value)
                      setDeleteTarget('')
                    }}
                    className="w-full bg-industrial-950 border border-alert-red/50 text-industrial-100 rounded px-3 py-3 font-mono text-xs outline-none focus:border-alert-red"
                  >
                    <option value="date">Date</option>
                    <option value="month">Month</option>
                  </select>
                </div>

                <div className="min-w-[200px]">
                  <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                    Target
                  </label>

                  <select
                    value={deleteTarget}
                    onChange={(e) => setDeleteTarget(e.target.value)}
                    className="w-full bg-industrial-950 border border-industrial-600 text-industrial-100 rounded px-3 py-3 font-mono text-xs outline-none focus:border-alert-red"
                  >
                    <option value="">
                      {deleteType === 'date'
                        ? 'Select date'
                        : 'Select month'}
                    </option>

                    {(deleteType === 'date' ? availableDates : availableMonths).map((target) => (
                      <option key={target} value={target}>
                        {target}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={bulkDelete}
                  disabled={!deleteTarget}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg bg-alert-red/20 border border-alert-red
                             text-alert-red hover:bg-alert-red/40 disabled:opacity-40 disabled:cursor-not-allowed
                             font-mono text-xs uppercase tracking-wider font-bold transition-all"
                >
                  <Trash2 size={14} />
                  Delete Records
                </button>
              </div>

              <div className="mt-5 rounded-lg border border-alert-red/50 bg-alert-red/10 px-4 py-3 font-mono text-xs text-alert-red font-bold tracking-wider">
                {deleteTarget
                  ? deleteType === 'date'
                    ? `Warning: This will permanently delete records only from ${deleteTarget}.`
                    : `Warning: This will permanently delete all records from ${deleteTarget}.`
                  : 'Warning: Select a date or month before deleting production records.'}
              </div>
            </section>
          )}
        </main>
      </div>

      {showAddModal && (
        <Modal
          title="ADD MEMBER"
          subtitle="Create a new admin or user/operator account."
          icon={UserPlus}
          onClose={() => setShowAddModal(false)}
        >
          <form onSubmit={createMember} autoComplete="off" className="space-y-3">
            {addError && (
              <div className="rounded-lg border border-alert-red/60 bg-alert-red/10 px-4 py-3 font-mono text-xs text-alert-red flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Username
              </label>
              <input
                value={addForm.username}
                onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                placeholder="Username (e.g. jsmith)"
                autoComplete="off"
                spellCheck="false"
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-scan-cyan"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Temporary Password (Min 10 characters)
              </label>
              <input
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                placeholder="Temporary password"
                type="password"
                autoComplete="new-password"
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-scan-cyan"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                value={addForm.full_name}
                onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                placeholder="Full name (optional)"
                autoComplete="off"
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-scan-cyan"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="Email address (optional)"
                autoComplete="off"
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-scan-cyan"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Role
              </label>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-scan-cyan"
              >
                <option value="employee">User / Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="rounded-lg border border-molten-amber/50 bg-molten-amber/10 px-4 py-3 font-mono text-xs text-molten-amber">
              New members will be required to change this temporary password after first login.
            </div>

            <button
              disabled={savingMember}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Save size={14} />
              {savingMember ? 'SAVING...' : 'Create Member'}
            </button>
          </form>
        </Modal>
      )}

      {showEditModal && selectedMember && (
        <Modal
          title="EDIT MEMBER"
          subtitle={`Update profile and role for @${selectedMember.username}.`}
          icon={Edit3}
          onClose={() => setShowEditModal(false)}
        >
          <form onSubmit={updateMember} autoComplete="off" className="space-y-3">
            {editError && (
              <div className="rounded-lg border border-alert-red/60 bg-alert-red/10 px-4 py-3 font-mono text-xs text-alert-red flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Full name"
                autoComplete="off"
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-scan-cyan"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="Email"
                autoComplete="off"
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-scan-cyan"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Role
              </label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-scan-cyan"
              >
                <option value="employee">User / Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              disabled={savingMember}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Save size={14} />
              {savingMember ? 'SAVING...' : 'Save Changes'}
            </button>
          </form>
        </Modal>
      )}

      {showResetModal && selectedMember && (
        <Modal
          title="RESET PASSWORD"
          subtitle={`Set temporary password for @${selectedMember.username}.`}
          icon={KeyRound}
          danger
          onClose={() => setShowResetModal(false)}
        >
          <form onSubmit={resetPassword} autoComplete="off" className="space-y-3">
            {resetError && (
              <div className="rounded-lg border border-alert-red/60 bg-alert-red/10 px-4 py-3 font-mono text-xs text-alert-red flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                New Temporary Password (Min 10 characters)
              </label>
              <input
                value={resetForm.newPassword}
                onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                placeholder="New temporary password"
                type="password"
                autoComplete="new-password"
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-alert-red"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                Confirm Temporary Password
              </label>
              <input
                value={resetForm.confirmPassword}
                onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                placeholder="Confirm temporary password"
                type="password"
                autoComplete="new-password"
                className="w-full bg-industrial-900 border border-industrial-700 text-industrial-200 rounded px-3 py-3 font-mono text-sm outline-none focus:border-alert-red"
              />
            </div>

            <div className="rounded-lg border border-alert-red/50 bg-alert-red/10 px-4 py-3 font-mono text-xs text-alert-red">
              The user will be forced to change this temporary password after login.
              Existing passwords are never shown for security.
            </div>

            <button
              disabled={savingMember}
              className="w-full py-3 rounded-lg bg-alert-red/20 border border-alert-red text-alert-red font-bold hover:bg-alert-red/40 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider disabled:opacity-40 transition-colors"
            >
              <KeyRound size={14} />
              {savingMember ? 'SAVING...' : 'Reset Password'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}