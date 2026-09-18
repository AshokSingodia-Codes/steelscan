import { motion } from 'framer-motion'

const CORNER_SIZE = 32
const CORNER_THICKNESS = 3

function Corner({ position, color = '#35D6E8' }) {
  const styles = {
    tl: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
    tr: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
    bl: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
    br: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  }

  return (
    <div
      className="absolute transition-all duration-300 corner-blink"
      style={{
        ...styles[position],
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderColor: color,
        boxShadow: `0 0 10px ${color}66`,
      }}
    />
  )
}

export function ScannerOverlay({ scanning = false, mode = 'circular' }) {
  const isCircular = mode === 'circular'
  const accentColor = '#35D6E8' // scan-cyan

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden">
      {/* Background Dimming (HMI Style) */}
      <div className="absolute inset-0 bg-industrial-950/40" />

      {/* Corner framing */}
      <motion.div
        className="absolute inset-5 sm:inset-8"
        animate={{ opacity: scanning ? [1, 0.4, 1] : [1, 0.7, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <Corner position="tl" color={accentColor} />
        <Corner position="tr" color={accentColor} />
        <Corner position="bl" color={accentColor} />
        <Corner position="br" color={accentColor} />
      </motion.div>

      {/* Target Reticle: Circular Iron Coil Ring vs Linear Stencil */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isCircular ? (
          /* Circular Coil Ring Reticle */
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
            {/* Outer Ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-dashed border-scan-cyan"
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            />

            {/* Inner Ring */}
            <div className="absolute inset-6 rounded-full border border-scan-cyan" />
            <div className="absolute inset-12 rounded-full border border-scan-cyan/50" />

            {/* Radial Ticks */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-full h-full flex justify-between items-center pointer-events-none"
                style={{ transform: `rotate(${i * 30}deg)` }}
              >
                <div className="w-2.5 h-0.5 bg-scan-cyan" />
                <div className="w-2.5 h-0.5 bg-scan-cyan" />
              </div>
            ))}

            {/* Center Crosshair */}
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div className="absolute w-full h-px bg-scan-cyan" />
              <div className="absolute h-full w-px bg-scan-cyan" />
              <div className="w-3 h-3 border-2 border-scan-cyan rounded-full animate-ping" />
            </div>

            {/* Circular Arc Alignment Tag */}
            <div className="absolute -bottom-6 font-mono text-[10px] text-scan-cyan tracking-widest uppercase bg-industrial-800 px-2 py-0.5 rounded border border-scan-cyan">
              CIRCULAR COIL RIM ALIGNMENT
            </div>
          </div>
        ) : (
          /* Linear Stencil Reticle */
          <div className="relative w-72 h-36 sm:w-96 sm:h-44 border border-scan-cyan/40 rounded flex items-center justify-center bg-scan-cyan/5">
            <div className="absolute inset-x-0 top-1/2 h-px bg-scan-cyan/50" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-scan-cyan/50" />

            <div className="absolute -bottom-6 font-mono text-[10px] text-scan-cyan tracking-widest uppercase bg-industrial-800 px-2 py-0.5 rounded border border-scan-cyan/30">
              LINEAR STENCIL ALIGNMENT
            </div>
          </div>
        )}
      </div>

      {/* Laser Scanline Beam */}
      {scanning && (
        <div className="absolute inset-x-5 inset-y-5 overflow-hidden">
          <motion.div
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-scan-cyan to-transparent"
            style={{ boxShadow: '0 0 15px #35D6E8, 0 0 30px #35D6E8' }}
            animate={{ top: ['4px', 'calc(100% - 8px)', '4px'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      )}

      {/* Top Status & Target Lock Bar */}
      <div className="absolute top-8 inset-x-0 flex justify-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-industrial-800/80 border border-industrial-600 rounded-full backdrop-blur-md shadow-lg">
          <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-scan-cyan animate-pulse' : 'bg-signal-green'}`} />
          <span className="font-mono text-xs text-industrial-50 tracking-widest uppercase font-bold">
            {scanning ? 'PROCESSING OCR INFERENCE...' : 'TARGET READY • 0-9 NUMERIC DIGITS'}
          </span>
        </div>
      </div>

      {/* Side Ruler Gauge Ticks */}
      <div className="absolute left-3 top-8 bottom-8 flex flex-col justify-between py-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`h-px bg-scan-cyan/60 ${i % 2 === 0 ? 'w-4' : 'w-2'}`} />
        ))}
      </div>
      <div className="absolute right-3 top-8 bottom-8 flex flex-col justify-between py-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`h-px bg-scan-cyan/60 ml-auto ${i % 2 === 0 ? 'w-4' : 'w-2'}`} />
        ))}
      </div>
    </div>
  )
}

