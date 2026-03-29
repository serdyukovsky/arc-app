export type HabitType = 'daily' | 'periodic' | 'counter'

export type Category =
  | 'body'
  | 'move'
  | 'focus'
  | 'read'
  | 'mind'
  | 'food'
  | 'social'
  | 'other'

export interface Habit {
  id: string
  user: string
  name: string
  category: Category
  type: HabitType
  goal: number
  goalDays: number | null
  daysGoal?: number | null
  streak: number
  bestStreak: number
  lifetimeDays: number
  goalCompleted: boolean
  currentMilestoneIndex: number
  milestones: number[] | null
  firstCompleted: boolean
  lastStreakLostShown: string | null
  lastFreezeOfferShown: string | null
  milestonePopupCount: number
  freezesAvailable: number
  reminder: 'none' | 'morning' | 'day' | 'evening' | 'custom'
  reminderTime?: string // "HH:MM" when reminder === 'custom'
  created: string
  isArchived: boolean
  order: number
}

export interface HabitLog {
  id: string
  habit: string
  date: string // YYYY-MM-DD
  value: number
  created: string
}

export const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'body', label: 'Тело', icon: 'water_drop' },
  { id: 'move', label: 'Движение', icon: 'directions_run' },
  { id: 'focus', label: 'Фокус', icon: 'psychology' },
  { id: 'read', label: 'Развитие', icon: 'menu_book' },
  { id: 'mind', label: 'Разум', icon: 'self_improvement' },
  { id: 'food', label: 'Питание', icon: 'nutrition' },
  { id: 'social', label: 'Соцсвязи', icon: 'people' },
  { id: 'other', label: 'Другое', icon: 'add_circle' },
]

export type ReminderSlot = 'none' | 'morning' | 'day' | 'evening' | 'custom'

export interface NotificationSettings {
  id: string
  user: string
  enabled: boolean
  timezone: string
  quietHoursFrom: string
  quietHoursTo: string
  morningDigest: boolean
  morningDigestTime: string
  eveningSummary: boolean
  eveningSummaryTime: string
  weeklyReport: boolean
  weeklyReportDay: number // 0=Sunday, 1=Monday, etc.
  streakProtection: boolean
  strictMode: boolean
  lastActive: string
}

export const DEFAULT_NOTIFICATION_SETTINGS: Omit<NotificationSettings, 'id' | 'user'> = {
  enabled: true,
  timezone: '',
  quietHoursFrom: '23:00',
  quietHoursTo: '07:00',
  morningDigest: true,
  morningDigestTime: '08:00',
  eveningSummary: true,
  eveningSummaryTime: '21:00',
  weeklyReport: true,
  weeklyReportDay: 0,
  streakProtection: true,
  strictMode: false,
  lastActive: '',
}

export const HABIT_TYPES: { id: HabitType; label: string; desc: string; icon: string }[] = [
  { id: 'daily', label: 'Ежедневная', desc: 'Каждый день — строим стрик', icon: 'today' },
  { id: 'periodic', label: 'Периодическая', desc: 'Несколько раз в неделю', icon: 'repeat' },
  { id: 'counter', label: 'Счётчик', desc: 'Считаем количество за день', icon: 'pin' },
]
