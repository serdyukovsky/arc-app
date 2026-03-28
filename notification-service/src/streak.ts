import { toKey, parseKey, getMonday } from './date.js'

export function calcDailyStreakAtDate(doneDates: Set<string>, referenceDateKey: string): number {
  if (doneDates.size === 0) return 0
  const d = parseKey(referenceDateKey)
  d.setHours(0, 0, 0, 0)
  let key = toKey(d)
  if (!doneDates.has(key)) {
    d.setDate(d.getDate() - 1)
    key = toKey(d)
    if (!doneDates.has(key)) return 0
  }
  let streak = 0
  while (doneDates.has(key)) {
    streak++
    d.setDate(d.getDate() - 1)
    key = toKey(d)
  }
  return streak
}

export function calcPeriodicStreakAtDate(
  doneDates: Set<string>,
  weeklyGoal: number,
  referenceDateKey: string
): number {
  if (doneDates.size === 0 || weeklyGoal <= 0) return 0

  const referenceDate = parseKey(referenceDateKey)
  referenceDate.setHours(0, 0, 0, 0)

  const countWeek = (mon: Date, maxDate?: Date): number => {
    let count = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      if (maxDate && d.getTime() > maxDate.getTime()) break
      if (doneDates.has(toKey(d))) count++
    }
    return count
  }

  let monday = getMonday(referenceDate)
  let streak = 0
  let isFirstWeek = true

  while (true) {
    const completed = isFirstWeek ? countWeek(monday, referenceDate) : countWeek(monday)
    if (completed < weeklyGoal) break
    streak++
    monday.setDate(monday.getDate() - 7)
    isFirstWeek = false
  }

  return streak
}

export function getStreak(
  doneDates: Set<string>,
  habitType: string,
  goal: number,
  dateKey: string
): number {
  if (habitType === 'periodic') {
    return calcPeriodicStreakAtDate(doneDates, goal, dateKey)
  }
  return calcDailyStreakAtDate(doneDates, dateKey)
}
