const PB_URL = (import.meta.env.VITE_PB_URL || '').replace(/\/+$/, '')
const PB_TOKEN_KEY = 'coil.pb.token'
const PB_RECORD_KEY = 'coil.pb.record'

export interface PBAuth {
  token: string
  record: { id: string; [key: string]: any }
}

export async function pbRequest<T = any>(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: any } = {}
): Promise<{ ok: boolean; status: number; data: T | null }> {
  if (!PB_URL) return { ok: false, status: 0, data: null }
  try {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${PB_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    let data: T | null = null
    try {
      data = await res.json()
    } catch {}
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

export async function authWithTelegram(initData: string): Promise<PBAuth | null> {
  if (!PB_URL || !initData) return null
  const res = await pbRequest<any>('/api/arc/telegram-auth', {
    method: 'POST',
    body: { initData },
  })
  if (!res.ok || !res.data?.token || !res.data?.record?.id) return null
  return { token: res.data.token, record: res.data.record }
}

export function getSavedAuth(): PBAuth | null {
  if (typeof window === 'undefined') return null
  try {
    const token = localStorage.getItem(PB_TOKEN_KEY)
    const rec = localStorage.getItem(PB_RECORD_KEY)
    if (!token || !rec) return null
    return { token, record: JSON.parse(rec) }
  } catch {
    return null
  }
}

export function saveAuth(auth: PBAuth | null): void {
  if (typeof window === 'undefined') return
  if (!auth) {
    localStorage.removeItem(PB_TOKEN_KEY)
    localStorage.removeItem(PB_RECORD_KEY)
    return
  }
  localStorage.setItem(PB_TOKEN_KEY, auth.token)
  localStorage.setItem(PB_RECORD_KEY, JSON.stringify(auth.record))
}

export function hasPocketBase(): boolean {
  return !!PB_URL
}
