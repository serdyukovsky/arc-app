// Выгрузка в таблицу: после нажатия в боте и раз в 5 минут (отметки из приложения).
// Частые вызовы склеиваются: идёт одна выгрузка, за ней — максимум одна догоняющая.
import { reminderTime } from './blocks.js'
import { EXPORT_NOTES } from './config.js'
import { getAllHabitsForUser, getLogsForUser, getNotes } from './pb-client.js'
import { exportToSheet, habitRows, logRows, noteRows, sheetsEnabled } from './sheets.js'

let running = false
let again = false

export async function syncSheet(userId: string, timezone: string): Promise<void> {
  if (!sheetsEnabled()) return
  if (running) {
    again = true
    return
  }
  running = true
  try {
    do {
      again = false
      const habits = await getAllHabitsForUser(userId)
      const logs = await getLogsForUser(userId, 3650)
      const notes = EXPORT_NOTES ? noteRows(await getNotes(), timezone) : null
      if (await exportToSheet(habitRows(habits, reminderTime), logRows(logs, habits, timezone), notes)) {
        console.log('[sheets] exported', logs.length, 'logs')
      }
    } while (again)
  } catch (err) {
    console.error('[sheets] export failed:', err) // догоним в следующий раз
  } finally {
    running = false
  }
}
