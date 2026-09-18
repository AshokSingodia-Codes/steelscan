import { useState, useEffect, useCallback } from 'react'
import { scannerApi } from '../api/scannerApi'

export function useBackendStatus() {
  const [online, setOnline] = useState(true)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      await scannerApi.ping()
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [check])

  return { online, checking, check }
}
