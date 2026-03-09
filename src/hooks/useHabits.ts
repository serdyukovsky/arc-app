import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Habit } from '@/types'
import { pbRequest } from '@/lib/pb'

const DEV_HABITS_KEY = 'coil.dev.habits.v3'

const buildDevHabits = (): Habit[] => {
  const date = (daysAgo: number) => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString()
  }

  return [
    {
      id: 'dev-water',
      user: 'dev-local',
      name: 'Вода',
      category: 'body',
      type: 'counter',
      goal: 10,
      daysGoal: 21,
      reminder: 'morning',
      created: date(36),
      isArchived: false,
      order: 0,
    },
    {
      id: 'dev-workout',
      user: 'dev-local',
      name: 'Тренировка',
      category: 'move',
      type: 'periodic',
      goal: 4,
      daysGoal: 8,
      reminder: 'evening',
      created: date(32),
      isArchived: false,
      order: 1,
    },
    {
      id: 'dev-read',
      user: 'dev-local',
      name: 'Читать 20 страниц',
      category: 'read',
      type: 'daily',
      goal: 1,
      daysGoal: 28,
      reminder: 'day',
      created: date(26),
      isArchived: false,
      order: 2,
    },
    {
      id: 'dev-meditation',
      user: 'dev-local',
      name: 'Медитация 10 минут',
      category: 'mind',
      type: 'daily',
      goal: 1,
      daysGoal: 21,
      reminder: 'morning',
      created: date(18),
      isArchived: false,
      order: 3,
    },
    {
      id: 'dev-steps',
      user: 'dev-local',
      name: 'Шаги',
      category: 'move',
      type: 'counter',
      goal: 8,
      daysGoal: 21,
      reminder: 'none',
      created: date(12),
      isArchived: false,
      order: 4,
    },
    {
      id: 'dev-english',
      user: 'dev-local',
      name: 'Английский',
      category: 'focus',
      type: 'periodic',
      goal: 3,
      daysGoal: 10,
      reminder: 'day',
      created: date(9),
      isArchived: false,
      order: 5,
    },
  ]
}

const canUseStorage = () => typeof window !== 'undefined'

const loadDevHabits = (): Habit[] => {
  if (!canUseStorage()) return buildDevHabits()
  try {
    const raw = localStorage.getItem(DEV_HABITS_KEY)
    if (!raw) {
      const seed = buildDevHabits()
      localStorage.setItem(DEV_HABITS_KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seed = buildDevHabits()
      localStorage.setItem(DEV_HABITS_KEY, JSON.stringify(seed))
      return seed
    }
    return parsed as Habit[]
  } catch {
    return buildDevHabits()
  }
}

const saveDevHabits = (habits: Habit[]) => {
  if (!canUseStorage()) return
  localStorage.setItem(DEV_HABITS_KEY, JSON.stringify(habits))
}

const normalizeOrder = (items: Habit[]): Habit[] =>
  [...items]
    .sort((a, b) => a.order - b.order)
    .map((h, index) => ({ ...h, order: index }))

export function useHabits(token: string | null, userId: string | null) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchHabits = useCallback(async () => {
    if (!token) {
      if (import.meta.env.DEV) {
        setHabits(normalizeOrder(loadDevHabits()))
      } else {
        setHabits([])
      }
      setIsLoading(false)
      return
    }

    const res = await pbRequest<{ items: Habit[] }>('/api/collections/habits/records?sort=order', {
      token,
    })

    if (res.ok && res.data?.items) {
      setHabits(normalizeOrder(res.data.items))
    }
    setIsLoading(false)
  }, [token])

  useEffect(() => {
    fetchHabits()
  }, [fetchHabits])

  const createHabit = useCallback(
    async (data: Omit<Habit, 'id' | 'created' | 'isArchived' | 'order' | 'user'>) => {
      if (!token) {
        if (!import.meta.env.DEV) return null

        const newHabit: Habit = {
          id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          user: userId ?? 'dev-local',
          name: data.name,
          category: data.category,
          type: data.type,
          goal: data.goal,
          daysGoal: data.daysGoal,
          reminder: data.reminder,
          created: new Date().toISOString(),
          isArchived: false,
          order: habits.length,
        }

        setHabits((prev) => {
          const next = normalizeOrder([...prev, newHabit])
          saveDevHabits(next)
          return next
        })

        return newHabit
      }

      const res = await pbRequest<Habit>('/api/collections/habits/records', {
        method: 'POST',
        token,
        body: { ...data, user: userId, isArchived: false, order: habits.length },
      })

      if (res.ok && res.data) {
        setHabits((prev) => normalizeOrder([...prev, res.data!]))
        return res.data
      }
      return null
    },
    [token, userId, habits.length]
  )

  const updateHabit = useCallback(
    async (id: string, data: Partial<Habit>) => {
      if (!token) {
        if (!import.meta.env.DEV) return
        setHabits((prev) => {
          const next = normalizeOrder(prev.map((h) => (h.id === id ? { ...h, ...data } : h)))
          saveDevHabits(next)
          return next
        })
        return
      }

      setHabits((prev) => normalizeOrder(prev.map((h) => (h.id === id ? { ...h, ...data } : h))))
      const res = await pbRequest(`/api/collections/habits/records/${id}`, {
        method: 'PATCH',
        token,
        body: data,
      })

      if (!res.ok) {
        fetchHabits()
      }
    },
    [token, fetchHabits]
  )

  const archiveHabit = useCallback(
    (id: string) => updateHabit(id, { isArchived: true }),
    [updateHabit]
  )

  const unarchiveHabit = useCallback(
    (id: string) => updateHabit(id, { isArchived: false }),
    [updateHabit]
  )

  const deleteHabit = useCallback(
    async (id: string) => {
      if (!token) {
        if (!import.meta.env.DEV) return
        setHabits((prev) => {
          const next = normalizeOrder(prev.filter((h) => h.id !== id))
          saveDevHabits(next)
          return next
        })
        return
      }

      setHabits((prev) => normalizeOrder(prev.filter((h) => h.id !== id)))
      await pbRequest(`/api/collections/habits/records/${id}`, {
        method: 'DELETE',
        token,
      })
    },
    [token]
  )

  const orderedHabits = useMemo(() => normalizeOrder(habits), [habits])
  const activeHabits = orderedHabits.filter((h) => !h.isArchived)
  const archivedHabits = orderedHabits.filter((h) => h.isArchived)

  return {
    habits: orderedHabits,
    activeHabits,
    archivedHabits,
    isLoading,
    createHabit,
    updateHabit,
    archiveHabit,
    unarchiveHabit,
    deleteHabit,
    refetch: fetchHabits,
  }
}
