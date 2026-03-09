import { useState, useCallback, useRef } from 'react'

export interface ToastData {
  message: string
  onUndo?: () => void
}

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, onUndo })
    timerRef.current = setTimeout(() => {
      setToast(null)
    }, 3000)
  }, [])

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  return { toast, showToast, hideToast }
}
