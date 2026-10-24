import { useCallback, useEffect, useRef, useState } from 'react'
import { pbRequest } from '@/lib/pb'

// Задачи (to-do): разовые дела. Источник правды — PocketBase (коллекция tasks);
// бот тоже пишет туда (/задача), поэтому при возврате в приложение список перечитывается.
export interface Task {
  id: string
  user: string
  title: string
  done: boolean
  done_at?: string
  date?: string // день задачи YYYY-MM-DD; невыполненные из прошлых дней показываются в «сегодня»
  order?: number
  created: string
}

const DEV_TASKS_KEY = 'coil.dev.tasks.v1'

const loadDev = (): Task[] => {
  try {
    return JSON.parse(localStorage.getItem(DEV_TASKS_KEY) || '[]') as Task[]
  } catch {
    return []
  }
}
const saveDev = (tasks: Task[]) => {
  try {
    localStorage.setItem(DEV_TASKS_KEY, JSON.stringify(tasks))
  } catch {}
}

export function useTasks(token: string | null, userId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const tasksRef = useRef<Task[]>([])
  const devMode = !token && import.meta.env.DEV

  const apply = useCallback(
    (next: Task[]) => {
      tasksRef.current = next
      setTasks(next)
      if (devMode) saveDev(next)
    },
    [devMode]
  )

  const fetchTasks = useCallback(async () => {
    if (devMode) return apply(loadDev())
    if (!token) return
    const res = await pbRequest<{ items: Task[] }>('/api/collections/tasks/records?sort=created&perPage=1000', { token })
    if (res.ok && res.data?.items) apply(res.data.items)
  }, [token, devMode, apply])

  useEffect(() => {
    void fetchTasks()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchTasks()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchTasks])

  const addTask = useCallback(
    async (title: string, date: string) => {
      const text = title.trim()
      if (!text) return
      const temp: Task = { id: `temp_${Date.now()}`, user: userId || '', title: text, done: false, date, created: new Date().toISOString() }
      apply([...tasksRef.current, temp])
      if (devMode) return
      const res = await pbRequest<Task>('/api/collections/tasks/records', {
        method: 'POST',
        token: token || undefined,
        body: { user: userId, title: text, date, done: false },
      })
      if (res.ok && res.data) apply(tasksRef.current.map((t) => (t.id === temp.id ? res.data! : t)))
      else void fetchTasks()
    },
    [token, userId, devMode, apply, fetchTasks]
  )

  const patch = useCallback(
    async (id: string, changes: Partial<Task>) => {
      apply(tasksRef.current.map((t) => (t.id === id ? { ...t, ...changes } : t)))
      if (devMode || id.startsWith('temp_')) return
      const res = await pbRequest(`/api/collections/tasks/records/${id}`, { method: 'PATCH', token: token || undefined, body: changes })
      if (!res.ok) void fetchTasks()
    },
    [token, devMode, apply, fetchTasks]
  )

  const toggleTask = useCallback(
    (task: Task) => patch(task.id, { done: !task.done, done_at: !task.done ? new Date().toISOString() : '' }),
    [patch]
  )

  const renameTask = useCallback((id: string, title: string) => {
    const text = title.trim()
    if (text) void patch(id, { title: text })
  }, [patch])

  const deleteTask = useCallback(
    async (id: string) => {
      apply(tasksRef.current.filter((t) => t.id !== id))
      if (devMode || id.startsWith('temp_')) return
      const res = await pbRequest(`/api/collections/tasks/records/${id}`, { method: 'DELETE', token: token || undefined })
      if (!res.ok) void fetchTasks()
    },
    [token, devMode, apply, fetchTasks]
  )

  return { tasks, addTask, toggleTask, renameTask, deleteTask, refetch: fetchTasks }
}
