import type { Habit, HabitLog, NotificationSettings, NotificationLog, UserRecord } from './types.js'

const PB_URL = (process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || ''
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || ''

let adminToken = ''

async function request<T>(path: string, opts: { method?: string; body?: any } = {}): Promise<T | null> {
  const headers: Record<string, string> = {}
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`
  if (opts.body) headers['Content-Type'] = 'application/json'

  try {
    const res = await fetch(`${PB_URL}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function authenticate(): Promise<boolean> {
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    console.error('[pb] Admin credentials not configured')
    return false
  }

  const data = await request<{ token: string }>('/api/admins/auth-with-password', {
    method: 'POST',
    body: { identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD },
  })

  if (data?.token) {
    adminToken = data.token
    console.log('[pb] Authenticated as admin')
    return true
  }

  // Try superuser collection (PB v0.23+)
  const data2 = await request<{ token: string }>('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: { identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD },
  })

  if (data2?.token) {
    adminToken = data2.token
    console.log('[pb] Authenticated as superuser')
    return true
  }

  console.error('[pb] Authentication failed')
  return false
}

export async function getAllActiveSettings(): Promise<(NotificationSettings & { userId: string })[]> {
  const data = await request<{ items: any[] }>(
    '/api/collections/notification_settings/records?filter=(enabled=true)&perPage=500'
  )
  if (!data?.items) return []
  return data.items.map((item) => ({
    ...item,
    userId: item.user,
  }))
}

export async function getHabitsForUser(userId: string): Promise<Habit[]> {
  const data = await request<{ items: Habit[] }>(
    `/api/collections/habits/records?filter=(user='${userId}' %26%26 isArchived=false)&sort=order&perPage=100`
  )
  return data?.items || []
}

export async function getLogsForUser(userId: string, days: number = 90): Promise<HabitLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  const data = await request<{ items: HabitLog[] }>(
    `/api/collections/habit_logs/records?filter=(date>='${sinceStr}')&perPage=5000&sort=-date`
  )
  return data?.items || []
}

export async function getUserRecord(userId: string): Promise<UserRecord | null> {
  return request<UserRecord>(`/api/collections/users/records/${userId}`)
}

export function extractTelegramId(email: string): string | null {
  const match = email.match(/^tg_(\d+)@/)
  return match ? match[1] : null
}

export async function wasNotificationSent(
  userId: string,
  type: string,
  dateKey: string,
  slot?: string
): Promise<boolean> {
  let filter = `(user='${userId}' %26%26 type='${type}' %26%26 date_key='${dateKey}')`
  if (slot) {
    filter = `(user='${userId}' %26%26 type='${type}' %26%26 date_key='${dateKey}' %26%26 slot='${slot}')`
  }
  const data = await request<{ totalItems: number }>(
    `/api/collections/notification_log/records?filter=${filter}&perPage=1`
  )
  return (data?.totalItems ?? 0) > 0
}

export async function logNotification(log: NotificationLog): Promise<void> {
  await request('/api/collections/notification_log/records', {
    method: 'POST',
    body: log,
  })
}
