import {
  getHabitsForUser,
  getLogsForUser,
  getSettingsForUser,
  getUserByTelegramId,
  wasNotificationSent,
  logNotification,
} from './pb-client.js'
import { sendMessage } from './telegram.js'
import { getLocalTime, isInQuietHours, toKey, getMonday } from './date.js'
import { getStreak } from './streak.js'
import { weeklyReportMessage } from './templates.js'
import { ALLOWED_TELEGRAM_ID } from './config.js'
import { isTappable, reminderTime } from './blocks.js'
import { blockHabits, expireBlocks, renderBlock } from './bot.js'
import type { Habit, HabitLog } from './types.js'

function buildDoneDates(logs: HabitLog[], habitId: string): Set<string> {
  const dates = new Set<string>()
  for (const log of logs) {
    if (log.habit === habitId && log.value > 0) {
      dates.add(log.date)
    }
  }
  return dates
}

function isDoneForDate(logs: HabitLog[], habitId: string, dateKey: string, goal: number = 1): boolean {
  let total = 0
  for (const log of logs) {
    if (log.habit === habitId && log.date === dateKey) {
      total += log.value
    }
  }
  return total >= goal
}

function countWeekDone(logs: HabitLog[], habitId: string, dateKey: string): number {
  const d = new Date(dateKey)
  const monday = getMonday(d)
  let count = 0
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const key = toKey(day)
    if (key > dateKey) break
    for (const log of logs) {
      if (log.habit === habitId && log.date === key && log.value > 0) {
        count++
        break
      }
    }
  }
  return count
}

async function sendAndLog(
  chatId: string,
  userId: string,
  type: string,
  dateKey: string,
  text: string,
  slot?: string,
  habitId?: string
) {
  const messageId = await sendMessage(chatId, text)
  if (messageId) {
    await logNotification({
      user: userId,
      type,
      habit: habitId,
      sent_at: new Date().toISOString(),
      date_key: dateKey,
      message_id: messageId,
      slot,
    })
    console.log(`[notify] ${type}${slot ? ':' + slot : ''} -> user ${userId}`)
  }
}

export async function tick() {
  // бот одного пользователя: остальные записи в базе не трогаем и ничего им не шлём
  if (!ALLOWED_TELEGRAM_ID) return
  const user = await getUserByTelegramId(ALLOWED_TELEGRAM_ID)
  if (!user) return
  const settings = await getSettingsForUser(user.id)
  if (!settings || settings.enabled === false) return
  await processUser({ ...settings, user: user.id }, ALLOWED_TELEGRAM_ID)
}

async function processUser(settings: any, chatId: string) {
  const userId: string = settings.user
  const timezone: string = settings.timezone || 'Asia/Barnaul'
  const { hours, minutes, dayOfWeek, dateKey } = getLocalTime(timezone)
  const currentTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  // ─── Полночь: у вышедших из запаса блоков снять кнопки (до проверки тихих часов) ──
  if (hours === 0 && minutes === 0) {
    await expireBlocks(userId, chatId, dateKey)
  }

  if (isInQuietHours(hours, minutes, settings.quiet_hours_from, settings.quiet_hours_to)) {
    return
  }

  const habits = await getHabitsForUser(userId)
  if (habits.length === 0) return

  // ─── Сообщение-блок: все привычки этого времени, с кнопками отметки ──────
  const times = new Set(habits.map(reminderTime).filter((t): t is string => !!t))
  if (times.has(currentTimeStr) && blockHabits(habits, currentTimeStr).length > 0) {
    const slot = `block_${currentTimeStr}`
    if (!(await wasNotificationSent(userId, 'reminder', dateKey, slot))) {
      const block = await renderBlock(userId, currentTimeStr, dateKey, dateKey)
      // всё уже отмечено — молчим; блок из одних счётчиков — просто напоминание с кнопкой приложения
      if (!block.complete || !block.habits.some(isTappable)) {
        const messageId = await sendMessage(chatId, block.text, { replyMarkup: block.markup })
        if (messageId) {
          await logNotification({
            user: userId,
            type: 'reminder',
            sent_at: new Date().toISOString(),
            date_key: dateKey,
            message_id: messageId,
            slot,
          })
          console.log(`[notify] block ${currentTimeStr} -> user ${userId}`)
        }
      }
    }
  }

  const logs = await getLogsForUser(userId)

  // ─── Weekly report (previous full week, Mon–Sun) ────────────────────────
  if (settings.weekly_report) {
    const reportDay = settings.weekly_report_day ?? 1
    if (dayOfWeek === reportDay && hours === 10 && minutes === 0) {
      const alreadySent = await wasNotificationSent(userId, 'weekly_report', dateKey)
      if (!alreadySent) {
        // Calculate stats for the previous full Mon–Sun week
        const todayDate = new Date(dateKey)
        const sunday = new Date(todayDate)
        sunday.setDate(todayDate.getDate() - ((dayOfWeek === 0 ? 7 : dayOfWeek)))
        const monday = new Date(sunday)
        monday.setDate(sunday.getDate() - 6)

        let totalDone = 0
        let totalSlots = 0
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday)
          d.setDate(monday.getDate() + i)
          const key = toKey(d)
          for (const h of habits) {
            totalSlots++
            const goalForCheck = h.type === 'counter' ? h.goal : 1
            if (isDoneForDate(logs, h.id, key, goalForCheck)) totalDone++
          }
        }

        const pct = totalSlots > 0 ? Math.round((totalDone / totalSlots) * 100) : 0

        const topStreaks = habits
          .map((h) => {
            const doneDates = buildDoneDates(logs, h.id)
            const streak = getStreak(doneDates, h.type, h.goal, dateKey)
            return { name: h.name, streak, unit: h.type === 'periodic' ? 'нед' : 'д' }
          })
          .filter((s) => s.streak > 0)
          .sort((a, b) => b.streak - a.streak)
          .slice(0, 3)

        const text = weeklyReportMessage(pct, totalDone, totalSlots, topStreaks)
        await sendAndLog(chatId, userId, 'weekly_report', dateKey, text)
      }
    }
  }
}
