import { useState, useEffect, useCallback } from 'react'
import type { NotificationSettings } from '@/types'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/types'
import { pbRequest } from '@/lib/pb'

interface SettingsResponse {
  id?: string
  enabled: boolean
  timezone: string
  quiet_hours_from: string
  quiet_hours_to: string
  morning_digest: boolean
  morning_digest_time: string
  evening_summary: boolean
  evening_summary_time: string
  weekly_report: boolean
  weekly_report_day: number
  streak_protection: boolean
  last_active: string
}

const mapResponse = (data: SettingsResponse): Omit<NotificationSettings, 'id' | 'user'> => ({
  enabled: data.enabled,
  timezone: data.timezone,
  quietHoursFrom: data.quiet_hours_from,
  quietHoursTo: data.quiet_hours_to,
  morningDigest: data.morning_digest,
  morningDigestTime: data.morning_digest_time,
  eveningSummary: data.evening_summary,
  eveningSummaryTime: data.evening_summary_time,
  weeklyReport: data.weekly_report,
  weeklyReportDay: data.weekly_report_day,
  streakProtection: data.streak_protection,
  lastActive: data.last_active,
})

const mapToPayload = (settings: Partial<NotificationSettings>) => {
  const payload: Record<string, any> = {}
  if (settings.enabled !== undefined) payload.enabled = settings.enabled
  if (settings.timezone !== undefined) payload.timezone = settings.timezone
  if (settings.quietHoursFrom !== undefined) payload.quiet_hours_from = settings.quietHoursFrom
  if (settings.quietHoursTo !== undefined) payload.quiet_hours_to = settings.quietHoursTo
  if (settings.morningDigest !== undefined) payload.morning_digest = settings.morningDigest
  if (settings.morningDigestTime !== undefined) payload.morning_digest_time = settings.morningDigestTime
  if (settings.eveningSummary !== undefined) payload.evening_summary = settings.eveningSummary
  if (settings.eveningSummaryTime !== undefined) payload.evening_summary_time = settings.eveningSummaryTime
  if (settings.weeklyReport !== undefined) payload.weekly_report = settings.weeklyReport
  if (settings.weeklyReportDay !== undefined) payload.weekly_report_day = settings.weeklyReportDay
  if (settings.streakProtection !== undefined) payload.streak_protection = settings.streakProtection
  return payload
}

export function useNotificationSettings(token: string | null) {
  const [settings, setSettings] = useState<Omit<NotificationSettings, 'id' | 'user'>>(DEFAULT_NOTIFICATION_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    pbRequest<SettingsResponse>('/api/arc/notification-settings', { token })
      .then((res) => {
        if (res.ok && res.data) {
          setSettings(mapResponse(res.data))
        }
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const updateSettings = useCallback(
    async (partial: Partial<NotificationSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }))

      if (!token) return

      await pbRequest('/api/arc/notification-settings', {
        method: 'POST',
        token,
        body: mapToPayload(partial),
      })
    },
    [token]
  )

  return { settings, isLoading, updateSettings }
}
