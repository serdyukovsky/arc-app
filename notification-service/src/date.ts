export const toKey = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const parseKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = (): string => toKey(new Date())

export const getMonday = (d: Date): Date => {
  const day = d.getDay()
  const diff = d.getDate() - ((day + 6) % 7)
  const m = new Date(d)
  m.setDate(diff)
  m.setHours(0, 0, 0, 0)
  return m
}

/** Get current time in a timezone as HH:MM */
export function getLocalTime(timezone: string): { hours: number; minutes: number; dayOfWeek: number; dateKey: string } {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = formatter.format(now).split(':')
    const hours = parseInt(parts[0], 10)
    const minutes = parseInt(parts[1], 10)

    const dayFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
    })
    const dayStr = dayFormatter.format(now)
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const dayOfWeek = dayMap[dayStr] ?? now.getDay()

    const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const dateKey = dateFormatter.format(now)

    return { hours, minutes, dayOfWeek, dateKey }
  } catch {
    const now = new Date()
    return {
      hours: now.getUTCHours(),
      minutes: now.getUTCMinutes(),
      dayOfWeek: now.getUTCDay(),
      dateKey: toKey(now),
    }
  }
}

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

export function isInQuietHours(
  currentHours: number,
  currentMinutes: number,
  from: string,
  to: string
): boolean {
  const f = parseTime(from)
  const t = parseTime(to)
  const current = currentHours * 60 + currentMinutes
  const fromMin = f.hours * 60 + f.minutes
  const toMin = t.hours * 60 + t.minutes

  if (fromMin <= toMin) {
    return current >= fromMin && current < toMin
  }
  // Wraps midnight (e.g., 23:00 to 07:00)
  return current >= fromMin || current < toMin
}
