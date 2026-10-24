import { useState } from 'react'
import { Icon } from '@/components/Icon/Icon'
import { WeekStrip } from '@/components/WeekStrip/WeekStrip'
import { formatDate, parseKey, toKey, today } from '@/lib/date'
import { triggerHaptic } from '@/lib/haptics'
import type { Task } from '@/hooks/useTasks'
import styles from './TasksScreen.module.css'

interface TasksScreenProps {
  tasks: Task[]
  onAdd: (title: string, date: string) => void
  onToggle: (task: Task) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

const localDay = (iso?: string): string => (iso ? toKey(new Date(iso.replace(' ', 'T'))) : '')
const taskDay = (t: Task): string => t.date || localDay(t.created)

/**
 * Что видно в выбранный день:
 * - сегодня — открытые с днём не позже сегодня (просроченные переезжают сюда) + сделанные сегодня;
 * - прошлый день — что в тот день сделано;
 * - будущий день — что на него записано.
 * Открытые — в порядке добавления, сделанные — ниже, серым.
 */
export function tasksForDay(tasks: Task[], day: string, todayKey: string): Task[] {
  const visible = tasks.filter((t) => {
    if (day === todayKey) return t.done ? localDay(t.done_at) === todayKey : taskDay(t) <= todayKey
    if (day < todayKey) return t.done && localDay(t.done_at) === day
    return taskDay(t) === day
  })
  return [
    ...visible.filter((t) => !t.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.created.localeCompare(b.created)),
    ...visible.filter((t) => t.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')),
  ]
}

const shortDate = (day: string): string =>
  parseKey(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

export function TasksScreen({ tasks, onAdd, onToggle, onRename, onDelete }: TasksScreenProps) {
  const todayKey = today()
  const [day, setDay] = useState(todayKey)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const isPast = day < todayKey
  const isFuture = day > todayKey

  const submit = () => {
    if (!draft.trim() || isPast) return
    onAdd(draft, day)
    setDraft('')
    triggerHaptic('light')
  }

  const finishEdit = () => {
    if (editingId && editText.trim()) onRename(editingId, editText)
    setEditingId(null)
  }

  const visible = tasksForDay(tasks, day, todayKey)
  const empty = isPast
    ? 'В этот день задач не закрыто.'
    : isFuture
      ? 'На этот день задач нет.'
      : 'Задач пока нет. Можно записать и из бота: /задача текст'

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Задачи</h1>

      <div className={styles.week}>
        <WeekStrip selectedDay={day} onDayPress={setDay} />
      </div>

      {day !== todayKey && <div className={styles.dayTitle}>{formatDate(day)}</div>}

      <form
        className={`${styles.addRow} ${isPast ? styles.addRowDisabled : ''}`}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          className={styles.addInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isPast ? 'Прошедший день — только просмотр' : isFuture ? `Задача на ${shortDate(day)}` : 'Новая задача'}
          disabled={isPast}
          enterKeyHint="done"
        />
        <button type="submit" className={styles.addBtn} disabled={!draft.trim() || isPast} aria-label="Добавить задачу">
          <Icon name="arrow_upward" size={20} />
        </button>
      </form>

      {visible.length === 0 ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <div className={styles.list}>
          {visible.map((task) => (
            <div key={task.id} className={`${styles.card} ${task.done ? styles.done : ''}`}>
              <button
                className={`${styles.check} ${task.done ? styles.checkOn : ''}`}
                onClick={() => {
                  onToggle(task)
                  triggerHaptic(task.done ? 'light' : 'success')
                }}
                aria-label={task.done ? 'Вернуть задачу' : 'Отметить задачу'}
              >
                {task.done && <Icon name="check" size={16} />}
              </button>

              {editingId === task.id ? (
                <>
                  <input
                    className={styles.editInput}
                    value={editText}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={finishEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') finishEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    enterKeyHint="done"
                  />
                  <button
                    className={styles.deleteBtn}
                    onPointerDown={(e) => e.preventDefault()} // не терять фокус до клика
                    onClick={() => {
                      setEditingId(null)
                      onDelete(task.id)
                    }}
                    aria-label="Удалить задачу"
                  >
                    <Icon name="delete" size={20} />
                  </button>
                </>
              ) : (
                <button
                  className={styles.text}
                  onClick={() => {
                    setEditingId(task.id)
                    setEditText(task.title)
                  }}
                >
                  {task.title}
                  {day === todayKey && !task.done && taskDay(task) < todayKey && (
                    <span className={styles.overdue}>с {shortDate(taskDay(task))}</span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
