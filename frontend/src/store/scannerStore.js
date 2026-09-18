import { create } from 'zustand'

export const SCANNER_PHASE = {
  LIVE: 'live',
  PROCESSING: 'processing',
  REVIEW: 'review',
  ERROR: 'error',
}

const USER_KEY = 'steelscan_auth_user'
const SCANNER_SESSION_KEY = 'steelscan_scanner_session'

function getCurrentUsername() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    const user = raw ? JSON.parse(raw) : null
    return user?.username || null
  } catch {
    return null
  }
}

const emptyScannerState = {
  phase: SCANNER_PHASE.LIVE,

  capturedImage: null,
  processedImage: null,

  ocrText: '',
  confidence: null,
  timestamp: null,

  pipeline: null,
  success: null,
  latency_ms: null,
  vote_count: null,
  total_votes: null,
  message: null,

  errorMessage: null,
}

function saveScannerSession(state) {
  try {
    const safeState = {
      phase: state.phase,
      capturedImage: state.capturedImage,
      processedImage: state.processedImage,

      ocrText: state.ocrText,
      confidence: state.confidence,
      timestamp: state.timestamp,

      pipeline: state.pipeline,
      success: state.success,
      latency_ms: state.latency_ms,
      vote_count: state.vote_count,
      total_votes: state.total_votes,
      message: state.message,

      errorMessage: state.errorMessage,
      activeScanOwner: state.activeScanOwner,
      activeScanStartedAt: state.activeScanStartedAt,
    }

    sessionStorage.setItem(
      SCANNER_SESSION_KEY,
      JSON.stringify(safeState)
    )
  } catch {
    // ignore storage errors
  }
}

function loadScannerSession() {
  try {
    const raw = sessionStorage.getItem(SCANNER_SESSION_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const currentUsername = getCurrentUsername()

    if (!currentUsername) {
      sessionStorage.removeItem(SCANNER_SESSION_KEY)
      return null
    }

    if (
      parsed.activeScanOwner &&
      parsed.activeScanOwner !== currentUsername
    ) {
      sessionStorage.removeItem(SCANNER_SESSION_KEY)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function clearScannerSession() {
  try {
    sessionStorage.removeItem(SCANNER_SESSION_KEY)
  } catch {
    // ignore storage errors
  }
}

export const useScannerStore = create((set, get) => {
  const restored = loadScannerSession()

  return {
    ...emptyScannerState,
    ...(restored || {}),

    facingMode: 'environment',

    activeScanOwner: restored?.activeScanOwner || null,
    activeScanStartedAt: restored?.activeScanStartedAt || null,

    setPhase: (phase) =>
      set((state) => {
        const next = {
          ...state,
          phase,
        }

        saveScannerSession(next)
        return next
      }),

    setCaptured: (dataUrl) =>
      set((state) => {
        const next = {
          ...state,
          capturedImage: dataUrl,
        }

        saveScannerSession(next)
        return next
      }),

    setProcessing: () =>
      set((state) => {
        const next = {
          ...state,
          phase: SCANNER_PHASE.PROCESSING,
          errorMessage: null,
          activeScanOwner: getCurrentUsername(),
          activeScanStartedAt: new Date().toISOString(),
        }

        saveScannerSession(next)
        return next
      }),

    setResult: ({
      processedImage,
      ocrText,
      confidence,
      timestamp,
      pipeline,
      success,
      latency_ms,
      vote_count,
      total_votes,
      message,
    }) =>
      set((state) => {
        const currentUsername = getCurrentUsername()

        if (!currentUsername) {
          return state
        }

        if (
          state.activeScanOwner &&
          state.activeScanOwner !== currentUsername
        ) {
          return state
        }

        const next = {
          ...state,

          processedImage,
          ocrText,
          confidence,
          timestamp,

          pipeline,
          success,
          latency_ms,
          vote_count,
          total_votes,
          message,

          phase: SCANNER_PHASE.REVIEW,
          errorMessage: null,
        }

        saveScannerSession(next)
        return next
      }),

    updateOcrText: (ocrText) =>
      set((state) => {
        const next = {
          ...state,
          ocrText,
          pipeline: 'edited',
          message: 'OCR text manually corrected by operator',
          success: true,
        }

        saveScannerSession(next)
        return next
      }),

    setError: (message) =>
      set((state) => {
        const currentUsername = getCurrentUsername()

        if (!currentUsername) {
          return state
        }

        if (
          state.activeScanOwner &&
          state.activeScanOwner !== currentUsername
        ) {
          return state
        }

        const next = {
          ...state,
          phase: SCANNER_PHASE.ERROR,
          errorMessage: message,
        }

        saveScannerSession(next)
        return next
      }),

    resetToLive: (force = false) =>
      set((state) => {
        /*
          Professional rule:
          Do not reset scanner while OCR is processing unless force=true.
          This prevents:
          Scanner → Records/Manual → Scanner showing LIVE while backend is busy.
        */
        if (!force && state.phase === SCANNER_PHASE.PROCESSING) {
          saveScannerSession(state)
          return state
        }

        clearScannerSession()

        return {
          ...emptyScannerState,
          facingMode: state.facingMode,
          activeScanOwner: null,
          activeScanStartedAt: null,
        }
      }),

    clearScannerForNewSession: () =>
      set((state) => {
        clearScannerSession()

        return {
          ...emptyScannerState,
          facingMode: state.facingMode,
          activeScanOwner: null,
          activeScanStartedAt: null,
        }
      }),

    clearScannerHard: () =>
      set(() => {
        clearScannerSession()

        return {
          ...emptyScannerState,
          facingMode: 'environment',
          activeScanOwner: null,
          activeScanStartedAt: null,
        }
      }),

    toggleCamera: () =>
      set((state) => {
        const next = {
          ...state,
          facingMode:
            state.facingMode === 'environment'
              ? 'user'
              : 'environment',
        }

        saveScannerSession(next)
        return next
      }),
  }
})