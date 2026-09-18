import { useState } from 'react'
import { scannerApi } from '../api/scannerApi'
import { toast } from '../store/toastStore'
import { useShiftStore } from '../store/shiftStore'

export default function ManualEntryPage() {
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

  const { currentShift } = useShiftStore()

  const cleanCode = code.replace(/\D/g, '')
  const isValid = cleanCode.length >= 8 && cleanCode.length <= 16

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isValid) {
      toast.error('Enter valid 8–16 digit code')
      return
    }

    setSaving(true)

    try {
      await scannerApi.saveRecord({
        code: cleanCode,
        success: true,
        confidence: 1,
        vote_count: 0,
        total_votes: 0,
        latency_ms: 0,
        pipeline: 'manual',
        shift: currentShift || 'General Shift',
        message: 'Manually entered by operator',
      })

      toast.success(`Manual record saved — ${currentShift}`)
      setCode('')
    } catch (err) {
      console.error(err)

      const msg = err.isNetworkError
        ? 'Backend offline — cannot save manual record'
        : err.response?.data?.detail || 'Failed to save manual record'

      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-industrial-700 bg-industrial-950/80 backdrop-blur-md">
        <h1 className="font-display text-3xl tracking-widest text-industrial-100 drop-shadow-md">
          MANUAL ENTRY
        </h1>

        <p className="font-mono text-xs text-industrial-400 tracking-wider mt-1">
          ADD COIL CODE WITHOUT SCANNING
        </p>

        <p className="font-mono text-xs text-scan-cyan tracking-wider mt-2 font-bold drop-shadow-[0_0_5px_rgba(0,229,255,0.4)]">
          CURRENT SHIFT: {currentShift}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-xl rounded-xl border border-industrial-700 bg-industrial-900 shadow-card p-6"
        >
          <label className="block font-mono text-xs uppercase tracking-wider text-industrial-400 mb-2">
            Coil Numeric Code
          </label>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="Example: 9021876543"
            inputMode="numeric"
            autoFocus
            className="w-full px-4 py-4 rounded-lg bg-industrial-950 border border-industrial-700 text-industrial-100 font-mono text-xl tracking-widest outline-none focus:border-scan-cyan focus:shadow-[0_0_10px_rgba(0,229,255,0.2)]"
          />

          <div className="mt-3 font-mono text-xs">
            {cleanCode.length === 0 && (
              <span className="text-industrial-400">Enter 8–16 digit coil code</span>
            )}

            {cleanCode.length > 0 && !isValid && (
              <span className="text-molten-amber drop-shadow-[0_0_5px_rgba(255,109,0,0.4)]">Code must be 8–16 digits</span>
            )}

            {isValid && (
              <span className="text-signal-green drop-shadow-[0_0_5px_rgba(0,230,118,0.4)]">Valid code ready to save</span>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-industrial-700 bg-industrial-800/80 p-4 font-mono text-xs">
            <div className="flex justify-between py-1">
              <span className="text-industrial-400">Method</span>
              <span className="text-industrial-300">manual</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-industrial-400">Shift</span>
              <span className="text-industrial-300">{currentShift}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-industrial-400">OCR latency</span>
              <span className="text-industrial-300">0 ms</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-industrial-400">Timestamp</span>
              <span className="text-industrial-300">auto from database</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isValid || saving}
            className="mt-6 w-full px-5 py-4 rounded-lg bg-scan-cyan border border-scan-cyan text-industrial-950 hover:shadow-glow-cyan transition-shadow font-bold disabled:opacity-40 disabled:cursor-not-allowed font-mono text-sm uppercase tracking-widest"
          >
            {saving ? 'Saving...' : 'Save Manual Record'}
          </button>
        </form>
      </div>
    </div>
  )
}