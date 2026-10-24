// Сообщение-блок: все привычки одного времени напоминания — одним сообщением с кнопками.
// Нажатие отмечает привычку за дату из кнопки, сообщение правится на месте.
// Тексты нейтральные: без стриков, процентов и «не забудь».
//
// callback_data: `<вид>:<habitId>:<YYYY-MM-DD>` — дата едет в кнопке, чтобы утреннее нажатие
// по вчерашнему сообщению легло во вчера. Вид: `h` — сообщение-блок, `y` — утреннее «Вчера».
import type { Habit } from './types.js'

const DONE = '✅'
const TODO = '▫️'

export const REMINDER_SLOTS: Record<string, string> = {
  morning: '08:00',
  day: '13:00',
  evening: '21:00',
}

/** Время напоминания привычки 'HH:MM' или null, если напоминания нет. */
export function reminderTime(habit: Pick<Habit, 'reminder' | 'reminder_time'>): string | null {
  if (habit.reminder === 'none' || !habit.reminder) return null
  if (habit.reminder === 'custom') return habit.reminder_time || null
  return REMINDER_SLOTS[habit.reminder] || null
}

/** Счётчик кнопкой не отметить (нужно число) — для него только строка в тексте. */
export const isTappable = (habit: Pick<Habit, 'type'>): boolean => habit.type !== 'counter'

export function blockTitle(time: string): string {
  const h = parseInt(time.split(':')[0] || '0', 10)
  const part = h >= 5 && h < 12 ? 'Утро' : h >= 12 && h < 17 ? 'День' : 'Вечер'
  return `${part} · ${time}`
}

export type MessageKind = 'h' | 'y'

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function blockText(time: string, habits: Habit[], done: Set<string>): string {
  const lines = habits.map((h) => `${done.has(h.id) ? DONE : TODO} ${escapeHtml(h.name)}`)
  return [`<b>${blockTitle(time)}</b>`, ...lines].join('\n')
}

export const isComplete = (habits: Habit[], done: Set<string>): boolean =>
  habits.filter(isTappable).every((h) => done.has(h.id))

export interface InlineButton {
  text: string
  callback_data?: string
  web_app?: { url: string }
}

/** Кнопки по одной на привычку; когда всё отмечено — только «открыть приложение». */
export function blockKeyboard(
  habits: Habit[],
  done: Set<string>,
  dateKey: string,
  webAppUrl: string,
  markable: boolean,
  kind: MessageKind = 'h'
): { inline_keyboard: InlineButton[][] } | undefined {
  const rows: InlineButton[][] = []
  if (markable && !isComplete(habits, done)) {
    for (const h of habits.filter(isTappable)) {
      rows.push([{ text: done.has(h.id) ? `${DONE} ${h.name}` : h.name, callback_data: `${kind}:${h.id}:${dateKey}` }])
    }
  }
  if (webAppUrl) rows.push([{ text: 'Открыть приложение', web_app: { url: webAppUrl } }])
  return rows.length ? { inline_keyboard: rows } : undefined
}

export function parseCallback(
  data: string | undefined
): { kind: MessageKind; habitId: string; dateKey: string } | null {
  const m = /^([hy]):([a-z0-9]{1,32}):(\d{4}-\d{2}-\d{2})$/.exec(data || '')
  return m ? { kind: m[1] as MessageKind, habitId: m[2], dateKey: m[3] } : null
}

/** Доводчик: только то, что не отмечено, плюс своя фраза курсивом (если есть). */
export function nudgeText(time: string, left: Habit[], own?: string | null): string {
  const text = `${blockTitle(time)}: осталось — ${left.map((h) => escapeHtml(h.name)).join(', ')}`
  return own ? `${text}\n\n<i>${escapeHtml(own)}</i>` : text
}

/** Утреннее «Вчера»: что вчера отмечено; неотмеченное — кнопками, чтобы доотметить. */
export function yesterdayText(habits: Habit[], done: Set<string>): string {
  const lines = habits.map((h) => `${done.has(h.id) ? DONE : TODO} ${escapeHtml(h.name)}`)
  return ['<b>Вчера</b>', ...lines].join('\n')
}

/** Можно ли ещё отмечать дату: сегодня и BACKFILL_DAYS назад. */
export function isMarkable(dateKey: string, todayKey: string, backfillDays: number): boolean {
  if (dateKey > todayKey) return false
  const [y, m, d] = todayKey.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, d - backfillDays)).toISOString().slice(0, 10)
  return dateKey >= first
}
