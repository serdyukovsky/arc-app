import { useEffect } from 'react'

function getTg(): any {
  if (typeof window === 'undefined') return null
  return (window as any).Telegram?.WebApp ?? null
}

type InsetKey = 'top' | 'right' | 'bottom' | 'left'

type SafeAreaInsets = {
  top: number
  right: number
  bottom: number
  left: number
}

const EVENT_NAMES = [
  'viewportChanged',
  'viewport_changed',
  'safeAreaChanged',
  'safe_area_changed',
  'contentSafeAreaChanged',
  'content_safe_area_changed',
]

const normalizeInset = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.round(value)
}

function getSafeAreaInsets(): SafeAreaInsets {
  const tg = getTg()
  if (!tg) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }
  }

  const safe = tg?.safeAreaInset ?? {}
  const contentSafe = tg?.contentSafeAreaInset ?? {}

  const maxInset = (key: InsetKey): number => {
    return Math.max(normalizeInset(safe[key]), normalizeInset(contentSafe[key]))
  }

  return {
    top: maxInset('top'),
    right: maxInset('right'),
    bottom: maxInset('bottom'),
    left: maxInset('left'),
  }
}

function applySafeAreaCssVars(): void {
  if (typeof document === 'undefined') return
  const tg = getTg()
  if (!tg) return

  const root = document.documentElement
  const insets = getSafeAreaInsets()
  const viewportHeightRaw = tg?.viewportStableHeight ?? tg?.viewportHeight
  const viewportHeight =
    typeof viewportHeightRaw === 'number' && Number.isFinite(viewportHeightRaw)
      ? Math.round(viewportHeightRaw)
      : 0
  const viewportDelta =
    viewportHeight > 0 ? Math.max(0, Math.round(window.innerHeight - viewportHeight)) : 0
  const topControlsInset = Math.max(0, viewportDelta - insets.bottom - insets.top)

  root.style.setProperty('--safe-top-js', `${insets.top}px`)
  root.style.setProperty('--safe-right-js', `${insets.right}px`)
  root.style.setProperty('--safe-bottom-js', `${insets.bottom}px`)
  root.style.setProperty('--safe-left-js', `${insets.left}px`)
  root.style.setProperty('--tg-top-controls-js', `${topControlsInset}px`)
}

export function useTelegram() {
  useEffect(() => {
    const tg = getTg()
    if (!tg) return
    tg.ready()
    tg.expand()
    tg.setHeaderColor('#efefef')
    tg.setBackgroundColor('#efefef')
    tg.disableVerticalSwipes?.()
  }, [])

  const bindSafeAreaCssVars = () => {
    if (typeof window === 'undefined') return () => {}
    const tg = getTg()
    if (!tg) return () => {}

    const sync = () => {
      applySafeAreaCssVars()
    }

    sync()

    if (tg?.onEvent && tg?.offEvent) {
      EVENT_NAMES.forEach((eventName) => {
        try {
          tg.onEvent(eventName, sync)
        } catch {
          // ignore unsupported event names
        }
      })
    }

    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      if (tg?.offEvent) {
        EVENT_NAMES.forEach((eventName) => {
          try {
            tg.offEvent(eventName, sync)
          } catch {
            // ignore unsupported event names
          }
        })
      }
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }

  const showBackButton = (onClick: () => void) => {
    const tg = getTg()
    if (!tg?.BackButton) return () => {}
    tg.BackButton.show()
    tg.BackButton.onClick(onClick)
    return () => {
      tg.BackButton.hide()
      tg.BackButton.offClick(onClick)
    }
  }

  const getUser = () => {
    const tg = getTg()
    return tg?.initDataUnsafe?.user ?? null
  }

  const getInitData = (): string => {
    return getTg()?.initData ?? ''
  }

  const getSafeAreaBottom = (): number => {
    return getSafeAreaInsets().bottom
  }

  return { showBackButton, getUser, getInitData, getSafeAreaBottom, bindSafeAreaCssVars }
}
