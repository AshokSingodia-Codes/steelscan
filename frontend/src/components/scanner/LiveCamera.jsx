import { useRef, useCallback, useState } from 'react'
import Webcam from 'react-webcam'
import { motion } from 'framer-motion'
import { FlipHorizontal, Zap, Upload, Disc, AlignLeft } from 'lucide-react'
import { ScannerOverlay } from './ScannerOverlay'
import { useScannerStore } from '../../store/scannerStore'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'

export function LiveCamera({ onCapture, onUpload }) {
  const webcamRef = useRef(null)
  const fileRef = useRef(null)
  const { facingMode, toggleCamera } = useScannerStore()

  // Target reticle mode: 'circular' (iron coil rim) or 'linear' (straight stencil)
  const [reticleMode, setReticleMode] = useState('circular')
  const [cameraError, setCameraError] = useState(null)

  const handleCapture = useCallback(() => {
    const screenshotSrc = webcamRef.current?.getScreenshot()
    if (!screenshotSrc) return
    onCapture(screenshotSrc)
  }, [onCapture])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.target.value = ''
  }, [onUpload])

  const toggleReticleMode = () => {
    setReticleMode((prev) => (prev === 'circular' ? 'linear' : 'circular'))
  }

  useKeyboardShortcuts({
    enter: handleCapture,
    c: toggleReticleMode,
  })

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Camera viewport */}
      <div className="relative flex-1 rounded-xl overflow-hidden bg-industrial-950 border border-industrial-600 shadow-card min-h-0">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.92}
          videoConstraints={{
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }}
          className="absolute inset-0 w-full h-full object-cover"
          onUserMediaError={(err) => {
            console.error('Camera error:', err)
            if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
              setCameraError('Camera access requires HTTPS or localhost. Please use a secure connection.')
            } else {
              setCameraError('Camera access denied or unavailable. Please check permissions.')
            }
          }}
        />
        <ScannerOverlay scanning={false} mode={reticleMode} />

        {/* Top bar controls */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
          {/* Status badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-industrial-800/80 border border-industrial-600 rounded-lg backdrop-blur-md shadow-sm">
            <div className="w-2 h-2 rounded-full bg-signal-green animate-pulse" />
            <span className="font-mono text-xs font-semibold text-industrial-50 tracking-wider">LIVE STREAM</span>
            <span className="hidden sm:inline font-mono text-[10px] text-brass-500 ml-1 border-l border-industrial-600 pl-2">
              0-9 DIGIT FOCUS
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Reticle mode toggle button */}
            <button
              onClick={toggleReticleMode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-industrial-800/80 border border-industrial-600 rounded-lg
                         text-industrial-200 hover:text-scan-cyan hover:border-scan-cyan transition-all backdrop-blur-md font-mono text-xs shadow-sm"
              title="C — Toggle reticle alignment (Circular vs Linear)"
            >
              {reticleMode === 'circular' ? <Disc size={15} className="text-scan-cyan" /> : <AlignLeft size={15} className="text-molten-amber" />}
              <span className="hidden sm:inline uppercase">{reticleMode === 'circular' ? 'Circular Rim' : 'Linear Stencil'}</span>
            </button>

            {/* Flip camera */}
            <button
              onClick={toggleCamera}
              className="p-2 bg-industrial-800/80 border border-industrial-600 rounded-lg
                         text-industrial-200 hover:text-scan-cyan hover:border-scan-cyan transition-all backdrop-blur-md shadow-sm"
              title="Flip camera mode"
            >
              <FlipHorizontal size={16} />
            </button>
          </div>
        </div>

        {cameraError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-industrial-950/90 backdrop-blur-sm p-6 text-center">
            <div className="glass-card p-6 rounded-xl border border-alert-red max-w-sm">
              <div className="w-12 h-12 rounded-full bg-alert-red/20 text-alert-red flex items-center justify-center mx-auto mb-4">
                <Zap size={24} />
              </div>
              <h3 className="font-display text-xl text-industrial-100 mb-2">Camera Unavailable</h3>
              <p className="font-mono text-xs text-alert-red">{cameraError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Industrial Glove-Optimized Action Buttons (>54px height) */}
      <div className="flex gap-3">
        <button
          onClick={handleCapture}
          className="btn-primary flex-1 flex items-center justify-center gap-3 py-4 sm:py-5 min-h-[56px] text-base sm:text-lg"
        >
          <Zap size={22} className="animate-pulse" />
          <span>CAPTURE CODE</span>
          <span className="hidden md:inline text-industrial-950/60 text-xs ml-1 font-normal">[ENTER]</span>
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className="btn-ghost flex items-center justify-center gap-2 px-6 py-4 sm:py-5 min-h-[56px]"
        >
          <Upload size={18} />
          <span className="hidden sm:inline">Upload Image</span>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Keyboard hints banner */}
      <div className="hidden md:flex items-center justify-between text-industrial-400 font-mono text-xs px-1">
        <div className="flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-industrial-800 shadow-sm border border-industrial-600 rounded text-industrial-200">Enter</kbd> Capture
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-industrial-800 shadow-sm border border-industrial-600 rounded text-industrial-200">C</kbd> Toggle Reticle Mode
          </span>
        </div>
        <div className="text-scan-cyan/60">
          ● TARGET: 0-9 NUMERIC COIL CODE
        </div>
      </div>
    </div>
  )
}

