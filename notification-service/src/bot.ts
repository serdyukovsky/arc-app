// Бот: /start и отметки кнопками под сообщениями-блоками.
import { BACKFILL_DAYS, isAllowed } from './config.js'
import { blockKeyboard, blockText, isComplete, isMarkable, parseCallback, reminderTime } from './blocks.js'
import { getLocalTime } from './date.js'
import {
  getBlockMessages,
  getDoneHabitIds,
  getHabit,
  getHabitsForUser,
  getSettingsForUser,
  toggleHabitLog,
} from './pb-client.js'
import { answerCallback, editMessage, handleStart, WEBAPP_URL, type TelegramUpdate } from './telegram.js'
import type { Habit } from './types.js'

/** Привычки одного блока: активные, с тем же временем напоминания, в порядке приложения. */
export function blockHabits(habits: Habit[], time: string): Habit[] {
  return habits.filter((h) => !h.isArchived && reminderTime(h) === time).sort((a, b) => a.order - b.order)
}

export async function renderBlock(userId: string, time: string, dateKey: string, todayKey: string) {
  const habits = blockHabits(await getHabitsForUser(userId), time)
  const done = await getDoneHabitIds(userId, dateKey)
  const markable = isMarkable(dateKey, todayKey, BACKFILL_DAYS)
  return {
    habits,
    done,
    complete: isComplete(habits, done),
    text: blockText(time, habits, done),
    markup: blockKeyboard(habits, done, dateKey, WEBAPP_URL, markable),
  }
}

async function userToday(userId: string): Promise<string> {
  const settings = await getSettingsForUser(userId)
  return getLocalTime(settings?.timezone || 'Asia/Barnaul').dateKey
}

// перерисовки одного сообщения — по одной; тапы во время перерисовки склеиваются в одну догоняющую
const drawing = new Set<string>()
const dirty = new Set<string>()

async function redraw(chatId: string, messageId: string, draw: () => Promise<{ text: string; markup: unknown }>) {
  const key = `${chatId}:${messageId}`
  if (drawing.has(key)) {
    dirty.add(key)
    return
  }
  drawing.add(key)
  try {
    do {
      dirty.delete(key)
      const { text, markup } = await draw()
      await editMessage(chatId, messageId, text, markup)
    } while (dirty.has(key))
  } finally {
    drawing.delete(key)
  }
}

async function onCallback(cb: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
  const parsed = parseCallback(cb.data)
  const habit = parsed && (await getHabit(parsed.habitId))
  if (!parsed || !habit || !cb.message) {
    await answerCallback(cb.id)
    return
  }
  const todayKey = await userToday(habit.user)
  if (!isMarkable(parsed.dateKey, todayKey, BACKFILL_DAYS)) {
    await answerCallback(cb.id, 'Этот день уже не отметить')
  } else {
    await answerCallback(cb.id) // сразу гасим «загрузку» на кнопке
    const state = await toggleHabitLog(habit.id, parsed.dateKey)
    if (state === null) console.error('[bot] toggle failed', habit.id, parsed.dateKey)
  }
  const time = reminderTime(habit)
  if (!time) return
  const chatId = String(cb.message.chat.id)
  await redraw(chatId, String(cb.message.message_id), () => renderBlock(habit.user, time, parsed.dateKey, todayKey))
}

export async function onUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    if (!isAllowed(update.callback_query.from.id)) return
    await onCallback(update.callback_query)
    return
  }
  const message = update.message
  const chatId = message?.chat?.id
  const text = String(message?.text || '').trim()
  if (!chatId || !text || !isAllowed(message?.from?.id)) return
  if (text === '/start' || text.startsWith('/start ')) await handleStart(String(chatId))
}

/** Полночь: у блоков, вышедших из запаса на отметку, снять кнопки (остаётся «открыть приложение»). */
export async function expireBlocks(userId: string, chatId: string, todayKey: string): Promise<void> {
  const [y, m, d] = todayKey.split('-').map(Number)
  const expired = new Date(Date.UTC(y, m - 1, d - BACKFILL_DAYS - 1)).toISOString().slice(0, 10)
  for (const log of await getBlockMessages(userId, expired)) {
    const time = log.slot?.startsWith('block_') ? log.slot.slice('block_'.length) : null
    if (!time || !log.message_id) continue
    await redraw(chatId, log.message_id, () => renderBlock(userId, time, expired, todayKey))
  }
}
