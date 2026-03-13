import { parseKey, toKey } from './date'

const getMonday = (d: Date): Date => {
  const day = d.getDay()
  const diff = d.getDate() - ((day + 6) % 7)
  const m = new Date(d)
  m.setDate(diff)
  m.setHours(0, 0, 0, 0)
  return m
}

/** Calculate current streak for daily habits (consecutive days ending today/yesterday) */
export function calcDailyStreak(doneDates: Set<string>): number {
  return calcDailyStreakAtDate(doneDates, toKey(new Date()))
}

/** Calculate streak for daily habits as of specific date */
export function calcDailyStreakAtDate(doneDates: Set<string>, referenceDateKey: string): number {
  if (doneDates.size === 0) return 0
  const d = parseKey(referenceDateKey)
  d.setHours(0, 0, 0, 0)
  let key = toKey(d)
  // allow starting from yesterday if today not done
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

/** Calculate current streak for periodic habits (consecutive weeks meeting goal) */
export function calcPeriodicStreak(doneDates: Set<string>, weeklyGoal: number): number {
  return calcPeriodicStreakAtDate(doneDates, weeklyGoal, toKey(new Date()))
}

/** Calculate weekly streak as of specific date */
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
    const completed = isFirstWeek
      ? countWeek(monday, referenceDate)
      : countWeek(monday)

    if (completed < weeklyGoal) break
    streak++
    monday.setDate(monday.getDate() - 7)
    isFirstWeek = false
  }

  return streak
}

/** Calculate best (longest) streak ever */
export function calcBestStreak(doneDates: Set<string>): number {
  if (doneDates.size === 0) return 0
  const sorted = [...doneDates].sort()
  let best = 1
  let current = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (Math.round(diff) === 1) {
      current++
      if (current > best) best = current
    } else {
      current = 1
    }
  }
  return best
}

/** Calculate best weekly streak for periodic habits */
export function calcPeriodicBestStreak(doneDates: Set<string>, weeklyGoal: number): number {
  if (doneDates.size === 0 || weeklyGoal <= 0) return 0

  const countWeek = (mon: Date): number => {
    let count = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      if (doneDates.has(toKey(d))) count++
    }
    return count
  }

  let cursor = getMonday(new Date())
  const earliest = [...doneDates].sort()[0]
  const earliestDate = new Date(earliest)

  let best = 0
  let current = 0

  while (cursor >= earliestDate) {
    const ok = countWeek(cursor) >= weeklyGoal
    if (ok) {
      current++
      if (current > best) best = current
    } else {
      current = 0
    }
    cursor.setDate(cursor.getDate() - 7)
  }

  return best
}

/** Calculate total completed days (unique dates) */
export function calcLifetimeDays(doneDates: Set<string>): number {
  return doneDates.size
}

/** Calculate total completed weeks meeting the goal */
export function calcPeriodicLifetimeDays(doneDates: Set<string>, weeklyGoal: number): number {
  if (doneDates.size === 0 || weeklyGoal <= 0) return 0

  const countWeek = (mon: Date): number => {
    let count = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      if (doneDates.has(toKey(d))) count++
    }
    return count
  }

  const earliest = [...doneDates].sort()[0]
  const earliestDate = new Date(earliest)
  let cursor = getMonday(new Date())
  let total = 0

  while (cursor >= earliestDate) {
    if (countWeek(cursor) >= weeklyGoal) total++
    cursor.setDate(cursor.getDate() - 7)
  }

  return total
}
