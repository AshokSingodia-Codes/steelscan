import { useCallback, useRef } from 'react'
import { useScannerStore, SCANNER_PHASE } from '../store/scannerStore'
import { scannerApi } from '../api/scannerApi'
import { toast } from '../store/toastStore'
import { useShiftStore } from '../store/shiftStore'

export function useScanActions() {
  const scanLockRef = useRef(false)
  const saveLockRef = useRef(false)

  const {
    phase,
    setCaptured,
    setResult,
    setError,
    setProcessing,
    resetToLive,
  } = useScannerStore()

  const submitImage = useCallback(
    async (file, dataUrl) => {
      const latestPhase = useScannerStore.getState().phase

      if (
        scanLockRef.current ||
        latestPhase === SCANNER_PHASE.PROCESSING
      ) {
        toast.info('OCR scan is already processing. Please wait.')
        return
      }

      scanLockRef.current = true

      setCaptured(dataUrl)
      setProcessing()

      try {
        const response = await scannerApi.scan(file)

        setResult({
          processedImage: response.processed_image || response.image || dataUrl,
          ocrText: response.code || '',
          confidence: response.confidence ?? 0,
          timestamp: response.timestamp || new Date().toISOString(),
          pipeline: response.pipeline || 'ocr',
          success: response.success ?? true,
          latency_ms: response.latency_ms || 0,
          vote_count: response.vote_count || 1,
          total_votes: response.total_votes || 1,
          message: response.message || 'OK',
        })

        toast.success('Scan complete')
      } catch (err) {
        console.error(err)

        const msg = err.isNetworkError
          ? 'Backend offline — check server connection'
          : err.isOcrBusy
            ? 'OCR engine is busy. Another scan is currently being processed. Please wait and try again.'
            : err.response?.data?.detail || 'OCR processing failed'

        setError(msg)
        toast.error(msg)
      } finally {
        setTimeout(() => {
          scanLockRef.current = false
        }, 800)
      }
    },
    [setCaptured, setProcessing, setResult, setError]
  )

  const handleCapture = useCallback(
    async (screenshotSrc) => {
      if (!screenshotSrc) {
        toast.error('Camera capture failed')
        return
      }

      const latestPhase = useScannerStore.getState().phase

      if (latestPhase === SCANNER_PHASE.PROCESSING) {
        toast.info('OCR scan is already processing. Please wait.')
        return
      }

      const res = await fetch(screenshotSrc)
      const blob = await res.blob()

      const file = new File([blob], `capture_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })

      await submitImage(file, screenshotSrc)
    },
    [submitImage]
  )

  const handleFileUpload = useCallback(
    async (file) => {
      if (!file) return

      const latestPhase = useScannerStore.getState().phase

      if (latestPhase === SCANNER_PHASE.PROCESSING) {
        toast.info('OCR scan is already processing. Please wait.')
        return
      }

      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader()

        reader.onload = (e) => resolve(e.target.result)

        reader.readAsDataURL(file)
      })

      await submitImage(file, dataUrl)
    },
    [submitImage]
  )

  const retry = useCallback(() => {
    resetToLive(true)
    toast.info('Scan discarded')
  }, [resetToLive])

  const saveAndContinue = useCallback(
    async (editedCode = null) => {
      if (saveLockRef.current) {
        return
      }

      const latestState = useScannerStore.getState()
      const latestShift =
        useShiftStore.getState().currentShift || 'General Shift'

      const finalCode = String(
        editedCode ?? latestState.ocrText ?? ''
      ).replace(/\D/g, '')

      if (finalCode.length < 8 || finalCode.length > 16) {
        toast.error('No valid code to save. Click Edit and enter 8–16 digit code.')
        return
      }

      saveLockRef.current = true

      try {
        await scannerApi.saveRecord({
          code: finalCode,
          success: latestState.success ?? true,

          confidence:
            editedCode !== null
              ? 1
              : latestState.confidence || 0,

          vote_count: latestState.vote_count || 1,
          total_votes: latestState.total_votes || 1,
          latency_ms: latestState.latency_ms || 0,

          pipeline:
            editedCode !== null
              ? 'edited'
              : latestState.pipeline || 'ocr',

          shift: latestShift,

          message:
            editedCode !== null
              ? 'OCR text manually corrected by operator'
              : latestState.message || 'Saved from frontend',
        })

        toast.success(`Record saved successfully — ${latestShift}`)
        resetToLive(true)
      } catch (err) {
        console.error(err)

        const msg = err.isNetworkError
          ? 'Backend offline — cannot save record'
          : err.response?.data?.detail || 'Failed to save record'

        toast.error(msg)
      } finally {
        setTimeout(() => {
          saveLockRef.current = false
        }, 800)
      }
    },
    [resetToLive]
  )

  const back = useCallback(() => {
    const latestPhase = useScannerStore.getState().phase

    if (latestPhase === SCANNER_PHASE.PROCESSING) {
      toast.info('OCR is still processing. Please wait.')
      return
    }

    if (
      latestPhase === SCANNER_PHASE.REVIEW ||
      latestPhase === SCANNER_PHASE.ERROR
    ) {
      resetToLive(true)
    }
  }, [resetToLive])

  return {
    handleCapture,
    handleFileUpload,
    retry,
    saveAndContinue,
    back,
    phase,
  }
}