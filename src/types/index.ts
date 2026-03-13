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
  reminder: 'none' | 'morning' | 'day' | 'evening'
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

export const HABIT_TYPES: { id: HabitType; label: string; desc: string; icon: string }[] = [
  { id: 'daily', label: 'Ежедневная', desc: 'Каждый день — строим стрик', icon: 'today' },
  { id: 'periodic', label: 'Периодическая', desc: 'Несколько раз в неделю', icon: 'repeat' },
  { id: 'counter', label: 'Счётчик', desc: 'Считаем количество за день', icon: 'pin' },
]
