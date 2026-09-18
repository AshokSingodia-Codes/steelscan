import { Modal } from '../ui/Modal'
import { ConfidenceBadge } from '../ui/ConfidenceBadge'
import {
  Clock,
  Database,
  FileText,
  Hash,
  Upload,
  UserRound,
} from 'lucide-react'

function formatTs(ts) {
  if (!ts) return '—'

  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'long',
      timeStyle: 'medium',
      hour12: false,
    }).format(new Date(ts))
  } catch {
    return ts
  }
}

function isUploadedRecord(record) {
  const sourceType = String(record?.source_type || '').toUpperCase()
  const pipeline = String(record?.pipeline || '').toLowerCase()

  return (
    sourceType === 'CSV_UPLOAD' ||
    sourceType === 'PDF_UPLOAD' ||
    pipeline.includes('csv-upload') ||
    pipeline.includes('csv-import')
  )
}

function displayMethod(record) {
  const pipeline = String(record?.pipeline || 'ocr').toLowerCase()

  if (isUploadedRecord(record)) return 'UPLOADED'
  if (pipeline.includes('manual')) return 'MANUAL'
  if (pipeline.includes('edited')) return 'EDITED'
  if (pipeline.includes('roi')) return 'ROI-HYBRID'
  if (pipeline.includes('fast')) return 'OCR'
  if (pipeline.includes('ocr')) return 'OCR'

  return pipeline.toUpperCase()
}

export function RecordDetailsModal({ record, onClose }) {
  if (!record) return null

  const uploaded = isUploadedRecord(record)

  return (
    <Modal
      open={!!record}
      onClose={onClose}
      title={`RECORD #${record.id}`}
      width="max-w-3xl"
    >
      <div className="space-y-5">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-2">
              Captured Image
            </div>

            <div className="aspect-video rounded-lg overflow-hidden bg-industrial-50 border border-industrial-200">
              {record.raw_image_url ? (
                <img
                  src={record.raw_image_url}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-industrial-400 font-mono text-xs">
                  NO IMAGE
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-2">
              Processed Image
            </div>

            <div className="aspect-video rounded-lg overflow-hidden bg-industrial-50 border border-primary">
              {(record.processed_image_url || record.raw_image_url) ? (
                <img
                  src={record.processed_image_url || record.raw_image_url}
                  alt="Processed"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-industrial-400 font-mono text-xs">
                  NO IMAGE
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-lg p-4">
          <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText size={11} />
            Coil Code
          </div>

          <div className="font-mono text-xl text-primary tracking-widest break-all">
            {record.code || '(no text)'}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card rounded-lg p-3">
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Hash size={10} />
              System ID
            </div>

            <div className="font-mono text-sm text-industrial-700">
              {record.id}
            </div>
          </div>

          <div className="glass-card rounded-lg p-3">
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <UserRound size={10} />
              Employee ID
            </div>

            <div className="font-mono text-sm text-cyan-300">
              {record.created_by_username || '—'}
            </div>
          </div>

          <div className="glass-card rounded-lg p-3">
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5">
              Confidence
            </div>

            {uploaded ? (
              <div className="font-mono text-sm text-industrial-600">—</div>
            ) : (
              <ConfidenceBadge confidence={record.confidence} />
            )}
          </div>

          <div className="glass-card rounded-lg p-3">
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock size={10} />
              Record Time
            </div>

            <div className="font-mono text-xs text-industrial-600">
              {formatTs(record.created_at)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="glass-card rounded-lg p-3">
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5">
              Shift
            </div>

            <div className="font-mono text-sm text-industrial-700">
              {record.shift || 'General Shift'}
            </div>
          </div>

          <div className="glass-card rounded-lg p-3">
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5">
              Method
            </div>

            <div className="font-mono text-sm text-industrial-700 uppercase">
              {displayMethod(record)}
            </div>
          </div>

          <div className="glass-card rounded-lg p-3">
            <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5">
              Latency
            </div>

            <div className="font-mono text-sm text-industrial-700">
              {uploaded ? '—' : `${record.latency_ms ?? 0} ms`}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-lg p-3">
          <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Database size={11} />
            Source / Audit
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <div className="font-mono text-[10px] text-industrial-300 uppercase tracking-wider">
                Source Type
              </div>

              <div className="font-mono text-xs text-industrial-600">
                {record.source_type || 'DAILY_RECORD'}
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] text-industrial-300 uppercase tracking-wider">
                Source CSV ID
              </div>

              <div className="font-mono text-xs text-industrial-600">
                {record.source_record_id || '—'}
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] text-industrial-300 uppercase tracking-wider">
                Source File
              </div>

              <div className="font-mono text-xs text-industrial-600 break-all">
                {record.source_file_name || '—'}
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] text-industrial-300 uppercase tracking-wider flex items-center gap-1">
                <Upload size={10} />
                Uploaded By
              </div>

              <div className="font-mono text-xs text-industrial-600">
                {record.uploaded_by || '—'}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="font-mono text-[10px] text-industrial-300 uppercase tracking-wider">
                Uploaded At
              </div>

              <div className="font-mono text-xs text-industrial-600">
                {formatTs(record.uploaded_at)}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-lg p-3">
          <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5">
            Message
          </div>

          <div className="font-mono text-xs text-industrial-600">
            {record.message || '—'}
          </div>
        </div>
      </div>
    </Modal>
  )
}