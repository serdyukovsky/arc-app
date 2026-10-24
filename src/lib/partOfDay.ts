import type { Habit } from '@/types'

// Части дня — по времени напоминания, те же границы, что в заголовках блоков бота:
// утро 5–12, день 12–17, вечер — остальное. Без напоминания — отдельной группой в конце.
export type PartOfDay = 'morning' | 'day' | 'evening' | 'anytime'

const SLOT_TIME: Record<string, string> = { morning: '08:00', day: '13:00', evening: '21:00' }

export const PART_LABEL: Record<PartOfDay, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  anytime: 'В любое время',
}

export function habitTime(habit: Habit): string | null {
  if (!habit.reminder || habit.reminder === 'none') return null
  if (habit.reminder === 'custom') return habit.reminderTime || null
  return SLOT_TIME[habit.reminder] ?? null
}

export function partOfDay(habit: Habit): PartOfDay {
  const time = habitTime(habit)
  if (!time) return 'anytime'
  const h = parseInt(time.split(':')[0] || '0', 10)
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'day'
  return 'evening'
}

const ORDER: PartOfDay[] = ['morning', 'day', 'evening', 'anytime']

/** Привычки по частям дня (пустые части не возвращаются); внутри — по времени, затем по порядку. */
export function groupByPartOfDay(habits: Habit[]): { part: PartOfDay; habits: Habit[] }[] {
  return ORDER.map((part) => ({
    part,
    habits: habits
      .filter((h) => partOfDay(h) === part)
      .sort((a, b) => (habitTime(a) || '').localeCompare(habitTime(b) || '') || a.order - b.order),
  })).filter((g) => g.habits.length > 0)
}
