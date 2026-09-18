import { motion } from 'framer-motion'
import { useScannerStore } from '../../store/scannerStore'
import { ScannerOverlay } from './ScannerOverlay'

const STEPS = [
  'Detecting iron coil rim curvature...',
  'Applying Polar Unwarping (cv2.warpPolar)...',
  'Locking 0-9 Numeric Digit OCR Vocabulary...',
  'Evaluating ROI candidate contours...',
  'Applying Bayesian Confusion Matrix Rescoring...',
]

export function ProcessingView() {
  const { capturedImage } = useScannerStore()

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Preview with scan overlay */}
      <div className="relative flex-1 rounded-xl overflow-hidden bg-industrial-50 border border-primary shadow-sm min-h-0">
        {capturedImage && (
          <img
            src={capturedImage}
            alt="Captured"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        )}
        <ScannerOverlay scanning={true} mode="circular" />

        {/* Processing overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-industrial-50 backdrop-blur-xs">
          {/* Radar ring animation */}
          <div className="relative w-28 h-28 mb-6">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-primary"
                style={{ inset: `${i * 10}px` }}
                animate={{ opacity: [0.9, 0.2, 0.9], scale: [0.94, 1.06, 0.94] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.25 }}
              />
            ))}
            <motion.div
              className="absolute inset-5 rounded-full bg-primary flex items-center justify-center border border-primary"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <motion.div
                className="w-5 h-5 bg-primary rounded-sm"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
              />
            </motion.div>
          </div>

          {/* Cycling status messages */}
          <div className="h-7 overflow-hidden px-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                className="font-mono text-xs sm:text-sm text-primary font-semibold tracking-wider text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: [8, 0, 0, -8],
                }}
                transition={{
                  duration: 1.1,
                  delay: i * 1.1,
                  repeat: Infinity,
                  repeatDelay: (STEPS.length - 1) * 1.1,
                }}
              >
                {step}
              </motion.div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-4 w-56 h-1 bg-white shadow-sm rounded-full overflow-hidden border border-industrial-200">
            <motion.div
              className="h-full bg-primary rounded-full shadow-sm"
              animate={{ x: ['-100%', '0%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="glass-card rounded-xl px-4 py-3.5 flex items-center gap-3 border-primary">
        <motion.div
          className="w-3 h-3 rounded-full bg-primary shadow-sm"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
        <span className="font-mono text-xs sm:text-sm text-primary font-bold tracking-widest uppercase">
          POLAR UNWARPING & 0-9 OCR INFERENCE IN PROGRESS
        </span>
      </div>
    </div>
  )
}

