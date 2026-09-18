import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  RotateCcw,
  Save,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Crosshair,
  BrainCircuit,
  Sparkles,
} from 'lucide-react'
import { useScannerStore, SCANNER_PHASE } from '../../store/scannerStore'
import { ConfidenceBadge } from '../ui/ConfidenceBadge'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { toast } from '../../store/toastStore'

function formatTs(ts) {
  if (!ts) return '—'

  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      hour12: false,
    }).format(new Date(ts))
  } catch {
    return ts
  }
}

export function ReviewPanel({ onRetry, onSaveAndContinue, onBack }) {
  const {
    phase,
    capturedImage,
    processedImage,
    ocrText,
    confidence,
    timestamp,
    errorMessage,
    candidates = [],
    updateOcrText,
  } = useScannerStore()

  const isError = phase === SCANNER_PHASE.ERROR

  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(ocrText || '')

  useEffect(() => {
    setDraftText(ocrText || '')
  }, [ocrText])

  const cleanDraft = draftText.replace(/\D/g, '')
  const isValidDraft = cleanDraft.length >= 4 && cleanDraft.length <= 32

  // Unique alternative candidate digits from OCR engine for 1-tap picker
  const runnerUpCandidates = Array.from(
    new Set(
      (candidates || [])
        .map((c) => String(c).replace(/\D/g, ''))
        .filter((c) => c && c !== cleanDraft && c.length >= 4 && c.length <= 32)
    )
  ).slice(0, 4)

  const startEdit = () => {
    setIsEditing(true)
    setDraftText(ocrText || '')
  }

  const applyEdit = () => {
    if (!isValidDraft) {
      toast.error('Enter a valid numeric code')
      return
    }

    updateOcrText(cleanDraft)
    setDraftText(cleanDraft)
    setIsEditing(false)

    toast.success('OCR code updated — Learning engine trained!')
  }

  const selectCandidateChip = (candidateCode) => {
    setDraftText(candidateCode)
    updateOcrText(candidateCode)
    toast.success(`Selected candidate code: ${candidateCode}`)
  }

  const saveWithValidation = () => {
    if (isEditing) {
      if (!isValidDraft) {
        toast.error('Enter a valid numeric code')
        return
      }

      updateOcrText(cleanDraft)
      setDraftText(cleanDraft)
      setIsEditing(false)
      return
    }

    const currentCode = (ocrText || '').replace(/\D/g, '')

    if (currentCode.length < 4 || currentCode.length > 32) {
      toast.error('No valid code to save. Click Edit and enter code manually.')
      return
    }

    onSaveAndContinue()
  }

  useKeyboardShortcuts({
    enter: saveWithValidation,
    r: onRetry,
    escape: () => {
      if (isEditing) {
        setIsEditing(false)
        setDraftText(ocrText || '')
      } else {
        onBack()
      }
    },
  })

  return (
    <motion.div
      className="flex flex-col h-full gap-4 pb-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Status & Self-Learning Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border font-mono text-sm tracking-wider ${
            isError
              ? 'bg-alert-red/10 border-alert-red/20 text-alert-red'
              : 'bg-signal-green/10 border-signal-green/20 text-signal-green'
          }`}
        >
          {isError ? <XCircle size={16} /> : <CheckCircle2 size={16} />}

          <span className="uppercase font-semibold">
            {isError ? 'SCAN FAILED' : 'SCAN COMPLETE'}
          </span>

          {isError && (
            <span className="text-rose-500/80 text-xs ml-2">
              {errorMessage}
            </span>
          )}
        </div>

        {/* AI Reinforcement Badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-scan-cyan/10 border border-scan-cyan/20 rounded-lg text-scan-cyan font-mono text-xs shadow-sm">
          <BrainCircuit size={15} className="animate-pulse" />
          <span>AI REINFORCEMENT ACTIVE</span>
        </div>
      </div>

      {/* Image comparison */}
      <div className="grid grid-cols-2 gap-3 flex-shrink-0">
        <div>
          <div className="font-mono text-xs text-industrial-400 tracking-wider uppercase mb-1.5 flex items-center gap-1.5 font-semibold">
            <Crosshair size={12} className="text-brass-500" /> Camera Capture
          </div>

          <div className="aspect-video rounded-lg overflow-hidden bg-industrial-900 border border-industrial-700 shadow-md">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-industrial-600 text-xs font-mono">
                NO IMAGE
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="font-mono text-xs text-industrial-400 tracking-wider uppercase mb-1.5 flex items-center gap-1.5 font-semibold">
            <Sparkles size={12} className="text-scan-cyan" /> Unwarped ROI Result
          </div>

          <div
            className="aspect-video rounded-lg overflow-hidden bg-industrial-900 border border-scan-cyan/50 shadow-md"
            style={
              !isError
                ? { boxShadow: '0 0 16px rgba(0,229,255,0.15)' }
                : {}
            }
          >
            {processedImage ? (
              <img
                src={processedImage}
                alt="Processed"
                className="w-full h-full object-cover"
              />
            ) : capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured fallback"
                className="w-full h-full object-cover opacity-50"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-industrial-400 text-xs font-mono">
                {isError ? 'FAILED' : 'NO OUTPUT'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main OCR Result Card */}
      <div className="glass-card rounded-xl p-4 sm:p-5 flex-shrink-0 border-scan-cyan/30">
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider font-semibold">
            Detected Code (0-9 Digits)
          </div>

          {isEditing && (
            <div className="font-mono text-xs text-molten-amber uppercase tracking-wider font-bold animate-pulse">
              ● Editing Mode Enabled
            </div>
          )}
        </div>

        {isEditing ? (
          <div>
            <input
              value={draftText}
              onChange={(e) =>
                setDraftText(e.target.value.replace(/\D/g, ''))
              }
              placeholder="Enter numeric digits"
              inputMode="numeric"
              autoFocus
              className="w-full px-4 py-3.5 rounded-lg bg-industrial-900 border-2 border-brass-500
                         text-brass-500 font-mono text-xl sm:text-2xl font-bold tracking-widest outline-none
                         focus:ring-4 focus:ring-brass-500/40 transition-all shadow-inner"
            />

            <div className="mt-2 font-mono text-xs flex items-center justify-between">
              {cleanDraft.length === 0 ? (
                <span className="text-industrial-400">
                  Enter numeric coil code manually
                </span>
              ) : isValidDraft ? (
                <span className="text-signal-green font-semibold">
                  ✓ Valid numeric code ready to save
                </span>
              ) : (
                <span className="text-molten-amber font-semibold">
                  Code length must be valid digits
                </span>
              )}
              <span className="text-industrial-500 font-mono text-[10px]">
                System learns from your edits
              </span>
            </div>
          </div>
        ) : (
          <div
            className={`font-mono text-xl sm:text-3xl font-extrabold tracking-widest leading-none ${
              isError ? 'text-alert-red/80' : 'text-scan-cyan'
            }`}
          >
            {isError
              ? '— EXTRACTION FAILED —'
              : (ocrText || '(empty)')}
          </div>
        )}

        {/* 1-Tap Runner-Up Candidate Chips */}
        {runnerUpCandidates.length > 0 && (
          <div className="mt-3 pt-3 border-t border-industrial-800">
            <div className="font-mono text-[10px] text-industrial-400 uppercase tracking-wider mb-1.5 font-semibold">
              Quick Pick Candidate Suggestions:
            </div>
            <div className="flex flex-wrap gap-2">
              {runnerUpCandidates.map((cand, idx) => (
                <button
                  key={idx}
                  onClick={() => selectCandidateChip(cand)}
                  className="px-3 py-1 rounded bg-industrial-800 shadow-sm border border-industrial-600 text-scan-cyan hover:border-scan-cyan hover:bg-scan-cyan hover:text-industrial-950
                             font-mono text-xs tracking-wider transition-all select-none"
                  title="Click to select this candidate"
                >
                  {cand}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Meta Indicators Grid */}
      <div className="grid grid-cols-2 gap-3 flex-shrink-0">
        <div className="glass-card rounded-lg p-3">
          <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5 font-semibold">
            Confidence Index
          </div>
          <ConfidenceBadge confidence={isError ? null : confidence} />
        </div>

        <div className="glass-card rounded-lg p-3">
          <div className="font-mono text-xs text-industrial-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 font-semibold">
            <Clock size={12} className="text-brass-500" /> Scan Timestamp
          </div>
          <div className="font-mono text-xs text-industrial-200">
            {formatTs(timestamp)}
          </div>
        </div>
      </div>

      {/* Glove-Optimized Industrial Action Buttons */}
      <div className="flex gap-3 mt-auto pt-2">
        {/* Edit Button */}
        <motion.button
          onClick={isEditing ? applyEdit : startEdit}
          className="btn-ghost flex items-center justify-center gap-2 min-h-[52px] px-5"
          whileTap={{ scale: 0.96 }}
          title="Edit OCR code manually"
        >
          <Pencil size={18} />
          <span className="hidden sm:inline font-bold">
            {isEditing ? 'Apply Edit' : 'Edit Code'}
          </span>
        </motion.button>

        {/* Retry Button */}
        <motion.button
          onClick={onRetry}
          className="btn-accent flex items-center justify-center gap-2 flex-1 min-h-[52px]"
          whileTap={{ scale: 0.96 }}
          title="R — Retry scan"
        >
          <RotateCcw size={18} />
          <span className="font-bold">Retry</span>
          <span className="hidden md:inline opacity-50 text-xs font-normal">[R]</span>
        </motion.button>

        {/* Save & Continue Button */}
        <motion.button
          onClick={saveWithValidation}
          className="btn-primary flex items-center justify-center gap-2 flex-1 min-h-[52px] font-bold"
          whileTap={{ scale: 0.96 }}
          title="Enter — Save record & train AI engine"
        >
          <Save size={18} />
          <span>Save & Continue</span>
          <span className="hidden md:inline opacity-50 text-xs font-normal">[↵]</span>
        </motion.button>
      </div>
    </motion.div>
  )
}