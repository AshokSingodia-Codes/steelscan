import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'

const ICONS = {
  success: <CheckCircle2 size={15} />,
  error: <XCircle size={15} />,
  info: <Info size={15} />,
  warn: <AlertTriangle size={15} />,
}

const COLORS = {
  success: 'border-l-4 border-l-signal-green bg-industrial-800/80 text-signal-green',
  error: 'border-l-4 border-l-alert-red bg-industrial-800/80 text-alert-red',
  info: 'border-l-4 border-l-scan-cyan bg-industrial-800/80 text-scan-cyan',
  warn: 'border-l-4 border-l-molten-amber bg-industrial-800/80 text-molten-amber',
}

export function Toaster() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.92 }}
            transition={{ duration: 0.22 }}
            className={`
              flex items-start gap-3 px-4 py-3 rounded border backdrop-blur-md
              font-mono text-xs tracking-wide pointer-events-auto
              shadow-lg ${COLORS[t.type]}
            `}
          >
            <span className="mt-0.5 flex-shrink-0">{ICONS[t.type]}</span>
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
