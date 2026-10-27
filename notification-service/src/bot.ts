// Бот: отметки кнопками под сообщениями (блоки и утреннее «Вчера»), фраза-закрытие, команды.
import { BACKFILL_DAYS, isAllowed, isEvening } from './config.js'
import {
  blockKeyboard,
  blockText,
  blockTitle,
  escapeHtml,
  isComplete,
  isMarkable,
  isTappable,
  parseCallback,
  parseTaskCallback,
  reminderTime,
  taskButtons,
  tasksLines,
  visibleTasks,
  yesterdayText,
  type InlineButton,
} from './blocks.js'
import { getLocalTime } from './date.js'
import { syncSheet } from './export.js'
import { pickClosing } from './phrases.js'
import {
  addNote,
  addPhrase,
  addTask,
  deactivatePhrase,
  getBlockMessages,
  getDoneHabitIds,
  getHabit,
  getHabitsForUser,
  getPhrases,
  getSettingsForUser,
  getTask,
  getTasks,
  getUserByTelegramId,
  logNotification,
  markPhraseShown,
  toggleHabitLog,
  toggleTask,
  wasNotificationSent,
} from './pb-client.js'
import { answerCallback, editMessage, handleStart, sendApp, sendMessage, WEBAPP_URL, type TelegramUpdate } from './telegram.js'
import type { Habit } from './types.js'

export const blockSlot = (time: string) => `block_${time}`

/** Привычки одного блока: активные, с тем же временем напоминания, в порядке приложения. */
export function blockHabits(habits: Habit[], time: string): Habit[] {
  return habits.filter((h) => !h.isArchived && reminderTime(h) === time).sort((a, b) => a.order - b.order)
}

/** Привычки для «Вчера»: все активные (счётчики — без кнопки). */
export function summaryHabits(habits: Habit[]): Habit[] {
  return habits.filter((h) => !h.isArchived).sort((a, b) => a.order - b.order)
}

export const isSkipped = (userId: string, dateKey: string, time: string) =>
  wasNotificationSent(userId, 'skip', dateKey, blockSlot(time))

export async function renderBlock(userId: string, time: string, dateKey: string, todayKey: string) {
  const habits = blockHabits(await getHabitsForUser(userId), time)
  const done = await getDoneHabitIds(userId, dateKey)
  const markable = isMarkable(dateKey, todayKey, BACKFILL_DAYS) && !(await isSkipped(userId, dateKey, time))
  return {
    habits,
    done,
    complete: isComplete(habits, done),
    text: blockText(time, habits, done),
    markup: blockKeyboard(habits, done, dateKey, WEBAPP_URL, markable),
  }
}

/** Вставить ряды кнопок перед кнопкой приложения (она всегда последняя). */
function withRows(markup: { inline_keyboard: InlineButton[][] } | undefined, rows: InlineButton[][]) {
  const all = markup?.inline_keyboard ?? []
  const app = all.length && all[all.length - 1][0]?.web_app ? [all[all.length - 1]] : []
  const merged = [...all.slice(0, all.length - app.length), ...rows, ...app]
  return merged.length ? { inline_keyboard: merged } : undefined
}

/** Утреннее «Вчера»: привычки за вчера + открытые задачи (кнопки задач — пока сообщение не устарело). */
export async function renderYesterday(userId: string, dateKey: string, todayKey: string) {
  const habits = summaryHabits(await getHabitsForUser(userId))
  const done = await getDoneHabitIds(userId, dateKey)
  const markable = isMarkable(dateKey, todayKey, BACKFILL_DAYS)
  const tasks = visibleTasks(await getTasks(userId), new Date(), todayKey)
  const text = tasks.length
    ? `${yesterdayText(habits, done)}\n\n<b>Задачи</b>\n${tasksLines(tasks).join('\n')}`
    : yesterdayText(habits, done)
  const markup = blockKeyboard(habits, done, dateKey, WEBAPP_URL, markable, 'y')
  return { habits, done, text, markup: withRows(markup, markable ? taskButtons(tasks, dateKey) : []) }
}

/** /задачи: открытые задачи кнопками (+ сделанные за сутки — чтобы можно было вернуть). */
export async function renderTaskList(userId: string, todayKey: string) {
  const tasks = visibleTasks(await getTasks(userId), new Date(), todayKey)
  const text = tasks.length ? ['<b>Задачи</b>', ...tasksLines(tasks)].join('\n') : 'Открытых задач нет.'
  const app = WEBAPP_URL ? [[{ text: 'Открыть приложение', web_app: { url: WEBAPP_URL } }]] : []
  const rows = [...taskButtons(tasks, 'l'), ...app]
  return { text, markup: rows.length ? { inline_keyboard: rows } : undefined }
}

async function userZone(userId: string): Promise<string> {
  return (await getSettingsForUser(userId))?.timezone || 'Asia/Barnaul'
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

const closingSent = new Set<string>() // дребезг тапов: одна фраза на блок

/** Вечерний блок отмечен целиком в свой день — одна фраза-закрытие. */
async function maybeClose(userId: string, chatId: string, time: string, dateKey: string, todayKey: string) {
  if (!isEvening(time) || dateKey !== todayKey) return
  const key = `${dateKey}:${time}`
  if (closingSent.has(key)) return
  const block = await renderBlock(userId, time, dateKey, todayKey)
  if (!block.complete || block.habits.filter(isTappable).length === 0) return
  if (await wasNotificationSent(userId, 'closing', dateKey, blockSlot(time))) return
  closingSent.add(key)
  const phrase = pickClosing(await getPhrases('closing'), await getPhrases('own'), new Date())
  if (!phrase) return
  const messageId = await sendMessage(chatId, escapeHtml(phrase.text), { withAppButton: false })
  await markPhraseShown(phrase.id, new Date().toISOString())
  await logNotification({
    user: userId, type: 'closing', sent_at: new Date().toISOString(), date_key: dateKey,
    message_id: messageId || undefined, slot: blockSlot(time),
  })
}

async function onTaskCallback(cb: NonNullable<TelegramUpdate['callback_query']>, taskId: string, where: string) {
  const task = await getTask(taskId)
  if (!task || !cb.message) {
    await answerCallback(cb.id)
    return
  }
  await answerCallback(cb.id)
  const state = await toggleTask(task)
  const timezone = await userZone(task.user)
  if (state === null) console.error('[bot] task toggle failed', task.id)
  else void syncSheet(task.user, timezone)
  const chatId = String(cb.message.chat.id)
  const messageId = String(cb.message.message_id)
  const todayKey = getLocalTime(timezone).dateKey
  await redraw(chatId, messageId, () =>
    where === 'l' ? renderTaskList(task.user, todayKey) : renderYesterday(task.user, where, todayKey)
  )
}

async function onCallback(cb: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
  const taskCb = parseTaskCallback(cb.data)
  if (taskCb) return onTaskCallback(cb, taskCb.taskId, taskCb.where)
  const parsed = parseCallback(cb.data)
  const habit = parsed && (await getHabit(parsed.habitId))
  if (!parsed || !habit || !cb.message) {
    console.log(`[bot] callback ignored: ${cb.data} (${!parsed ? 'неизвестный формат — старая кнопка?' : !habit ? 'привычка не найдена' : 'нет сообщения'})`)
    await answerCallback(cb.id, parsed ? 'Привычка не найдена' : 'Эта кнопка устарела')
    return
  }
  const timezone = await userZone(habit.user)
  const todayKey = getLocalTime(timezone).dateKey
  const time = reminderTime(habit)
  const skipped = parsed.kind === 'h' && !!time && (await isSkipped(habit.user, parsed.dateKey, time))
  if (!isMarkable(parsed.dateKey, todayKey, BACKFILL_DAYS) || skipped) {
    await answerCallback(cb.id, skipped ? 'Блок пропущен' : 'Этот день уже не отметить')
  } else {
    await answerCallback(cb.id) // сразу гасим «загрузку» на кнопке
    const state = await toggleHabitLog(habit.id, parsed.dateKey)
    console.log(`[bot] ${habit.name} ${parsed.dateKey} -> ${state === null ? 'ОШИБКА' : state ? 'отмечено' : 'снято'}`)
    if (state === null) console.error('[bot] toggle failed', habit.id, parsed.dateKey)
    else void syncSheet(habit.user, timezone)
  }
  const chatId = String(cb.message.chat.id)
  const messageId = String(cb.message.message_id)
  if (parsed.kind === 'y') {
    await redraw(chatId, messageId, () => renderYesterday(habit.user, parsed.dateKey, todayKey))
    return
  }
  if (!time) return
  await redraw(chatId, messageId, () => renderBlock(habit.user, time, parsed.dateKey, todayKey))
  await maybeClose(habit.user, chatId, time, parsed.dateKey, todayKey)
}

// ─── команды ────────────────────────────────────────────────────────────────

const PHRASE_USAGE =
  'Текст фразы — после команды: <code>/фраза не обязательно хорошо, достаточно сделать</code>\n' +
  'Она придёт вечером в доводчике, когда блок ещё не закрыт.'

/** `/Фраза@bot текст` → { cmd: 'фраза', args: 'текст' } */
export function parseCommand(text: string): { cmd: string; args: string } | null {
  const m = /^\/([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/.exec(text.trim())
  return m ? { cmd: m[1].toLowerCase(), args: (m[2] || '').trim() } : null
}

/** Время блока по аргументу /skip: '21:30', 'вечер', 'утро', 'день'. */
export function findBlockTime(arg: string, times: string[]): string | null {
  const a = arg.trim().toLowerCase()
  if (!a) return null
  if (times.includes(a)) return a
  const byTitle = times.filter((t) => blockTitle(t).toLowerCase().startsWith(a))
  return byTitle.length === 1 ? byTitle[0] : null
}

async function blockTimes(userId: string): Promise<string[]> {
  const habits = await getHabitsForUser(userId)
  return [...new Set(habits.map(reminderTime).filter((t): t is string => !!t))].sort()
}

async function todayText(userId: string, timezone: string): Promise<string> {
  const { dateKey, hours, minutes } = getLocalTime(timezone)
  const now = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  const times = await blockTimes(userId)
  if (times.length === 0) return 'Привычек с напоминанием пока нет — они заводятся в приложении.'
  const parts: string[] = []
  for (const time of times) {
    const block = await renderBlock(userId, time, dateKey, dateKey)
    const status = (await isSkipped(userId, dateKey, time))
      ? 'пропущен'
      : block.complete ? 'закрыт' : time > now ? `в ${time}` : 'открыт'
    parts.push(block.text.replace('</b>', `</b> · ${status}`))
  }
  return parts.join('\n\n')
}

async function skip(userId: string, chatId: string, arg: string, timezone: string): Promise<string> {
  const { dateKey } = getLocalTime(timezone)
  const times = await blockTimes(userId)
  const time = findBlockTime(arg, times)
  if (!time) {
    const list = times.map((t) => `<code>/skip ${t}</code> — ${blockTitle(t)}`).join('\n')
    return `Какой блок закрыть?\n${list || 'Блоков пока нет.'}`
  }
  const title = blockTitle(time)
  if (await isSkipped(userId, dateKey, time)) return `«${title}» на сегодня уже закрыт.`
  await logNotification({ user: userId, type: 'skip', sent_at: new Date().toISOString(), date_key: dateKey, slot: blockSlot(time) })
  for (const log of await getBlockMessages(userId, dateKey)) {
    if (log.slot === blockSlot(time) && log.message_id) {
      await redraw(chatId, log.message_id, () => renderBlock(userId, time, dateKey, dateKey))
    }
  }
  return `«${title}» на сегодня закрыт.`
}

async function onCommand(chatId: string, cmd: string, args: string): Promise<void> {
  if (cmd === 'start') return handleStart(chatId)
  if (cmd === 'app' || cmd === 'приложение') return sendApp(chatId)
  const user = await getUserByTelegramId(chatId)
  if (!user) {
    await sendMessage(chatId, 'Сначала открой приложение — там заводятся привычки.')
    return
  }
  const timezone = await userZone(user.id)
  const reply = (text: string) => sendMessage(chatId, text, { withAppButton: false })

  switch (cmd) {
    case 'today':
      await reply(await todayText(user.id, timezone))
      return
    case 'skip':
      await reply(await skip(user.id, chatId, args, timezone))
      return
    case 'фраза':
    case 'phrase': {
      if (!args) {
        await reply(PHRASE_USAGE)
        return
      }
      const phrase = await addPhrase('own', args)
      await reply(phrase ? 'Записано в свои фразы.' : 'Не получилось записать, попробуй ещё раз.')
      return
    }
    case 'фразы':
    case 'phrases': {
      const own = await getPhrases('own')
      if (own.length === 0) {
        await reply('Своих фраз пока нет. Добавляются так: <code>/фраза текст</code>')
        return
      }
      // номера — порядковые по списку (он отсортирован по времени добавления); /удали N убирает N-ю
      const lines = own.map((p, i) => `${i + 1}. ${escapeHtml(p.text)}`)
      await reply(['<b>Свои фразы</b>', ...lines, '', 'Убрать: <code>/удали номер</code>'].join('\n'))
      return
    }
    case 'удали':
    case 'unphrase': {
      const n = parseInt(args.replace(/^#/, ''), 10)
      if (!n) {
        await reply('Номер фразы после команды: <code>/удали 2</code>. Номера — в /фразы.')
        return
      }
      const own = await getPhrases('own')
      const phrase = own[n - 1]
      if (!phrase) {
        await reply(`Фразы под номером ${n} нет. Список — в /фразы.`)
        return
      }
      await reply((await deactivatePhrase(phrase.id)) ? `Убрал: «${escapeHtml(phrase.text)}».` : 'Не получилось убрать, попробуй ещё раз.')
      return
    }
    case 'задача':
    case 'task':
    case 'todo': {
      if (!args) {
        await reply('Текст задачи — после команды: <code>/задача купить корм коту</code>')
        return
      }
      const task = await addTask(user.id, args, getLocalTime(timezone).dateKey)
      if (task) void syncSheet(user.id, timezone)
      await reply(task ? 'Записано в задачи.' : 'Не получилось записать, попробуй ещё раз.')
      return
    }
    case 'задачи':
    case 'tasks': {
      const list = await renderTaskList(user.id, getLocalTime(timezone).dateKey)
      await sendMessage(chatId, list.text, { replyMarkup: list.markup })
      return
    }
    case 'мысль':
    case 'note': {
      if (!args) {
        await reply('Текст — после команды: <code>/мысль ...</code>')
        return
      }
      const note = await addNote(args)
      if (note) void syncSheet(user.id, timezone)
      await reply(note ? 'Записано.' : 'Не получилось записать, попробуй ещё раз.')
      return
    }
  }
}

export async function onUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    const cb = update.callback_query
    if (!isAllowed(cb.from.id)) {
      console.log('[bot] callback from not allowed user', cb.from.id)
      return
    }
    const t0 = Date.now()
    await onCallback(cb)
    console.log(`[bot] callback ${cb.data} handled in ${Date.now() - t0} ms`)
    return
  }
  const message = update.message
  const chatId = message?.chat?.id
  const command = parseCommand(String(message?.text || ''))
  if (!chatId || !command || !isAllowed(message?.from?.id)) return
  await onCommand(String(chatId), command.cmd, command.args)
}

/** Полночь: у сообщений, вышедших из запаса на отметку, снять кнопки (остаётся «открыть приложение»). */
export async function expireBlocks(userId: string, chatId: string, todayKey: string): Promise<void> {
  const [y, m, d] = todayKey.split('-').map(Number)
  const expired = new Date(Date.UTC(y, m - 1, d - BACKFILL_DAYS - 1)).toISOString().slice(0, 10)
  for (const log of await getBlockMessages(userId, expired)) {
    const time = log.slot?.startsWith('block_') ? log.slot.slice('block_'.length) : null
    if (!time || !log.message_id) continue
    await redraw(chatId, log.message_id, () => renderBlock(userId, time, expired, todayKey))
  }
  for (const log of await getBlockMessages(userId, expired, 'yesterday')) {
    if (log.message_id) await redraw(chatId, log.message_id, () => renderYesterday(userId, expired, todayKey))
  }
}
