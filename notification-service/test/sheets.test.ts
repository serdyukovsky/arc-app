import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asText, habitRows, localTime, logRows } from '../src/sheets.js'
import { reminderTime } from '../src/blocks.js'
import type { Habit, HabitLog } from '../src/types.js'

const habit = (id: string, name: string, extra: Partial<Habit> = {}): Habit => ({
  id, user: 'u1', name, category: 'body', type: 'daily', goal: 1, goalDays: null, daysGoal: null,
  reminder: 'custom', reminder_time: '21:30', isArchived: false, order: 0, created: '', ...extra,
})
const log = (habitId: string, date: string, value: number, created?: string): HabitLog =>
  ({ id: `${habitId}-${date}`, habit: habitId, date, value, created })

test('привычки: активные сверху, тип и цель по-человечески', () => {
  const rows = habitRows([
    habit('a', 'Старое', { isArchived: true }),
    habit('b', 'Тренировки', { type: 'periodic', goal: 3, reminder: 'evening', order: 1 }),
    habit('c', 'Душ', { order: 0 }),
  ], reminderTime)
  assert.deepEqual(rows, [
    ['Душ', 'каждый день', '', '21:30', ''],
    ['Тренировки', 'раз в неделю', '3 в неделю', '21:00', ''],
    ['Старое', 'каждый день', '', '21:30', 'да'],
  ])
})

test('отметки: по дате и времени, время — по Барнаулу, снятые и чужие не попадают', () => {
  const habits = [habit('shower', 'Душ'), habit('teeth', 'Зубы')]
  const rows = logRows([
    log('teeth', '2026-10-23', 1, '2026-10-23 17:06:20.123Z'),
    log('shower', '2026-10-23', 1, '2026-10-23 17:06:19.000Z'),
    log('shower', '2026-10-22', 1), // до миграции — без времени
    log('teeth', '2026-10-22', 0),
    log('ghost', '2026-10-22', 1),
  ], habits, 'Asia/Barnaul')
  assert.deepEqual(rows, [
    ['2026-10-22', 'Душ', '1', ''],
    ['2026-10-23', 'Душ', '1', '00:06'],
    ['2026-10-23', 'Зубы', '1', '00:06'],
  ])
})

test('время отметки после полуночи по местному — следующий час, дата блока своя', () => {
  assert.equal(localTime('2026-10-24T16:59:00Z', 'Asia/Barnaul'), '23:59')
  assert.equal(localTime(undefined, 'Asia/Barnaul'), '')
  assert.equal(localTime('мусор', 'Asia/Barnaul'), '')
})

test('формулы не исполняются', () => {
  assert.equal(asText('=HYPERLINK("x")'), `'=HYPERLINK("x")`)
  assert.equal(asText('Душ'), 'Душ')
})
