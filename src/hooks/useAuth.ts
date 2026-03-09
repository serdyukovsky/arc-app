import { useState, useEffect } from 'react'
import { PBAuth, authWithTelegram, getSavedAuth, saveAuth, hasPocketBase } from '@/lib/pb'

export function useAuth(getInitData: () => string) {
  const [auth, setAuth] = useState<PBAuth | null>(getSavedAuth())
  const [isLoading, setIsLoading] = useState(hasPocketBase())

  useEffect(() => {
    if (!hasPocketBase()) return
    let active = true
    ;(async () => {
      const initData = getInitData()
      const freshAuth = await authWithTelegram(initData)
      if (!active) return
      if (freshAuth) {
        setAuth(freshAuth)
        saveAuth(freshAuth)
      }
      setIsLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  return { auth, isLoading, token: auth?.token ?? null, userId: auth?.record?.id ?? null }
}
