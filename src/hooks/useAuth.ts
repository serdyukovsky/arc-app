import { useState, useEffect } from 'react'
import type { AuthFailure } from '@/lib/pb'
import { PBAuth, authWithTelegram, getSavedAuth, saveAuth, hasPocketBase } from '@/lib/pb'

export function useAuth(getInitData: () => string) {
  const [auth, setAuth] = useState<PBAuth | null>(getSavedAuth())
  const [isLoading, setIsLoading] = useState(hasPocketBase())
  const [failure, setFailure] = useState<AuthFailure | null>(null)

  useEffect(() => {
    if (!hasPocketBase()) return
    let active = true
    ;(async () => {
      const initData = getInitData()
      const { auth: freshAuth, failure: authFailure } = await authWithTelegram(initData)
      if (!active) return

      if (freshAuth) {
        setAuth(freshAuth)
        saveAuth(freshAuth)
        setFailure(null)
      } else {
        // A token the server just refused is dead — keeping it only turns every
        // later write into a silent no-op. A network blip leaves it alone.
        if (authFailure?.reason === 'rejected' || authFailure?.reason === 'no-init-data') {
          setAuth(null)
          saveAuth(null)
        }
        setFailure(authFailure)
      }

      setIsLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  return {
    auth,
    isLoading,
    failure,
    token: auth?.token ?? null,
    userId: auth?.record?.id ?? null,
  }
}
