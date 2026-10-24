import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  blockKeyboard,
  blockText,
  blockTitle,
  isComplete,
  isMarkable,
  parseCallback,
  reminderTime,
} from '../src/blocks.js'
import { blockHabits } from '../src/bot.js'
import type { Habit } from '../src/types.js'

const habit = (id: string, name: string, extra: Partial<Habit> = {}): Habit => ({
  id, user: 'u1', name, category: 'body', type: 'daily', goal: 1, goalDays: null, daysGoal: null,
  reminder: 'custom', reminder_time: '21:30', isArchived: false, order: 0, created: '', ...extra,
})

const evening = [
  habit('shower', 'Душ', { order: 0 }),
  habit('teeth', 'Зубы', { order: 1 }),
  habit('water', 'Вода', { type: 'counter', goal: 8, order: 2 }),
]

test('время напоминания', () => {
  assert.equal(reminderTime(habit('a', 'x', { reminder: 'evening', reminder_time: '' })), '21:00')
  assert.equal(reminderTime(habit('a', 'x', { reminder: 'custom', reminder_time: '21:30' })), '21:30')
  assert.equal(reminderTime(habit('a', 'x', { reminder: 'none' })), null)
})

test('блок — привычки одного времени, без архивных, по порядку', () => {
  const all = [
    habit('b', 'B', { order: 2 }), habit('a', 'A', { order: 1 }),
    habit('c', 'C', { reminder_time: '20:00' }), habit('d', 'D', { isArchived: true }),
  ]
  assert.deepEqual(blockHabits(all, '21:30').map((h) => h.id), ['a', 'b'])
})

test('текст: нейтральный, с отметками и экранированием', () => {
  const text = blockText('21:30', [habit('a', 'Душ <тёплый>'), habit('b', 'Зубы')], new Set(['a']))
  assert.equal(text, '<b>Вечер · 21:30</b>\n✅ Душ &lt;тёплый&gt;\n▫️ Зубы')
  assert.equal(blockTitle('08:00'), 'Утро · 08:00')
  assert.equal(blockTitle('13:00'), 'День · 13:00')
})

test('кнопки: по одной на привычку, счётчик без кнопки, дата в callback', () => {
  const kb = blockKeyboard(evening, new Set(['shower']), '2026-10-24', 'https://app', true)!
  assert.deepEqual(kb.inline_keyboard.map((r) => r[0].text), ['✅ Душ', 'Зубы', 'Открыть приложение'])
  assert.equal(kb.inline_keyboard[1][0].callback_data, 'h:teeth:2026-10-24')
})

test('всё отмечено или день вышел из запаса — только кнопка приложения', () => {
  const done = new Set(['shower', 'teeth'])
  assert.ok(isComplete(evening, done)) // счётчик не мешает закрытию
  assert.equal(blockKeyboard(evening, done, '2026-10-24', 'https://app', true)!.inline_keyboard.length, 1)
  assert.equal(blockKeyboard(evening, new Set(), '2026-10-22', 'https://app', false)!.inline_keyboard.length, 1)
  assert.equal(blockKeyboard(evening, done, '2026-10-24', '', true), undefined)
})

test('разбор нажатия', () => {
  assert.deepEqual(parseCallback('h:228c8g2igvyf80q:2026-10-24'), { kind: 'h', habitId: '228c8g2igvyf80q', dateKey: '2026-10-24' })
  assert.equal(parseCallback('h:x:bad'), null)
  assert.equal(parseCallback('item:5:2026-10-24'), null)
  assert.equal(parseCallback(undefined), null)
})

test('отметить можно сегодня и вчера', () => {
  assert.ok(isMarkable('2026-10-24', '2026-10-24', 1))
  assert.ok(isMarkable('2026-10-23', '2026-10-24', 1))
  assert.ok(!isMarkable('2026-10-22', '2026-10-24', 1))
  assert.ok(!isMarkable('2026-10-25', '2026-10-24', 1))
  assert.ok(isMarkable('2026-10-31', '2026-11-01', 1)) // через месяц
})
