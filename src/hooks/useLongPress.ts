import { useRef, useCallback } from 'react'
import { triggerHaptic } from '@/lib/haptics'

const LONG_PRESS_MS = 500

export function useLongPress(onLongPress: () => void, onTap?: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isLongPressRef.current = false
      startPos.current = { x: e.clientX, y: e.clientY }
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        triggerHaptic('medium')
        onLongPress()
      }, LONG_PRESS_MS)
    },
    [onLongPress]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      clear()
      if (!isLongPressRef.current && onTap) {
        onTap()
      }
    },
    [clear, onTap]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dx = Math.abs(e.clientX - startPos.current.x)
      const dy = Math.abs(e.clientY - startPos.current.y)
      if (dx > 10 || dy > 10) {
        clear()
      }
    },
    [clear]
  )

  const onPointerCancel = useCallback(() => {
    clear()
  }, [clear])

  return {
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onPointerCancel,
  }
}
