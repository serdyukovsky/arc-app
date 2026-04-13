import { useCallback, useEffect, useState } from 'react'

const KEY = 'coil.onboarding.completed.v1'

const read = (): boolean => {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function useOnboarding() {
  const [isOnboarded, setIsOnboarded] = useState<boolean>(read)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = globalThis as any
    root.resetOnboarding = () => {
      try {
        localStorage.removeItem(KEY)
      } catch {}
      setIsOnboarded(false)
    }
    root.completeOnboarding = () => {
      try {
        localStorage.setItem(KEY, '1')
      } catch {}
      setIsOnboarded(true)
    }
  }, [])

  const complete = useCallback(() => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
    setIsOnboarded(true)
  }, [])

  return { isOnboarded, complete }
}
