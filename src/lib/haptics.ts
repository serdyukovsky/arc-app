function getTg() {
  if (typeof window === 'undefined') return null
  return (window as any).Telegram?.WebApp ?? null
}

export function triggerHaptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'selection' = 'light') {
  try {
    const hf = getTg()?.HapticFeedback
    if (hf) {
      if (kind === 'success') hf.notificationOccurred('success')
      else if (kind === 'warning') hf.notificationOccurred('warning')
      else if (kind === 'selection') hf.selectionChanged()
      else hf.impactOccurred(kind)
      return
    }
  } catch {}
  try {
    navigator.vibrate?.(kind === 'success' ? [12, 18, 28] : 20)
  } catch {}
}
