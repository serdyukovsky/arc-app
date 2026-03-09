import { toKey } from './date'

/** Calculate current streak for daily habits (consecutive days ending today/yesterday) */
export function calcDailyStreak(doneDates: Set<string>): number {
  if (doneDates.size === 0) return 0
  const d = new Date()
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
  if (doneDates.size === 0 || weeklyGoal <= 0) return 0

  const getMonday = (d: Date): Date => {
    const day = d.getDay()
    const diff = d.getDate() - ((day + 6) % 7)
    const m = new Date(d)
    m.setDate(diff)
    m.setHours(0, 0, 0, 0)
    return m
  }

  let monday = getMonday(new Date())
  let streak = 0

  // Check current week (partial — only if enough days done so far)
  const countWeek = (mon: Date): number => {
    let count = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      if (doneDates.has(toKey(d))) count++
    }
    return count
  }

  // Skip current week, start from last week
  monday.setDate(monday.getDate() - 7)

  while (countWeek(monday) >= weeklyGoal) {
    streak++
    monday.setDate(monday.getDate() - 7)
  }

  // Check current week too
  const currentMonday = getMonday(new Date())
  if (countWeek(currentMonday) >= weeklyGoal) {
    streak++
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

  const getMonday = (d: Date): Date => {
    const day = d.getDay()
    const diff = d.getDate() - ((day + 6) % 7)
    const m = new Date(d)
    m.setDate(diff)
    m.setHours(0, 0, 0, 0)
    return m
  }

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
