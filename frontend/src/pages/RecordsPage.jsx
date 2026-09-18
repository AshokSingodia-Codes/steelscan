import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Download,
  RefreshCw,
  Database,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Filter,
  Search,
  UserRound,
  Upload,
  Activity,
  X,
} from 'lucide-react'

import { useRecordsStore } from '../store/recordsStore'
import { useAuthStore } from '../store/authStore'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { OfflineBanner } from '../components/ui/OfflineBanner'
import { SHIFT_OPTIONS } from '../store/shiftStore'

function MiniStat({ icon: Icon, label, value, color = 'text-industrial-700' }) {
  return (
    <div className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-industrial-700 bg-industrial-900 shadow-sm px-3 py-2">
      <Icon size={13} className="text-industrial-400" />

      <span className="font-mono text-[10px] text-industrial-400 uppercase tracking-wider">
        {label}
      </span>

      <span className={`font-display text-lg tracking-widest ${color}`}>
        {value}
      </span>
    </div>
  )
}

function CategoryButton({ icon: Icon, label, shortLabel, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border font-mono text-[11px] uppercase tracking-wider transition-all ${
        active
          ? 'bg-scan-cyan border-scan-cyan text-industrial-950 shadow-sm font-bold'
          : 'bg-industrial-800/80 shadow-sm border-industrial-700 text-industrial-400 hover:border-scan-cyan hover:text-scan-cyan'
      }`}
    >
      <Icon size={13} />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{shortLabel || label}</span>
    </button>
  )
}

function escapeCSV(value) {
  if (value === null || value === undefined) return ''

  const text = String(value).replace(/"/g, '""')

  if (
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\n')
  ) {
    return `"${text}"`
  }

  return text
}

function formatDate(value) {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(value))
  } catch {
    return '—'
  }
}

function formatTime(value) {
  if (!value) return '—'

  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(new Date(value))
  } catch {
    return '—'
  }
}

function monthValue(dateString) {
  if (!dateString) return ''

  const d = new Date(dateString)

  if (Number.isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

function dateValue(dateString) {
  if (!dateString) return ''

  const d = new Date(dateString)

  if (Number.isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function isUploadedRecord(record) {
  const sourceType = String(record.source_type || '').toUpperCase()
  const pipeline = String(record.pipeline || '').toLowerCase()

  return (
    sourceType === 'CSV_UPLOAD' ||
    sourceType === 'PDF_UPLOAD' ||
    pipeline.includes('csv-upload') ||
    pipeline.includes('csv-import')
  )
}

function getMethod(record) {
  const pipeline = String(record.pipeline || 'ocr').toLowerCase()

  if (isUploadedRecord(record)) return 'UPLOADED'
  if (pipeline.includes('manual')) return 'MANUAL'
  if (pipeline.includes('edited')) return 'EDITED'
  if (pipeline.includes('roi')) return 'ROI-HYBRID'
  if (pipeline.includes('fast')) return 'OCR'
  if (pipeline.includes('ocr')) return 'OCR'

  return pipeline.toUpperCase()
}

function getMethodColor(method) {
  if (method === 'UPLOADED') {
    return 'text-violet-300 border-violet-500/40 bg-violet-500/10'
  }

  if (method === 'MANUAL') {
    return 'text-molten-amber border-molten-amber/40 bg-molten-amber/10'
  }

  if (method === 'EDITED') {
    return 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10'
  }

  if (method === 'ROI-HYBRID') {
    return 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10'
  }

  return 'text-signal-green border-signal-green/40 bg-signal-green/10'
}

function displayConfidence(record) {
  if (isUploadedRecord(record)) return '-'

  return `${Math.round((record.confidence ?? 0) * 100)}%`
}

export default function RecordsPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()

  const {
    records,
    loading,
    error,
    fetchRecords,
    deleteRecord,
  } = useRecordsStore()

  const [searchText, setSearchText] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all')
  const [shiftFilter, setShiftFilter] = useState(searchParams.get('shift') || 'All')
  const [methodFilter, setMethodFilter] = useState(searchParams.get('method') || 'All')
  const [monthFilter, setMonthFilter] = useState(searchParams.get('month') || 'All')
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || 'All')

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  useEffect(() => {
    const urlCategory = searchParams.get('category') || 'all'
    const urlShift = searchParams.get('shift') || 'All'
    const urlMethod = searchParams.get('method') || 'All'
    const urlMonth = searchParams.get('month') || 'All'
    const urlDate = searchParams.get('date') || 'All'

    setCategoryFilter(urlCategory)
    setShiftFilter(urlShift)
    setMethodFilter(urlMethod)
    setMonthFilter(urlMonth)
    setDateFilter(urlDate)
  }, [searchParams])

  const availableMonths = useMemo(() => {
    const months = Array.from(
      new Set(
        records
          .map((record) => monthValue(record.created_at))
          .filter(Boolean)
      )
    )

    return months.sort().reverse()
  }, [records])

  const availableDates = useMemo(() => {
    const dates = Array.from(
      new Set(
        records
          .map((record) => dateValue(record.created_at))
          .filter(Boolean)
      )
    )

    return dates.sort().reverse()
  }, [records])

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return records.filter((record) => {
      const shift = record.shift || 'General Shift'
      const method = getMethod(record)
      const month = monthValue(record.created_at)
      const recordDate = dateValue(record.created_at)
      const uploaded = isUploadedRecord(record)

      const coilCode = String(record.code || '').toLowerCase()
      const employeeId = String(record.created_by_username || '').toLowerCase()
      const recordId = String(record.id || '')

      const searchOk =
        !query ||
        coilCode.includes(query) ||
        employeeId.includes(query) ||
        recordId.includes(query)

      const categoryOk =
        categoryFilter === 'all' ||
        (categoryFilter === 'daily' && !uploaded) ||
        (categoryFilter === 'uploaded' && uploaded)

      const shiftOk =
        shiftFilter === 'All' ||
        shift === shiftFilter

      const methodOk =
        methodFilter === 'All' ||
        method === methodFilter

      const monthOk =
        monthFilter === 'All' ||
        month === monthFilter

      const dateOk =
        dateFilter === 'All' ||
        recordDate === dateFilter

      return searchOk && categoryOk && shiftOk && methodOk && monthOk && dateOk
    })
  }, [records, searchText, categoryFilter, shiftFilter, methodFilter, monthFilter, dateFilter])

  const total = filteredRecords.length

  const dailyCount = filteredRecords.filter(
    (record) => !isUploadedRecord(record)
  ).length

  const uploadedCount = filteredRecords.filter(
    (record) => isUploadedRecord(record)
  ).length

  const confidenceRecords = filteredRecords.filter(
    (record) => !isUploadedRecord(record)
  )

  const avgConf = confidenceRecords.length
    ? confidenceRecords.reduce((s, r) => s + (r.confidence ?? 0), 0) / confidenceRecords.length
    : 0

  const manualCount = filteredRecords.filter(
    (r) => getMethod(r) === 'MANUAL'
  ).length

  const ocrEditedCount = filteredRecords.filter(
    (r) => ['OCR', 'EDITED', 'ROI-HYBRID'].includes(getMethod(r))
  ).length

  const activeFilterCount = [
    shiftFilter !== 'All',
    methodFilter !== 'All',
    monthFilter !== 'All',
    dateFilter !== 'All',
  ].filter(Boolean).length

  const resetAdvancedFilters = () => {
    setShiftFilter('All')
    setMethodFilter('All')
    setMonthFilter('All')
    setDateFilter('All')
  }

  const downloadCSV = () => {
    if (!filteredRecords.length) return

    const headers = [
      'ID',
      'Coil Code',
      'Employee ID',
      'Method',
      'Shift',
      'Date',
      'Time',
      'Confidence',
    ]

    const rows = filteredRecords.map((record) => [
      record.id,
      record.code,
      record.created_by_username || '—',
      getMethod(record),
      record.shift || 'General Shift',
      formatDate(record.created_at),
      formatTime(record.created_at),
      displayConfidence(record),
    ])

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = window.URL.createObjectURL(blob)

    const safeCategory = categoryFilter.replace(/\s+/g, '_')
    const safeSearch = searchText.trim().replace(/\s+/g, '_') || 'all'
    const safeShift = shiftFilter.replace(/\s+/g, '_')
    const safeMethod = methodFilter.replace(/\s+/g, '_')
    const safeMonth = monthFilter.replace(/\s+/g, '_')
    const safeDate = dateFilter.replace(/\s+/g, '_')

    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `coil_records_${safeCategory}_${safeSearch}_${safeShift}_${safeMethod}_${safeMonth}_${safeDate}_${Date.now()}.csv`
    )

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col min-w-0">
      <OfflineBanner />

      <div className="flex-shrink-0 border-b border-industrial-700 bg-industrial-950/80 backdrop-blur-md">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-3xl tracking-widest text-industrial-100 leading-none truncate drop-shadow-md">
              DATABASE RECORDS
            </h1>

            <div className="font-mono text-[10px] md:text-xs text-industrial-400 tracking-wider mt-1 truncate">
              ALL • DAILY • UPLOADED DATA
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={downloadCSV}
              disabled={!filteredRecords.length}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg
                         bg-cyan-500 hover:bg-cyan-400
                         text-black font-semibold transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export CSV"
            >
              <Download size={16} />
              <span className="hidden md:inline">Export CSV</span>
            </button>

            <button
              onClick={fetchRecords}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-industrial-800/80 border border-industrial-700
                         text-industrial-400 hover:text-scan-cyan hover:border-scan-cyan font-mono text-xs uppercase tracking-wider
                         rounded-lg transition-all duration-150 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>

        <div className="px-4 md:px-6 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
            <CategoryButton
              icon={Database}
              label="All Records"
              shortLabel="All"
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
            />

            <CategoryButton
              icon={Activity}
              label="Daily"
              shortLabel="Daily"
              active={categoryFilter === 'daily'}
              onClick={() => setCategoryFilter('daily')}
            />

            <CategoryButton
              icon={Upload}
              label="Uploaded"
              shortLabel="Uploaded"
              active={categoryFilter === 'uploaded'}
              onClick={() => setCategoryFilter('uploaded')}
            />

            <div className="relative min-w-[220px] sm:min-w-[280px] md:min-w-[360px] flex-1">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400"
              />

              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search coil, employee, ID..."
                className="w-full bg-industrial-800 shadow-sm border border-industrial-700 text-industrial-100 rounded-lg pl-9 pr-3 py-2 font-mono text-xs outline-none focus:border-scan-cyan"
              />
            </div>

            <button
              onClick={() => setShowFilters((value) => !value)}
              className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs uppercase tracking-wider transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-molten-amber/10 border-molten-amber/50 text-molten-amber'
                  : 'bg-industrial-800/80 shadow-sm border-industrial-700 text-industrial-400 hover:border-scan-cyan hover:text-scan-cyan'
              }`}
            >
              <Filter size={13} />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-molten-amber text-industrial-950 text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 rounded-xl border border-industrial-700 bg-industrial-900 p-3 shadow-card">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[140px] flex-1">
                  <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                    Shift
                  </label>

                  <select
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value)}
                    className="w-full bg-industrial-950 shadow-sm border border-industrial-700 text-industrial-200 rounded px-3 py-2 font-mono text-xs outline-none focus:border-scan-cyan"
                  >
                    <option value="All">All Shifts</option>

                    {SHIFT_OPTIONS.map((shift) => (
                      <option key={shift.value} value={shift.value}>
                        {shift.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[140px] flex-1">
                  <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                    Method
                  </label>

                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="w-full bg-industrial-950 shadow-sm border border-industrial-700 text-industrial-200 rounded px-3 py-2 font-mono text-xs outline-none focus:border-scan-cyan"
                  >
                    <option value="All">All Methods</option>
                    <option value="OCR">OCR</option>
                    <option value="EDITED">Edited</option>
                    <option value="MANUAL">Manual</option>
                    <option value="ROI-HYBRID">ROI-Hybrid</option>
                    <option value="UPLOADED">Uploaded</option>
                  </select>
                </div>

                <div className="min-w-[140px] flex-1">
                  <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                    Month
                  </label>

                  <select
                    value={monthFilter}
                    onChange={(e) => {
                      const value = e.target.value
                      setMonthFilter(value)

                      if (value !== 'All') {
                        setDateFilter('All')
                      }
                    }}
                    className="w-full bg-industrial-950 shadow-sm border border-industrial-700 text-industrial-200 rounded px-3 py-2 font-mono text-xs outline-none focus:border-scan-cyan"
                  >
                    <option value="All">All Months</option>

                    {availableMonths.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[140px] flex-1">
                  <label className="block font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1">
                    Date
                  </label>

                  <select
                    value={dateFilter}
                    onChange={(e) => {
                      const value = e.target.value
                      setDateFilter(value)

                      if (value !== 'All') {
                        setMonthFilter('All')
                      }
                    }}
                    className="w-full bg-industrial-950 shadow-sm border border-industrial-700 text-industrial-200 rounded px-3 py-2 font-mono text-xs outline-none focus:border-scan-cyan"
                  >
                    <option value="All">All Dates</option>

                    {availableDates.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={resetAdvancedFilters}
                  className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded border border-industrial-700 text-industrial-400 hover:text-alert-red hover:border-alert-red/50 font-mono text-xs uppercase tracking-wider hover:bg-alert-red/10"
                >
                  <X size={13} />
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 md:px-6 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <MiniStat
              icon={Database}
              label="Filtered"
              value={total}
            />

            <MiniStat
              icon={Activity}
              label="Daily"
              value={dailyCount}
              color="text-signal-green drop-shadow-[0_0_5px_rgba(0,230,118,0.4)]"
            />

            <MiniStat
              icon={Upload}
              label="Uploaded"
              value={uploadedCount}
              color="text-violet-400"
            />

            <MiniStat
              icon={CheckCircle2}
              label="OCR/Edit"
              value={ocrEditedCount}
              color="text-cyan-400"
            />

            <MiniStat
              icon={Database}
              label="Manual"
              value={manualCount}
              color="text-molten-amber drop-shadow-[0_0_5px_rgba(255,109,0,0.4)]"
            />

            <MiniStat
              icon={TrendingUp}
              label="Avg"
              value={`${Math.round(avgConf * 100)}%`}
              color="text-scan-cyan drop-shadow-[0_0_5px_rgba(0,229,255,0.4)]"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-6 pt-4 min-h-0">
        {loading && records.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <LoadingSpinner label="Loading records..." />
          </div>
        ) : error && records.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-alert-red">
            <AlertTriangle size={32} />

            <div className="font-mono text-sm tracking-wider text-center">
              {error}
            </div>

            <button
              onClick={fetchRecords}
              className="btn-ghost text-xs px-4 py-2"
            >
              Try Again
            </button>
          </div>
        ) : (
          <motion.div
            className="h-full overflow-auto rounded-lg border border-industrial-200"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead className="sticky top-0 bg-industrial-900 z-10">
                <tr className="border-b border-industrial-700">
                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                    ID
                  </th>

                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                    Coil Code
                  </th>

                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                    Employee ID
                  </th>

                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                    Method
                  </th>

                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                    Shift
                  </th>

                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                    Date
                  </th>

                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                    Time
                  </th>

                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider">
                    Confidence
                  </th>

                  <th className="px-4 py-3 font-mono text-xs text-industrial-400 uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-4 py-10 text-center font-mono text-sm text-industrial-400"
                    >
                      No records found for selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const method = getMethod(record)
                    const canDelete =
                      user?.role === 'admin' ||
                      record.created_by_username === user?.username

                    return (
                      <tr
                        key={record.id}
                        className="border-b border-industrial-700 hover:bg-industrial-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-industrial-400">
                          #{record.id}
                        </td>

                        <td className="px-4 py-3 font-mono text-sm text-scan-cyan tracking-wider font-bold">
                          {record.code || '—'}
                        </td>

                        <td className="px-4 py-3 font-mono text-xs text-cyan-300">
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound size={12} />
                            {record.created_by_username || '—'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded border font-mono text-[10px] uppercase tracking-wider ${getMethodColor(method)}`}
                          >
                            {method}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-xs text-industrial-300">
                          {record.shift || 'General Shift'}
                        </td>

                        <td className="px-4 py-3 font-mono text-xs text-industrial-300">
                          {formatDate(record.created_at)}
                        </td>

                        <td className="px-4 py-3 font-mono text-xs text-industrial-300">
                          {formatTime(record.created_at)}
                        </td>

                        <td className="px-4 py-3 font-mono text-xs text-industrial-300">
                          {displayConfidence(record)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              if (!canDelete) return
                              deleteRecord(record.id)
                            }}
                            disabled={!canDelete}
                            title={
                              canDelete
                                ? 'Delete record'
                                : 'Only admin or record creator can delete this record'
                            }
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded border font-mono text-xs transition-colors ${
                              canDelete
                                ? 'border-alert-red/50 text-alert-red hover:text-alert-red hover:bg-alert-red/20'
                                : 'border-industrial-700 text-industrial-600 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>
    </div>
  )
}