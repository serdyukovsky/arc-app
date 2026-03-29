import {
  getAllActiveSettings,
  getHabitsForUser,
  getLogsForUser,
  getUserRecord,
  extractTelegramId,
  wasNotificationSent,
  logNotification,
} from './pb-client.js'
import { sendMessage } from './telegram.js'
import { getLocalTime, parseTime, isInQuietHours, toKey, getMonday } from './date.js'
import { getStreak } from './streak.js'
import {
  reminderMessage,
  morningDigestMessage,
  eveningSummaryMessage,
  streakProtectionMessage,
  periodicStreakProtectionMessage,
  weeklyReportMessage,
  returnNudgeSoft,
  returnNudgeStrong,
} from './templates.js'
import type { Habit, HabitLog } from './types.js'

const REMINDER_SLOTS: Record<string, string> = {
  morning: '08:00',
  day: '13:00',
  evening: '21:00',
}

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
  const settingsList = await getAllActiveSettings()
  if (settingsList.length === 0) return

  for (const settings of settingsList) {
    try {
      await processUser(settings)
    } catch (err) {
      console.error(`[scheduler] Error processing user ${settings.user}:`, err)
    }
  }
}

async function processUser(settings: any) {
  const userId: string = settings.user
  const timezone: string = settings.timezone || 'UTC'
  const { hours, minutes, dayOfWeek, dateKey } = getLocalTime(timezone)

  // Quiet hours check
  if (isInQuietHours(hours, minutes, settings.quiet_hours_from, settings.quiet_hours_to)) {
    return
  }

  // Get user Telegram chat ID
  const userRecord = await getUserRecord(userId)
  if (!userRecord) return
  const chatId = extractTelegramId(userRecord.email)
  if (!chatId) return

  // Load habits and logs
  const habits = await getHabitsForUser(userId)
  if (habits.length === 0) return
  const logs = await getLogsForUser(userId)

  // Recently active check (skip reminders if active in last 30 min)
  const lastActive = settings.last_active ? new Date(settings.last_active).getTime() : 0
  const recentlyActive = Date.now() - lastActive < 30 * 60 * 1000

  const currentTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  // ─── Habit reminders (grouped by time slot) ─────────────────────────────
  if (!recentlyActive) {
    const reminderGroups = new Map<string, { habit: Habit; streak: number }[]>()

    for (const habit of habits) {
      if (habit.reminder === 'none') continue

      let targetTime: string
      if (habit.reminder === 'custom' && habit.reminder_time) {
        targetTime = habit.reminder_time
      } else {
        targetTime = REMINDER_SLOTS[habit.reminder] || ''
      }
      if (!targetTime) continue

      const target = parseTime(targetTime)
      if (hours !== target.hours || minutes !== target.minutes) continue

      // Check if already done today
      const goalForCheck = habit.type === 'counter' ? habit.goal : 1
      if (isDoneForDate(logs, habit.id, dateKey, goalForCheck)) continue

      const doneDates = buildDoneDates(logs, habit.id)
      const streak = getStreak(doneDates, habit.type, habit.goal, dateKey)
      const slot = habit.reminder === 'custom' ? `custom_${targetTime}` : habit.reminder

      if (!reminderGroups.has(slot)) reminderGroups.set(slot, [])
      reminderGroups.get(slot)!.push({ habit, streak })
    }

    for (const [slot, group] of reminderGroups) {
      const alreadySent = await wasNotificationSent(userId, 'reminder', dateKey, slot)
      if (alreadySent) continue
      const text = reminderMessage(group, hours)
      await sendAndLog(chatId, userId, 'reminder', dateKey, text, slot)
    }
  }

  // ─── Morning digest ─────────────────────────────────────────────────────
  if (settings.morning_digest) {
    const digestTime = parseTime(settings.morning_digest_time || '08:00')
    if (hours === digestTime.hours && minutes === digestTime.minutes) {
      const alreadySent = await wasNotificationSent(userId, 'morning_digest', dateKey)
      if (!alreadySent) {
        const habitStreaks = habits.map((h) => {
          const doneDates = buildDoneDates(logs, h.id)
          return { habit: h, streak: getStreak(doneDates, h.type, h.goal, dateKey) }
        })

        // Yesterday stats
        const yesterday = new Date(dateKey)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayKey = toKey(yesterday)
        let yesterdayDone = 0
        for (const h of habits) {
          const goalForCheck = h.type === 'counter' ? h.goal : 1
          if (isDoneForDate(logs, h.id, yesterdayKey, goalForCheck)) yesterdayDone++
        }

        const text = morningDigestMessage(habitStreaks, yesterdayDone, habits.length)
        await sendAndLog(chatId, userId, 'morning_digest', dateKey, text)
      }
    }
  }

  // ─── Evening summary ────────────────────────────────────────────────────
  if (settings.evening_summary) {
    const summaryTime = parseTime(settings.evening_summary_time || '21:00')
    if (hours === summaryTime.hours && minutes === summaryTime.minutes) {
      const alreadySent = await wasNotificationSent(userId, 'evening_summary', dateKey)
      if (!alreadySent) {
        const done: Habit[] = []
        const remaining: Habit[] = []
        for (const h of habits) {
          const goalForCheck = h.type === 'counter' ? h.goal : 1
          if (isDoneForDate(logs, h.id, dateKey, goalForCheck)) {
            done.push(h)
          } else {
            remaining.push(h)
          }
        }
        const text = eveningSummaryMessage(done, remaining, habits.length)
        await sendAndLog(chatId, userId, 'evening_summary', dateKey, text)
      }
    }
  }

  // ─── Streak protection (2 hours before quiet hours or at 20:00) ─────────
  if (settings.streak_protection && !recentlyActive) {
    const quietFrom = parseTime(settings.quiet_hours_from || '23:00')
    const protectionHour = ((quietFrom.hours - 2 + 24) % 24)
    if (hours === protectionHour && minutes === 0) {
      for (const habit of habits) {
        const doneDates = buildDoneDates(logs, habit.id)
        const streak = getStreak(doneDates, habit.type, habit.goal, dateKey)
        if (streak < 3) continue

        const goalForCheck = habit.type === 'counter' ? habit.goal : 1

        if (habit.type === 'periodic') {
          // Check if this week is at risk
          const weekDone = countWeekDone(logs, habit.id, dateKey)
          if (weekDone >= habit.goal) continue
          // Only warn on Friday-Sunday
          if (dayOfWeek < 5 && dayOfWeek !== 0) continue

          const alreadySent = await wasNotificationSent(userId, 'streak_protection', dateKey, habit.id)
          if (alreadySent) continue

          const text = periodicStreakProtectionMessage(habit, weekDone, habit.goal, streak)
          await sendAndLog(chatId, userId, 'streak_protection', dateKey, text, habit.id, habit.id)
        } else {
          if (isDoneForDate(logs, habit.id, dateKey, goalForCheck)) continue

          const alreadySent = await wasNotificationSent(userId, 'streak_protection', dateKey, habit.id)
          if (alreadySent) continue

          const text = streakProtectionMessage(habit, streak)
          await sendAndLog(chatId, userId, 'streak_protection', dateKey, text, habit.id, habit.id)
        }
      }
    }
  }

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

  // ─── Return nudge ──────────────────────────────────────────────────────
  if (lastActive > 0) {
    const daysSinceActive = Math.floor((Date.now() - lastActive) / (24 * 60 * 60 * 1000))

    if (daysSinceActive >= 2 && daysSinceActive < 7 && hours === 12 && minutes === 0) {
      const alreadySent = await wasNotificationSent(userId, 'return_nudge', dateKey)
      if (!alreadySent) {
        const text = returnNudgeSoft()
        await sendAndLog(chatId, userId, 'return_nudge', dateKey, text)
      }
    }

    if (daysSinceActive >= 7 && hours === 12 && minutes === 0) {
      // Send at most once per 7 days
      const alreadySent = await wasNotificationSent(userId, 'return_nudge', dateKey)
      if (!alreadySent) {
        const text = returnNudgeStrong()
        await sendAndLog(chatId, userId, 'return_nudge', dateKey, text)
      }
    }
  }
}
