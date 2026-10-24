import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blockKeyboard, nudgeText, parseCallback, yesterdayText } from '../src/blocks.js'
import { findBlockTime, parseCommand } from '../src/bot.js'
import { pickClosing, pickPhrase } from '../src/phrases.js'
import { noteRows } from '../src/sheets.js'
import type { Habit, Phrase } from '../src/types.js'

const habit = (id: string, name: string, extra: Partial<Habit> = {}): Habit => ({
  id, user: 'u1', name, category: 'body', type: 'daily', goal: 1, goalDays: null, daysGoal: null,
  reminder: 'custom', reminder_time: '21:30', isArchived: false, order: 0, created: '', ...extra,
})
const phrase = (id: string, last?: string, slot: 'closing' | 'own' = 'closing'): Phrase =>
  ({ id, slot, text: `фраза ${id}`, last_shown_at: last, is_active: true })

test('фразы не повторяются неделю, при исчерпании — самая давняя', () => {
  const now = new Date('2026-10-24T12:00:00Z')
  const pool = [phrase('a', '2026-10-23T00:00:00Z'), phrase('b'), phrase('c', '2026-10-01T00:00:00Z')]
  for (let i = 0; i < 20; i++) assert.notEqual(pickPhrase(pool, now)!.id, 'a')
  const recent = [phrase('x', '2026-10-22T00:00:00Z'), phrase('y', '2026-10-20T00:00:00Z')]
  assert.equal(pickPhrase(recent, now)!.id, 'y')
  assert.equal(pickPhrase([], now), null)
})

test('своя фраза в закрытии — примерно раз в 3–4 дня, и только если есть', () => {
  const now = new Date('2026-10-24T12:00:00Z')
  const closing = [phrase('c1')], own = [phrase('o1', undefined, 'own')]
  let seed = 1
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let ownCount = 0
  for (let i = 0; i < 1000; i++) if (pickClosing(closing, own, now, rng)!.slot === 'own') ownCount++
  assert.ok(ownCount > 200 && ownCount < 340, String(ownCount))
  assert.equal(pickClosing(closing, [], now, () => 0)!.id, 'c1')
})

test('доводчик: только неотмеченное и своя фраза курсивом', () => {
  const left = [habit('t', 'Зубы'), habit('c', 'Крем <ночной>')]
  assert.equal(nudgeText('21:30', left), 'Вечер · 21:30: осталось — Зубы, Крем &lt;ночной&gt;')
  assert.equal(nudgeText('21:30', left, 'достаточно сделать'), 'Вечер · 21:30: осталось — Зубы, Крем &lt;ночной&gt;\n\n<i>достаточно сделать</i>')
})

test('«Вчера»: отметки и кнопки y: на неотмеченное', () => {
  const habits = [habit('d', 'Посуда'), habit('s', 'Душ')]
  assert.equal(yesterdayText(habits, new Set(['d'])), '<b>Вчера</b>\n✅ Посуда\n▫️ Душ')
  const kb = blockKeyboard(habits, new Set(['d']), '2026-10-23', '', true, 'y')!
  assert.equal(kb.inline_keyboard[1][0].callback_data, 'y:s:2026-10-23')
  assert.deepEqual(parseCallback('y:s:2026-10-23'), { kind: 'y', habitId: 's', dateKey: '2026-10-23' })
})

test('команды: кириллица, регистр, @бот, аргументы', () => {
  assert.deepEqual(parseCommand('/Фраза не обязательно хорошо'), { cmd: 'фраза', args: 'не обязательно хорошо' })
  assert.deepEqual(parseCommand('/today@mybestroutine_bot'), { cmd: 'today', args: '' })
  assert.deepEqual(parseCommand('/мысль строка 1\nстрока 2'), { cmd: 'мысль', args: 'строка 1\nстрока 2' })
  assert.equal(parseCommand('просто текст'), null)
})

test('/skip: блок по времени или по названию', () => {
  const times = ['08:00', '20:00', '21:30']
  assert.equal(findBlockTime('21:30', times), '21:30')
  assert.equal(findBlockTime('утро', times), '08:00')
  assert.equal(findBlockTime('Вечер', times), null) // 20:00 и 21:30 — оба вечер, неоднозначно
  assert.equal(findBlockTime('', times), null)
})

test('мысли в таблицу: дата и время по Барнаулу, формулы как текст', () => {
  assert.deepEqual(noteRows([{ id: 'n', text: '=про Папирус', created: '2026-10-24 17:30:00.000Z' }], 'Asia/Barnaul'),
    [['2026-10-25', '00:30', `'=про Папирус`]])
})
