import { motion } from 'framer-motion'

export function LoadingSpinner({ size = 40, label = 'Processing...' }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary"
        />
        {/* Spinning arc */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner pulse */}
        <motion.div
          className="absolute inset-2 rounded-full bg-primary"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      </div>
      {label && (
        <div className="font-mono text-xs text-primary/70 tracking-widest uppercase">
          {label}
        </div>
      )}
    </div>
  )
}
