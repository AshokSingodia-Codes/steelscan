import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trash2, Search, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react'
import { ConfidenceBadge } from '../ui/ConfidenceBadge'
import { RecordDetailsModal } from './RecordDetailsModal'
import { useRecordsStore } from '../../store/recordsStore'

const PAGE_SIZE = 15

function formatTs(ts) {
  if (!ts) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      year:   '2-digit',
      month:  'short',
      day:    '2-digit',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(ts))
  } catch {
    return ts
  }
}

export function RecordsTable({ records }) {
  const { deleteRecord } = useRecordsStore()
  const [search,         setSearch]         = useState('')
  const [sortDir,        setSortDir]        = useState('desc')
  const [page,           setPage]           = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [deletingId,     setDeletingId]     = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records
      .filter((r) => {
        if (!q) return true
        // FIX: was r.ocr_text || r.text — backend sends r.code
        const text = (r.code || '').toLowerCase()
        return text.includes(q) || String(r.id).includes(q)
      })
      .sort((a, b) => {
        // FIX: was a.timestamp / b.timestamp — backend sends a.created_at
        const ta = new Date(a.created_at || 0).getTime()
        const tb = new Date(b.created_at || 0).getTime()
        return sortDir === 'desc' ? tb - ta : ta - tb
      })
  }, [records, search, sortDir])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const pageRecords = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleDelete = useCallback(async (e, id) => {
    e.stopPropagation()
    if (!window.confirm(`Delete record #${id}?`)) return
    setDeletingId(id)
    await deleteRecord(id)
    setDeletingId(null)
  }, [deleteRecord])

  const toggleSort = useCallback(() => {
    setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    setPage(1)
  }, [])

  const onSearch = useCallback((e) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Search + count */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-industrial-400" />
          <input
            type="text"
            value={search}
            onChange={onSearch}
            placeholder="Search coil code..."
            className="w-full pl-9 pr-4 py-2.5 bg-industrial-800 shadow-inner border border-industrial-600 rounded
                       font-mono text-sm text-industrial-200 placeholder-industrial-500
                       focus:outline-none focus:border-scan-cyan transition-colors"
          />
        </div>
        <div className="font-mono text-xs text-industrial-400 tracking-wider">
          {filtered.length} RECORDS
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-lg border border-industrial-700 flex flex-col min-h-0 bg-industrial-950/50 shadow-card">

        {/* Header */}
        <div className="flex-shrink-0 grid grid-cols-[40px_1fr_80px_auto_80px_48px_48px] gap-2
                        px-4 py-2.5 bg-industrial-900 shadow-sm border-b border-industrial-700">
          {['#', 'Coil Code', 'Conf.', 'Timestamp', 'Status', '', ''].map((col, i) => (
            <div
              key={i}
              className={`font-mono text-xs text-industrial-400 uppercase tracking-wider
                          ${i === 0 ? 'text-right' : ''}`}
            >
              {col === 'Timestamp' ? (
                <button
                  onClick={toggleSort}
                  className="flex items-center gap-1 hover:text-scan-cyan transition-colors"
                >
                  {col}
                  {sortDir === 'desc'
                    ? <ChevronDown size={11} />
                    : <ChevronUp  size={11} />}
                </button>
              ) : col}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {pageRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-industrial-500">
              <AlertCircle size={24} />
              <span className="font-mono text-sm tracking-wider">
                {search ? 'NO MATCHING RECORDS' : 'NO RECORDS FOUND'}
              </span>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {pageRecords.map((record) => (
                <motion.div
                  key={record.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setSelectedRecord(record)}
                  className={`
                    grid grid-cols-[40px_1fr_80px_auto_80px_48px_48px] gap-2
                    items-center px-4 py-2.5 cursor-pointer
                    border-b border-industrial-700 last:border-b-0
                    hover:bg-industrial-800/50 transition-colors duration-100
                    ${deletingId === record.id ? 'opacity-40' : ''}
                  `}
                >
                  {/* ID */}
                  <div className="font-mono text-xs text-industrial-400 text-right">
                    {record.id}
                  </div>

                  {/* Coil code — FIX: was r.ocr_text || r.text */}
                  <div className="font-mono text-sm text-scan-cyan truncate tracking-wider font-bold">
                    {record.code || '—'}
                  </div>

                  {/* Confidence */}
                  <div>
                    <ConfidenceBadge confidence={record.confidence} />
                  </div>

                  {/* Timestamp — FIX: was record.timestamp */}
                  <div className="font-mono text-xs text-industrial-500 whitespace-nowrap">
                    {formatTs(record.created_at)}
                  </div>

                  {/* Status */}
                  <div>
                    <span className={`status-badge ${
                      record.confidence >= 0.9
                        ? 'bg-signal-green/10 border border-signal-green/30 text-signal-green'
                        : record.confidence >= 0.7
                        ? 'bg-molten-amber/10 border border-molten-amber/30 text-molten-amber'
                        : 'bg-alert-red/10 border border-alert-red/30 text-alert-red'
                    }`}>
                      {record.confidence >= 0.9 ? 'HIGH'
                        : record.confidence >= 0.7 ? 'MED' : 'LOW'}
                    </span>
                  </div>

                  {/* Thumbnail — FIX: was r.image || r.processed_image */}
                  <div className="w-10 h-8 rounded overflow-hidden bg-industrial-800 shadow-sm
                                  border border-industrial-600 flex-shrink-0">
                    {(record.raw_image_url || record.processed_image_url) ? (
                      <img
                        src={record.raw_image_url || record.processed_image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-industrial-800" />
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(e, record.id)}
                    disabled={deletingId === record.id}
                    className="flex items-center justify-center w-8 h-8 rounded
                               text-industrial-500 hover:text-alert-red hover:bg-alert-red/10
                               transition-all duration-150 disabled:opacity-30 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5
                          bg-industrial-900 shadow-sm border-t border-industrial-700">
            <span className="font-mono text-xs text-industrial-400">
              PAGE {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded text-industrial-400 hover:text-scan-cyan
                           disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(totalPages - 6, safePage - 3)) + i
                if (pg > totalPages) return null
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-7 h-7 rounded font-mono text-xs transition-colors ${
                      pg === safePage
                        ? 'bg-scan-cyan text-industrial-950 border border-scan-cyan font-bold'
                        : 'text-industrial-400 hover:text-industrial-200'
                    }`}
                  >
                    {pg}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded text-industrial-400 hover:text-scan-cyan
                           disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <RecordDetailsModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  )
}