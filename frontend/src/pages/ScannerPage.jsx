import { motion, AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'

import { useScannerStore, SCANNER_PHASE } from '../store/scannerStore'
import { useScanActions } from '../hooks/useScanActions'
import { LiveCamera } from '../components/scanner/LiveCamera'
import { ProcessingView } from '../components/scanner/ProcessingView'
import { ReviewPanel } from '../components/scanner/ReviewPanel'
import { OfflineBanner } from '../components/ui/OfflineBanner'

export default function ScannerPage() {
  const { phase } = useScannerStore()

  const {
    handleCapture,
    handleFileUpload,
    retry,
    saveAndContinue,
    back,
  } = useScanActions()

  const phaseLabel = {
    [SCANNER_PHASE.LIVE]: 'LIVE PREVIEW',
    [SCANNER_PHASE.PROCESSING]: 'PROCESSING',
    [SCANNER_PHASE.REVIEW]: 'REVIEW',
    [SCANNER_PHASE.ERROR]: 'ERROR',
  }[phase]

  const phaseColor = {
    [SCANNER_PHASE.LIVE]: 'text-signal-green drop-shadow-[0_0_5px_rgba(0,230,118,0.4)]',
    [SCANNER_PHASE.PROCESSING]: 'text-molten-amber drop-shadow-[0_0_5px_rgba(255,109,0,0.4)]',
    [SCANNER_PHASE.REVIEW]: 'text-scan-cyan drop-shadow-[0_0_5px_rgba(0,229,255,0.4)]',
    [SCANNER_PHASE.ERROR]: 'text-alert-red drop-shadow-[0_0_5px_rgba(255,51,102,0.4)]',
  }[phase]

  return (
    <div className="h-full flex flex-col">
      <OfflineBanner />

      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-industrial-700 bg-industrial-950/80 backdrop-blur-md">
        <div>
          <h1 className="font-display text-3xl tracking-widest text-industrial-100 leading-none drop-shadow-md">
            SCANNER DASHBOARD
          </h1>

          <div className="font-mono text-xs text-industrial-400 tracking-wider mt-0.5">
            INDUSTRIAL COIL CODE READER
          </div>
        </div>

        <div className={`flex items-center gap-2 font-mono text-xs tracking-widest uppercase ${phaseColor}`}>
          <Activity size={12} />
          {phaseLabel}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 md:p-6">
        <div className="h-full max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {phase === SCANNER_PHASE.LIVE && (
              <motion.div
                key="live"
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <LiveCamera
                  onCapture={handleCapture}
                  onUpload={handleFileUpload}
                />
              </motion.div>
            )}

            {phase === SCANNER_PHASE.PROCESSING && (
              <motion.div
                key="processing"
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ProcessingView />
              </motion.div>
            )}

            {(phase === SCANNER_PHASE.REVIEW || phase === SCANNER_PHASE.ERROR) && (
              <motion.div
                key="review"
                className="h-full overflow-y-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ReviewPanel
                  onRetry={retry}
                  onSaveAndContinue={saveAndContinue}
                  onBack={back}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}