import { useRef, useCallback } from 'react'
import { triggerHaptic } from '@/lib/haptics'

const LONG_PRESS_MS = 500
const TAP_MOVE_THRESHOLD = 14

export function useLongPress(onLongPress: () => void, onTap?: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)
  const movedRef = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const startTs = useRef(0)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      isLongPressRef.current = false
      movedRef.current = false
      startPos.current = { x: e.clientX, y: e.clientY }
      startTs.current = Date.now()
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        triggerHaptic('medium')
        onLongPress()
      }, LONG_PRESS_MS)
    },
    [onLongPress]
  )

  const onPointerUp = useCallback(
    () => {
      clear()
      const elapsed = Date.now() - startTs.current
      if (!isLongPressRef.current && !movedRef.current && elapsed < LONG_PRESS_MS && onTap) {
        onTap()
      }
    },
    [clear, onTap]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dx = Math.abs(e.clientX - startPos.current.x)
      const dy = Math.abs(e.clientY - startPos.current.y)
      if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) {
        movedRef.current = true
        clear()
      }
    },
    [clear]
  )

  const onPointerCancel = useCallback(() => {
    movedRef.current = true
    clear()
  }, [clear])

  return {
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onPointerCancel,
  }
}
