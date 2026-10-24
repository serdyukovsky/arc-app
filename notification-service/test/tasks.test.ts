import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTaskCallback, taskButtons, tasksLines, visibleTasks } from '../src/blocks.js'
import { parseCommand } from '../src/bot.js'
import { taskRows } from '../src/sheets.js'
import type { Task } from '../src/types.js'

const task = (id: string, title: string, extra: Partial<Task> = {}): Task =>
  ({ id, user: 'u1', title, done: false, created: `2026-10-24 0${id}:00:00.000Z`, ...extra })

test('сегодня: открытые (и просроченные), сделанные за сутки; будущие и давно сделанные — нет', () => {
  const now = new Date('2026-10-24T12:00:00Z')
  const tasks = [
    task('3', 'Третья', { date: '2026-10-24' }),
    task('1', 'Старая', { done: true, done_at: '2026-10-20T10:00:00Z' }),
    task('2', 'Только что', { done: true, done_at: '2026-10-24T11:00:00Z' }),
    task('4', 'Просроченная', { date: '2026-10-21', created: '2026-10-21 01:00:00.000Z' }),
    task('5', 'На завтра', { date: '2026-10-25' }),
  ]
  assert.deepEqual(visibleTasks(tasks, now, '2026-10-24').map((t) => t.title), ['Просроченная', 'Третья', 'Только что'])
})

test('строки и кнопки задач', () => {
  const tasks = [task('1', 'Корм <коту>'), task('2', 'Счёт', { done: true })]
  assert.deepEqual(tasksLines(tasks), ['▫️ Корм &lt;коту&gt;', '✅ Счёт'])
  const kb = taskButtons(tasks, '2026-10-23')
  assert.equal(kb[0][0].callback_data, 't:1:2026-10-23')
  assert.equal(kb[1][0].text, '✅ Счёт')
})

test('разбор нажатия задачи', () => {
  assert.deepEqual(parseTaskCallback('t:abc123:l'), { taskId: 'abc123', where: 'l' })
  assert.deepEqual(parseTaskCallback('t:abc123:2026-10-23'), { taskId: 'abc123', where: '2026-10-23' })
  assert.equal(parseTaskCallback('t:abc:x'), null)
  assert.equal(parseTaskCallback('h:abc:2026-10-23'), null)
})

test('команды задач', () => {
  assert.deepEqual(parseCommand('/Задача купить корм'), { cmd: 'задача', args: 'купить корм' })
  assert.deepEqual(parseCommand('/задачи'), { cmd: 'задачи', args: '' })
})

test('задачи в таблицу: по Барнаулу, формулы как текст', () => {
  const rows = taskRows([
    task('1', '=оплатить', { created: '2026-10-24 03:00:00.000Z', date: '2026-10-24', done: true, done_at: '2026-10-24T17:30:00Z' }),
    task('2', 'Корм', { created: '2026-10-24 04:00:00.000Z', date: '2026-10-26' }),
    task('3', 'Без дня', { created: '2026-10-23 04:00:00.000Z' }),
  ], 'Asia/Barnaul')
  assert.deepEqual(rows, [
    ['2026-10-23', 'Без дня', '', '', '2026-10-23'],
    ['2026-10-24', `'=оплатить`, 'да', '2026-10-25 00:30', '2026-10-24'],
    ['2026-10-26', 'Корм', '', '', '2026-10-24'],
  ])
})
