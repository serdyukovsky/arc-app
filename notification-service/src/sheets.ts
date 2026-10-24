// Односторонняя выгрузка в Google Таблицу (ту же, что у finance-bot) — только для просмотра.
// Источник правды — PocketBase. Листы «Привычки» и «Отметки» каждый раз перезаписываются целиком,
// поэтому разъехаться не могут: правки руками в этих листах затрутся. Остальные листы не трогаем.
//
// Без googleapis: сервисный аккаунт → JWT (RS256, встроенный crypto) → access token → Sheets REST.
// Google с сервера доступен напрямую, прокси не нужен.
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Habit, HabitLog, Note, Task } from './types.js'

const SHEET_ID = (process.env.SHEET_ID || '').trim()
const CREDENTIALS = process.env.GOOGLE_CREDENTIALS || '/opt/arc-notifications/secrets/google.json'
const API = 'https://sheets.googleapis.com/v4/spreadsheets'

export const HABITS_SHEET = 'Привычки'
export const LOGS_SHEET = 'Отметки'
export const NOTES_SHEET = 'Мысли'
export const TASKS_SHEET = 'Задачи'
const TASKS_HEAD = ['Создана', 'Задача', 'Сделано', 'Когда сделано']
const NOTES_HEAD = ['Дата', 'Время', 'Мысль']
const HABITS_HEAD = ['Привычка', 'Тип', 'Цель', 'Напоминание', 'В архиве']
const LOGS_HEAD = ['Дата', 'Привычка', 'Значение', 'Время отметки']

const TYPE_LABEL: Record<string, string> = { daily: 'каждый день', periodic: 'раз в неделю', counter: 'счётчик' }

export const sheetsEnabled = (): boolean => !!SHEET_ID

// ─── строки (чистые функции) ────────────────────────────────────────────────

/** Текст, который таблица приняла бы за формулу, — как текст. */
export const asText = (s: string): string => (/^[=+\-@]/.test(s) ? `'${s}` : s)

export function habitRows(habits: Habit[], reminderOf: (h: Habit) => string | null): string[][] {
  return [...habits]
    .sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || a.order - b.order)
    .map((h) => [
      asText(h.name),
      TYPE_LABEL[h.type] || h.type,
      h.type === 'periodic' ? `${h.goal} в неделю` : h.type === 'counter' ? String(h.goal) : '',
      reminderOf(h) || '',
      h.isArchived ? 'да' : '',
    ])
}

/** Время отметки по часовому поясу пользователя; у старых записей (до миграции) — пусто. */
export function localTime(iso: string | undefined, timezone: string): string {
  if (!iso) return ''
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

export function logRows(logs: HabitLog[], habits: Habit[], timezone: string): string[][] {
  const names = new Map(habits.map((h) => [h.id, h.name]))
  return logs
    .filter((l) => l.value > 0 && names.has(l.habit))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.created || '').localeCompare(b.created || ''))
    .map((l) => [l.date, asText(names.get(l.habit)!), String(l.value), localTime(l.created, timezone)])
}

export function noteRows(notes: Note[], timezone: string): string[][] {
  const day = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(iso.replace(' ', 'T')))
  return [...notes]
    .sort((a, b) => a.created.localeCompare(b.created))
    .map((n) => [day(n.created), localTime(n.created, timezone), asText(n.text)])
}

export function taskRows(tasks: Task[], timezone: string): string[][] {
  const day = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(iso.replace(' ', 'T')))
  return [...tasks]
    .sort((a, b) => a.created.localeCompare(b.created))
    .map((t) => [
      day(t.created),
      asText(t.title),
      t.done ? 'да' : '',
      t.done && t.done_at ? `${day(t.done_at)} ${localTime(t.done_at, timezone)}` : '',
    ])
}

// ─── Google ─────────────────────────────────────────────────────────────────

let token: { value: string; until: number } | null = null

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value
  const key = JSON.parse(readFileSync(CREDENTIALS, 'utf8')) as { client_email: string; private_key: string }
  const now = Math.floor(Date.now() / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const signature = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(key.private_key)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claim}.${b64url(signature)}`,
    }),
  })
  if (!res.ok) throw new Error(`google token: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  token = { value: data.access_token, until: Date.now() + (data.expires_in - 300) * 1000 }
  return token.value
}

async function google<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API}/${SHEET_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`sheets ${method} ${path}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

async function sheetIds(): Promise<Map<string, number>> {
  const meta = await google<{ sheets: { properties: { title: string; sheetId: number } }[] }>(
    '?fields=sheets.properties(title,sheetId)'
  )
  return new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
}

async function writeSheet(ids: Map<string, number>, title: string, values: string[][]): Promise<void> {
  let sheetId = ids.get(title)
  if (sheetId === undefined) {
    const res = await google<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>(':batchUpdate', 'POST', {
      requests: [{ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } }],
    })
    sheetId = res.replies[0].addSheet.properties.sheetId
    await google(':batchUpdate', 'POST', {
      requests: [{
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      }],
    })
  }
  const cols = values[0].length
  // размер листа = данные: лишние строки (если данных стало меньше) уходят
  await google(':batchUpdate', 'POST', {
    requests: [{
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { rowCount: Math.max(values.length, 2), columnCount: cols } },
        fields: 'gridProperties.rowCount,gridProperties.columnCount',
      },
    }],
  })
  const range = encodeURIComponent(`'${title}'!A1`)
  await google(`/values/${range}?valueInputOption=USER_ENTERED`, 'PUT', { values })
}

// ─── выгрузка ───────────────────────────────────────────────────────────────

let last = ''

/** Перезаписать листы; если с прошлого раза ничего не поменялось — не трогать Google.
 *  noteValues = null — лист «Мысли» не трогаем (его пока ведёт routine-bot). */
export async function exportToSheet(
  habitValues: string[][],
  logValues: string[][],
  noteValues: string[][] | null = null,
  taskValues: string[][] | null = null
): Promise<boolean> {
  if (!SHEET_ID) return false
  const snapshot = JSON.stringify([habitValues, logValues, noteValues, taskValues])
  if (snapshot === last) return false
  const ids = await sheetIds()
  await writeSheet(ids, HABITS_SHEET, [HABITS_HEAD, ...habitValues])
  await writeSheet(ids, LOGS_SHEET, [LOGS_HEAD, ...logValues])
  if (noteValues) await writeSheet(ids, NOTES_SHEET, [NOTES_HEAD, ...noteValues])
  if (taskValues) await writeSheet(ids, TASKS_SHEET, [TASKS_HEAD, ...taskValues])
  last = snapshot
  return true
}
