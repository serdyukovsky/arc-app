import { toKey } from '@/lib/date'
import type { HabitType } from '@/types'

export type PopupType =
  | 'streak_lost'
  | 'milestone_reached'
  | 'freeze_offer'
  | 'all_done'
  | 'first_complete'
  | 'goal_reached'

export type PopupPriority = 1 | 2 | 3

export type PopupTimeOfDay = 'morning' | 'day' | 'evening' | 'late'

export interface PopupEventData {
  streak?: number
  milestone?: number
  habitName?: string
  habitType?: HabitType
  hoursLeft?: number
  daysLeft?: number
  weekDone?: number
  weekGoal?: number
  completedCount?: number
  seriesDays?: number
  weekCompletion?: number
  streaks?: Array<{ name: string; streak: number; unit: string }>
  goalDays?: number
  lifetimeDays?: number
  freezesAvailable?: number
  timeOfDay?: PopupTimeOfDay
  singleHabitAllDone?: boolean
}

export interface PopupEventInput {
  type: PopupType
  habitId: string | null
  priority?: PopupPriority
  data?: PopupEventData
}

export interface PopupEvent {
  type: PopupType
  habitId: string | null
  priority: PopupPriority
  data: PopupEventData
  order: number
}

export interface PopupState {
  queue: PopupEvent[]
  active: PopupEvent | null
  allDoneShownToday: string | null
}

export const POPUP_PRIORITY: Record<PopupType, PopupPriority> = {
  goal_reached: 1,
  all_done: 1,
  first_complete: 2,
  streak_lost: 2,
  freeze_offer: 2,
  milestone_reached: 3,
}

let popupOrderCounter = 0

const nextPopupOrder = (): number => {
  popupOrderCounter += 1
  return popupOrderCounter
}

const sortByPriorityThenOrder = (a: PopupEvent, b: PopupEvent): number => {
  if (a.priority !== b.priority) return a.priority - b.priority
  return a.order - b.order
}

const hasDuplicateEvent = (state: PopupState, event: PopupEventInput): boolean => {
  const same = (entry: PopupEvent | null) =>
    !!entry && entry.type === event.type && entry.habitId === event.habitId
  if (same(state.active)) return true
  return state.queue.some((entry) => same(entry))
}

const STORAGE_KEY_ALL_DONE = 'arc:allDoneShownToday'

const loadAllDoneShownToday = (): string | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY_ALL_DONE)
    if (!stored) return null
    const todayKey = toKey(new Date())
    return stored === todayKey ? stored : null
  } catch {
    return null
  }
}

const persistAllDoneShownToday = (value: string | null) => {
  try {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY_ALL_DONE, value)
    } else {
      sessionStorage.removeItem(STORAGE_KEY_ALL_DONE)
    }
  } catch {
    // silent
  }
}

export const createInitialPopupState = (): PopupState => ({
  queue: [],
  active: null,
  allDoneShownToday: loadAllDoneShownToday(),
})

export const resetPopupOrderCounter = () => {
  popupOrderCounter = 0
}

export const setAllDoneShownToday = (state: PopupState, dateKey: string | null): PopupState => {
  persistAllDoneShownToday(dateKey)
  return { ...state, allDoneShownToday: dateKey }
}

export const enqueuePopupEvent = (state: PopupState, event: PopupEventInput): PopupState => {
  if (hasDuplicateEvent(state, event)) return state

  const withMeta: PopupEvent = {
    type: event.type,
    habitId: event.habitId,
    priority: event.priority ?? POPUP_PRIORITY[event.type],
    data: event.data ?? {},
    order: nextPopupOrder(),
  }

  const queue = [...state.queue, withMeta].sort(sortByPriorityThenOrder)
  if (state.active) {
    return { ...state, queue }
  }

  const [active, ...rest] = queue
  return {
    ...state,
    active: active ?? null,
    queue: rest,
  }
}

export const closeActivePopup = (state: PopupState): PopupState => {
  if (!state.active) return state
  if (state.queue.length === 0) {
    return {
      ...state,
      active: null,
    }
  }

  const [next, ...rest] = state.queue
  return {
    ...state,
    active: next,
    queue: rest,
  }
}

export const clearPopupQueue = (state: PopupState): PopupState => ({
  ...state,
  queue: [],
  active: null,
})

export const getDateString = (date: Date = new Date()): string => toKey(date)

export const getYesterdayString = (date: Date = new Date()): string => {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return toKey(d)
}

export const getTimeOfDay = (date: Date = new Date()): PopupTimeOfDay => {
  const hour = date.getHours()
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'day'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'late'
}

export const getRemainingDaysInWeek = (date: Date = new Date()): number => {
  const dayIndexFromMonday = (date.getDay() + 6) % 7
  return 7 - dayIndexFromMonday
}

export const isDeadWeek = (
  weekDone: number,
  weekGoal: number,
  remainingDaysInWeek: number
): boolean => remainingDaysInWeek + weekDone < weekGoal

export const emitMilestoneToast = (habitName: string, milestone: number): string => {
  const message = `${habitName}: milestone ${milestone}`
  console.info('[popup-toast]', message)
  return message
}
