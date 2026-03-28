import type { Habit } from './types.js'

const CATEGORY_EMOJI: Record<string, string> = {
  body: '💧',
  move: '🏃',
  focus: '🧠',
  read: '📖',
  mind: '🧘',
  food: '🍎',
  social: '👥',
  other: '✨',
}

function habitEmoji(habit: Habit): string {
  return CATEGORY_EMOJI[habit.category] || '✨'
}

function streakLabel(streak: number, type: string): string {
  if (streak <= 0) return ''
  if (type === 'periodic') return `серия ${streak} нед`
  return `серия ${streak} д`
}

function greeting(hours: number): string {
  if (hours >= 5 && hours < 12) return 'Доброе утро!'
  if (hours >= 12 && hours < 17) return 'Добрый день!'
  if (hours >= 17 && hours < 23) return 'Добрый вечер!'
  return 'Доброй ночи!'
}

// ─── Reminders (grouped) ─────────────────────────────────────────────────────

export function reminderMessage(habits: { habit: Habit; streak: number }[], hours: number): string {
  if (habits.length === 1) {
    const { habit, streak } = habits[0]
    const s = streak > 0 ? ` (${streakLabel(streak, habit.type)} 🔥)` : ''
    return `${greeting(hours)}\n\nНе забудь: ${habitEmoji(habit)} <b>${habit.name}</b>${s}`
  }

  const lines = habits.map(({ habit, streak }) => {
    const s = streak > 0 ? ` (${streakLabel(streak, habit.type)} 🔥)` : ''
    return ` · ${habitEmoji(habit)} ${habit.name}${s}`
  })

  return `${greeting(hours)}\n\nСегодня у тебя:\n${lines.join('\n')}`
}

// ─── Morning digest ──────────────────────────────────────────────────────────

export function morningDigestMessage(
  habits: { habit: Habit; streak: number }[],
  yesterdayDone: number,
  yesterdayTotal: number
): string {
  const lines = habits.map(({ habit, streak }) => {
    const s = streak > 0 ? ` (${streakLabel(streak, habit.type)} 🔥)` : ''
    return ` · ${habitEmoji(habit)} ${habit.name}${s}`
  })

  let msg = `☀️ <b>Доброе утро!</b>\n\nПлан на сегодня:\n${lines.join('\n')}`

  if (yesterdayTotal > 0) {
    const pct = Math.round((yesterdayDone / yesterdayTotal) * 100)
    msg += `\n\nВчера: ${yesterdayDone}/${yesterdayTotal} (${pct}%)`
    if (yesterdayDone === yesterdayTotal) msg += ' ✅'
  }

  return msg
}

// ─── Evening summary ─────────────────────────────────────────────────────────

export function eveningSummaryMessage(
  done: Habit[],
  remaining: Habit[],
  totalHabits: number
): string {
  let msg = '🌙 <b>Итог дня</b>\n\n'

  if (done.length > 0) {
    msg += `Выполнено: ${done.map((h) => habitEmoji(h) + ' ' + h.name).join(', ')}\n`
  }

  if (remaining.length > 0) {
    msg += `Осталось: ${remaining.map((h) => habitEmoji(h) + ' ' + h.name).join(', ')}\n`
  }

  msg += `\n${done.length}/${totalHabits} сделано сегодня`

  if (done.length === totalHabits) {
    msg += ' 🎉'
  }

  return msg
}

// ─── Streak protection ───────────────────────────────────────────────────────

export function streakProtectionMessage(habit: Habit, streak: number): string {
  return (
    `⚡️ <b>Серия под угрозой!</b>\n\n` +
    `${habitEmoji(habit)} <b>${habit.name}</b> — ${streakLabel(streak, habit.type)} 🔥\n` +
    `Осталось несколько часов до конца дня.`
  )
}

export function periodicStreakProtectionMessage(
  habit: Habit,
  weekDone: number,
  weekGoal: number,
  streak: number
): string {
  return (
    `⚡️ <b>Неделя заканчивается!</b>\n\n` +
    `${habitEmoji(habit)} <b>${habit.name}</b> — ${weekDone}/${weekGoal} на этой неделе\n` +
    `Серия: ${streak} нед 🔥\nЕщё можно успеть!`
  )
}

// ─── Weekly report ───────────────────────────────────────────────────────────

export function weeklyReportMessage(
  completionPct: number,
  totalDone: number,
  totalSlots: number,
  topStreaks: { name: string; streak: number; unit: string }[]
): string {
  let msg = `📊 <b>Отчёт за неделю</b>\n\n`
  msg += `Выполнение: ${completionPct}% (${totalDone}/${totalSlots})\n`

  if (topStreaks.length > 0) {
    const best = topStreaks[0]
    msg += `Лучшая серия: ${best.name} — ${best.streak} ${best.unit} 🔥\n`
  }

  if (completionPct >= 90) {
    msg += `\nОтличная неделя! Так держать 💪`
  } else if (completionPct >= 70) {
    msg += `\nХорошая неделя! Продолжай в том же духе 👍`
  } else {
    msg += `\nНовая неделя — новый старт 🚀`
  }

  return msg
}

// ─── Return nudge ────────────────────────────────────────────────────────────

export function returnNudgeSoft(): string {
  return `Привет! Давно не виделись 👋\n\nТвои привычки ждут. Даже маленький шаг сегодня — это уже прогресс.`
}

export function returnNudgeStrong(): string {
  return `Привет! Прошла неделя с твоего последнего визита.\n\nНе обязательно делать всё сразу — начни с одной привычки. Каждый день на счету 💪`
}
