import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useBackendStatus } from '../../hooks/useBackendStatus'

export function OfflineBanner() {
  const { online, checking, check } = useBackendStatus()

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3
                     bg-rose-950/90 border-b border-rose-700/60 backdrop-blur-sm py-2 px-4"
        >
          <WifiOff size={14} className="text-rose-400" />
          <span className="font-mono text-xs text-rose-300 tracking-wider uppercase">
            Backend Offline — http://127.0.0.1:8000 unreachable
          </span>
          <button
            onClick={check}
            disabled={checking}
            className="ml-2 text-rose-400 hover:text-rose-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
