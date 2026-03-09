import { useEffect } from 'react'

function getTg(): any {
  if (typeof window === 'undefined') return null
  return (window as any).Telegram?.WebApp ?? null
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
    const tg = getTg()
    return tg?.safeAreaInset?.bottom ?? 0
  }

  return { showBackButton, getUser, getInitData, getSafeAreaBottom }
}
