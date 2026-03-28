export interface Habit {
  id: string
  user: string
  name: string
  category: string
  type: 'daily' | 'periodic' | 'counter'
  goal: number
  goalDays: number | null
  daysGoal: number | null
  reminder: 'none' | 'morning' | 'day' | 'evening' | 'custom'
  reminder_time?: string | null
  isArchived: boolean
  order: number
  created: string
}

export interface HabitLog {
  id: string
  habit: string
  date: string
  value: number
  created: string
}

export interface NotificationSettings {
  id?: string
  user: string
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

export interface NotificationLog {
  id?: string
  user: string
  type: string
  habit?: string
  sent_at: string
  date_key: string
  message_id?: string
  slot?: string
}

export interface UserRecord {
  id: string
  email: string
}

export type NotificationType =
  | 'reminder'
  | 'streak_protection'
  | 'morning_digest'
  | 'evening_summary'
  | 'weekly_report'
  | 'return_nudge'
