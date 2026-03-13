import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Habit } from '@/types'
import { pbRequest } from '@/lib/pb'
import { buildMilestones, getCurrentMilestoneIndex } from '@/lib/milestones'

const DEV_HABITS_KEY = 'coil.dev.habits.v5'

const coerceGoalDays = (habit: Habit): number | null => habit.goalDays ?? habit.daysGoal ?? null
const areMilestonesEqual = (a: number[] | null, b: number[] | null): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const withMilestoneDefaults = (
  habit: Omit<Habit, 'streak' | 'bestStreak' | 'lifetimeDays' | 'goalCompleted' | 'currentMilestoneIndex' | 'milestones'>
): Habit => {
  const goalDays = habit.goalDays ?? habit.daysGoal ?? null
  const milestones = buildMilestones(goalDays, habit.type)
  return {
    ...habit,
    goalDays,
    daysGoal: goalDays,
    streak: 0,
    bestStreak: 0,
    lifetimeDays: 0,
    goalCompleted: false,
    currentMilestoneIndex: getCurrentMilestoneIndex(0, habit.type, milestones),
    milestones,
  }
}

const normalizeHabit = (habit: Habit): Habit => {
  const goalDays = coerceGoalDays(habit)
  const builtMilestones = buildMilestones(goalDays, habit.type)
  const rawMilestones = habit.milestones ?? null
  const milestones = areMilestonesEqual(rawMilestones, builtMilestones)
    ? rawMilestones
    : builtMilestones
  const streak = habit.streak ?? 0
  const bestStreak = habit.bestStreak ?? 0
  const goalCompleted = habit.goalCompleted ?? (goalDays !== null && streak >= goalDays)
  return {
    ...habit,
    goalDays,
    daysGoal: goalDays,
    streak,
    bestStreak,
    lifetimeDays: habit.lifetimeDays ?? 0,
    goalCompleted,
    currentMilestoneIndex:
      habit.currentMilestoneIndex ?? getCurrentMilestoneIndex(streak, habit.type, milestones),
    milestones,
  }
}

const buildDevHabits = (): Habit[] => {
  const date = (daysAgo: number) => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString()
  }

  const withSeedState = (
    habit: Habit,
    state: Pick<Habit, 'streak' | 'bestStreak' | 'lifetimeDays'>
  ): Habit => {
    const goalDays = habit.goalDays ?? habit.daysGoal ?? null
    const milestones = habit.milestones ?? buildMilestones(goalDays, habit.type)
    const streak = state.streak
    return {
      ...habit,
      ...state,
      goalDays,
      daysGoal: goalDays,
      milestones,
      currentMilestoneIndex: getCurrentMilestoneIndex(streak, habit.type, milestones),
      goalCompleted: goalDays !== null && streak >= goalDays,
    }
  }

  return [
    withSeedState(
      withMilestoneDefaults({
        id: 'dev-water',
        user: 'dev-local',
        name: 'Вода',
        category: 'body',
        type: 'counter',
        goal: 10,
        goalDays: 21,
        reminder: 'morning',
        created: date(36),
        isArchived: false,
        order: 0,
      }),
      { streak: 6, bestStreak: 12, lifetimeDays: 48 }
    ),
    withSeedState(
      withMilestoneDefaults({
        id: 'dev-workout',
        user: 'dev-local',
        name: 'Тренировка',
        category: 'move',
        type: 'periodic',
        goal: 4,
        goalDays: 8,
        reminder: 'evening',
        created: date(32),
        isArchived: false,
        order: 1,
      }),
      { streak: 1, bestStreak: 3, lifetimeDays: 5 }
    ),
    withSeedState(
      withMilestoneDefaults({
        id: 'dev-read',
        user: 'dev-local',
        name: 'Читать 20 страниц',
        category: 'read',
        type: 'daily',
        goal: 1,
        goalDays: null,
        reminder: 'day',
        created: date(26),
        isArchived: false,
        order: 2,
      }),
      { streak: 11, bestStreak: 17, lifetimeDays: 73 }
    ),
    withSeedState(
      withMilestoneDefaults({
        id: 'dev-meditation',
        user: 'dev-local',
        name: 'Медитация 10 минут',
        category: 'mind',
        type: 'daily',
        goal: 1,
        goalDays: 21,
        reminder: 'morning',
        created: date(18),
        isArchived: false,
        order: 3,
      }),
      { streak: 2, bestStreak: 6, lifetimeDays: 19 }
    ),
    withSeedState(
      withMilestoneDefaults({
        id: 'dev-journal',
        user: 'dev-local',
        name: 'Дневник',
        category: 'focus',
        type: 'daily',
        goal: 1,
        goalDays: 14,
        reminder: 'evening',
        created: date(14),
        isArchived: false,
        order: 4,
      }),
      { streak: 13, bestStreak: 13, lifetimeDays: 31 }
    ),
    withSeedState(
      withMilestoneDefaults({
        id: 'dev-steps',
        user: 'dev-local',
        name: 'Шаги',
        category: 'move',
        type: 'counter',
        goal: 8,
        goalDays: 21,
        reminder: 'none',
        created: date(12),
        isArchived: false,
        order: 5,
      }),
      { streak: 4, bestStreak: 9, lifetimeDays: 22 }
    ),
    withSeedState(
      withMilestoneDefaults({
        id: 'dev-english',
        user: 'dev-local',
        name: 'Английский',
        category: 'focus',
        type: 'periodic',
        goal: 3,
        goalDays: 10,
        reminder: 'day',
        created: date(9),
        isArchived: false,
        order: 6,
      }),
      { streak: 2, bestStreak: 4, lifetimeDays: 7 }
    ),
  ]
}

const canUseStorage = () => typeof window !== 'undefined'

const loadDevHabits = (): Habit[] => {
  if (!canUseStorage()) return buildDevHabits().map(normalizeHabit)
  try {
    const raw = localStorage.getItem(DEV_HABITS_KEY)
    if (!raw) {
      const seed = buildDevHabits()
      localStorage.setItem(DEV_HABITS_KEY, JSON.stringify(seed))
      return seed.map(normalizeHabit)
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seed = buildDevHabits()
      localStorage.setItem(DEV_HABITS_KEY, JSON.stringify(seed))
      return seed.map(normalizeHabit)
    }
    return (parsed as Habit[]).map(normalizeHabit)
  } catch {
    return buildDevHabits().map(normalizeHabit)
  }
}

const saveDevHabits = (habits: Habit[]) => {
  if (!canUseStorage()) return
  localStorage.setItem(DEV_HABITS_KEY, JSON.stringify(habits))
}

const normalizeOrder = (items: Habit[]): Habit[] =>
  [...items]
    .map(normalizeHabit)
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
    async (data: Omit<Habit, 'id' | 'created' | 'isArchived' | 'order' | 'user' | 'streak' | 'bestStreak' | 'lifetimeDays' | 'goalCompleted' | 'currentMilestoneIndex' | 'milestones'>) => {
      if (!token) {
        if (!import.meta.env.DEV) return null

        const newHabit = withMilestoneDefaults({
          id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          user: userId ?? 'dev-local',
          name: data.name,
          category: data.category,
          type: data.type,
          goal: data.goal,
          goalDays: data.goalDays,
          daysGoal: data.goalDays,
          reminder: data.reminder,
          created: new Date().toISOString(),
          isArchived: false,
          order: habits.length,
        })

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
        body: {
          name: data.name,
          category: data.category,
          type: data.type,
          goal: data.goal,
          daysGoal: data.goalDays,
          reminder: data.reminder,
          user: userId,
          isArchived: false,
          order: habits.length,
        },
      })

      if (res.ok && res.data) {
        const normalized = normalizeHabit(res.data)
        setHabits((prev) => normalizeOrder([...prev, normalized]))
        return normalized
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
      const {
        streak,
        bestStreak,
        lifetimeDays,
        goalCompleted,
        currentMilestoneIndex,
        milestones,
        goalDays,
        daysGoal,
        ...rest
      } = data

      const payload = {
        ...rest,
        ...(goalDays !== undefined ? { daysGoal: goalDays } : {}),
        ...(goalDays === undefined && daysGoal !== undefined ? { daysGoal } : {}),
      }

      const res = await pbRequest(`/api/collections/habits/records/${id}`, {
        method: 'PATCH',
        token,
        body: payload,
      })

      if (!res.ok) {
        fetchHabits()
      }
    },
    [token, fetchHabits]
  )

  const updateHabitLocal = useCallback(
    (id: string, data: Partial<Habit>) => {
      setHabits((prev) => {
        const next = normalizeOrder(prev.map((h) => (h.id === id ? { ...h, ...data } : h)))
        if (!token && import.meta.env.DEV) saveDevHabits(next)
        return next
      })
    },
    [token]
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
    updateHabitLocal,
    archiveHabit,
    unarchiveHabit,
    deleteHabit,
    refetch: fetchHabits,
  }
}
