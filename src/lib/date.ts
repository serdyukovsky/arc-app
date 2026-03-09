export const toKey = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const today = (): string => toKey(new Date())

export const daysAgo = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toKey(d)
}

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

export const parseKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const formatDate = (key: string): string =>
  (() => {
    const date = parseKey(key)
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
    const months = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ]
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`
  })()

export const formatDateFull = (key: string): string =>
  parseKey(key).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export const isToday = (key: string): boolean => key === today()

export const getWeekDays = (centerDate?: string): string[] => {
  const center = centerDate ? parseKey(centerDate) : new Date()
  const dow = center.getDay()
  const monday = new Date(center)
  monday.setDate(center.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toKey(d)
  })
}

export const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const getGreeting = (): string => {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Доброе утро!'
  if (h >= 12 && h < 17) return 'Добрый день!'
  if (h >= 17 && h < 23) return 'Добрый вечер!'
  return 'Доброй ночи!'
}
