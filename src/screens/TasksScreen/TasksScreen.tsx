import { useState } from 'react'
import { Icon } from '@/components/Icon/Icon'
import { triggerHaptic } from '@/lib/haptics'
import type { Task } from '@/hooks/useTasks'
import styles from './TasksScreen.module.css'

interface TasksScreenProps {
  tasks: Task[]
  onAdd: (title: string) => void
  onToggle: (task: Task) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

// Открытые — в порядке добавления; сделанные — ниже, серым (не сворачиваются).
const sortTasks = (tasks: Task[]): Task[] => [
  ...tasks.filter((t) => !t.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.created.localeCompare(b.created)),
  ...tasks.filter((t) => t.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')),
]

export function TasksScreen({ tasks, onAdd, onToggle, onRename, onDelete }: TasksScreenProps) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const submit = () => {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
    triggerHaptic('light')
  }

  const startEdit = (task: Task) => {
    setEditingId(task.id)
    setEditText(task.title)
  }

  const finishEdit = () => {
    if (editingId && editText.trim()) onRename(editingId, editText)
    setEditingId(null)
  }

  const sorted = sortTasks(tasks)

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Задачи</h1>

      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          className={styles.addInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Новая задача"
          enterKeyHint="done"
        />
        <button type="submit" className={styles.addBtn} disabled={!draft.trim()} aria-label="Добавить задачу">
          <Icon name="arrow_upward" size={20} />
        </button>
      </form>

      {sorted.length === 0 ? (
        <div className={styles.empty}>Задач пока нет. Можно записать и из бота: /задача текст</div>
      ) : (
        <div className={styles.list}>
          {sorted.map((task) => (
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
                <button className={styles.text} onClick={() => startEdit(task)}>
                  {task.title}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
