import { useState, useCallback, useEffect, useMemo } from 'react'
import type { HabitLog } from '@/types'
import { pbRequest } from '@/lib/pb'
import { today, daysAgo, toKey, parseKey } from '@/lib/date'
import {
  calcDailyStreak,
  calcDailyStreakAtDate,
  calcBestStreak,
  calcPeriodicStreak,
  calcPeriodicStreakAtDate,
  calcPeriodicBestStreak,
} from '@/lib/streak'

const DEV_LOGS_KEY = 'coil.dev.logs.v5'

const canUseStorage = () => typeof window !== 'undefined'

const buildDevLogs = (habitIds: string[]): HabitLog[] => {
  const now = new Date()
  const dateShift = (shift: number) => {
    const d = new Date(now)
    d.setDate(now.getDate() + shift)
    return toKey(d)
  }

  const logs: HabitLog[] = []
  const push = (habit: string, shift: number, value: number) => {
    if (habitIds.length > 0 && !habitIds.includes(habit)) return
    logs.push({
      id: `devlog-${habit}-${dateShift(shift)}`,
      habit,
      date: dateShift(shift),
      value,
      created: new Date().toISOString(),
    })
  }

  push('dev-water', 0, 3)
  push('dev-water', -1, 7)
  push('dev-water', -2, 10)
  push('dev-water', -3, 6)

  push('dev-workout', -6, 1)
  push('dev-workout', -4, 1)
  push('dev-workout', -2, 1)
  push('dev-workout', 0, 1)

  for (let i = 0; i < 12; i++) push('dev-read', -i, 1)

  for (let i = 0; i < 13; i++) push('dev-journal', -i, 1)

  push('dev-meditation', 0, 1)
  push('dev-meditation', -1, 1)
  push('dev-meditation', -3, 1)
  push('dev-meditation', -4, 1)
  push('dev-meditation', -6, 1)

  push('dev-steps', 0, 5)
  push('dev-steps', -1, 8)

  push('dev-english', -8, 1)
  push('dev-english', -10, 1)
  push('dev-english', -13, 1)

  return logs
}

const saveDevLogs = (logs: HabitLog[]) => {
  if (!canUseStorage()) return
  localStorage.setItem(DEV_LOGS_KEY, JSON.stringify(logs))
}

const normalizeLogs = (logs: HabitLog[]): HabitLog[] =>
  [...logs].sort((a, b) => (a.date < b.date ? 1 : -1))

const loadDevLogs = (habitIds: string[]): HabitLog[] => {
  if (!canUseStorage()) return normalizeLogs(buildDevLogs(habitIds))

  try {
    const raw = localStorage.getItem(DEV_LOGS_KEY)
    if (!raw) {
      const seed = normalizeLogs(buildDevLogs(habitIds))
      saveDevLogs(seed)
      return seed
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      const seed = normalizeLogs(buildDevLogs(habitIds))
      saveDevLogs(seed)
      return seed
    }

    const filtered = habitIds.length > 0
      ? (parsed as HabitLog[]).filter((l) => habitIds.includes(l.habit))
      : (parsed as HabitLog[])

    if (filtered.length === 0 && habitIds.length > 0) {
      const seed = normalizeLogs(buildDevLogs(habitIds))
      saveDevLogs(seed)
      return seed
    }

    const normalized = normalizeLogs(filtered)
    saveDevLogs(normalized)
    return normalized
  } catch {
    return normalizeLogs(buildDevLogs(habitIds))
  }
}

export function useHabitLogs(token: string | null, habitIds: string[], userId: string | null = null) {
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncedHabitIdsKey, setSyncedHabitIdsKey] = useState('')
  const habitIdsKey = useMemo(() => habitIds.join(','), [habitIds])

  const fetchLogs = useCallback(async () => {
    if (!token) {
      if (import.meta.env.DEV) {
        setLogs(loadDevLogs(habitIds))
      } else {
        setLogs([])
      }
      setSyncedHabitIdsKey(habitIdsKey)
      setIsLoading(false)
      return
    }

    if (habitIds.length === 0) {
      setLogs([])
      setSyncedHabitIdsKey(habitIdsKey)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const since = daysAgo(90)
    const filter = `date >= "${since}"`
    const res = await pbRequest<{ items: HabitLog[] }>(
      `/api/collections/habit_logs/records?filter=${encodeURIComponent(filter)}&perPage=5000&sort=-date`,
      { token }
    )

    if (res.ok && res.data?.items) {
      setLogs(normalizeLogs(res.data.items))
    }

    setSyncedHabitIdsKey(habitIdsKey)
    setIsLoading(false)
  }, [token, habitIdsKey])

  const findLogByHabitAndDate = useCallback(
    async (habitId: string, dateKey: string): Promise<HabitLog | null> => {
      if (!token) return null
      const filter = `habit = "${habitId}" && date = "${dateKey}"`
      const res = await pbRequest<{ items: HabitLog[] }>(
        `/api/collections/habit_logs/records?filter=${encodeURIComponent(filter)}&perPage=1&sort=-created`,
        { token }
      )
      if (!res.ok || !res.data?.items?.[0]) return null
      return res.data.items[0]
    },
    [token]
  )

  const createRemoteLog = useCallback(
    async (habitId: string, dateKey: string, value: number) => {
      if (!token) return { ok: false, status: 0, data: null as HabitLog | null }

      const payloads =
        userId
          ? [
              { habit: habitId, date: dateKey, value, user: userId },
              { habit: habitId, date: dateKey, value },
            ]
          : [{ habit: habitId, date: dateKey, value }]

      let lastRes: { ok: boolean; status: number; data: HabitLog | null } = {
        ok: false,
        status: 0,
        data: null,
      }

      for (const body of payloads) {
        const res = await pbRequest<HabitLog>('/api/collections/habit_logs/records', {
          method: 'POST',
          token,
          body,
        })
        lastRes = res
        if (res.ok) return res
      }

      return lastRes
    },
    [token, userId]
  )

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const logHabit = useCallback(
    async (habitId: string, value: number = 1) => {
      const dateKey = today()

      if (!token) {
        if (!import.meta.env.DEV) return null

        const existing = logs.find((l) => l.habit === habitId && l.date === dateKey)
        if (existing) {
          const updated = { ...existing, value: existing.value + value }
          setLogs((prev) => {
            const next = normalizeLogs(prev.map((l) => (l.id === existing.id ? updated : l)))
            saveDevLogs(next)
            return next
          })
          return updated
        }

        const newLog: HabitLog = {
          id: `devlog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          habit: habitId,
          date: dateKey,
          value,
          created: new Date().toISOString(),
        }

        setLogs((prev) => {
          const next = normalizeLogs([newLog, ...prev])
          saveDevLogs(next)
          return next
        })

        return newLog
      }

      const existing = logs.find((l) => l.habit === habitId && l.date === dateKey)
      if (existing) {
        const newValue = existing.value + value
        setLogs((prev) =>
          prev.map((l) => (l.id === existing.id ? { ...l, value: newValue } : l))
        )
        const res = await pbRequest<HabitLog>(
          `/api/collections/habit_logs/records/${existing.id}`,
          { method: 'PATCH', token, body: { value: newValue } }
        )
        if (!res.ok) {
          console.warn('[useHabitLogs] Failed to update log', { habitId, status: res.status, data: res.data })
          await fetchLogs()
          return null
        }
        return res.data ?? { ...existing, value: newValue }
      }

      const tempId = `temp_${Date.now()}`
      const tempLog: HabitLog = {
        id: tempId,
        habit: habitId,
        date: dateKey,
        value,
        created: new Date().toISOString(),
      }

      setLogs((prev) => [tempLog, ...prev])
      const res = await createRemoteLog(habitId, dateKey, value)

      if (res.ok && res.data) {
        setLogs((prev) => prev.map((l) => (l.id === tempId ? res.data! : l)))
        return res.data
      }

      const fallbackLog = await findLogByHabitAndDate(habitId, dateKey)
      if (fallbackLog) {
        setLogs((prev) => prev.map((l) => (l.id === tempId ? fallbackLog : l)))
        return fallbackLog
      }

      console.warn('[useHabitLogs] Failed to create log', { habitId, status: res.status, data: res.data })
      setLogs((prev) => prev.filter((l) => l.id !== tempId))
      void fetchLogs()
      return null
    },
    [token, logs, fetchLogs, createRemoteLog, findLogByHabitAndDate]
  )

  const undoLog = useCallback(
    async (habitId: string): Promise<boolean> => {
      const dateKey = today()
      const existing = logs.find((l) => l.habit === habitId && l.date === dateKey)
      if (!existing) return false

      if (!token) {
        if (!import.meta.env.DEV) return false
        setLogs((prev) => {
          const next = normalizeLogs(prev.filter((l) => l.id !== existing.id))
          saveDevLogs(next)
          return next
        })
        return true
      }

      setLogs((prev) => prev.filter((l) => l.id !== existing.id))
      const res = await pbRequest(`/api/collections/habit_logs/records/${existing.id}`, {
        method: 'DELETE',
        token,
      })
      if (!res.ok) {
        console.warn('[useHabitLogs] Failed to delete log', { habitId, status: res.status, data: res.data })
        await fetchLogs()
        return false
      }
      return true
    },
    [token, logs, fetchLogs]
  )

  const getLogsForHabit = useCallback(
    (habitId: string): HabitLog[] => logs.filter((l) => l.habit === habitId),
    [logs]
  )

  const getDoneDates = useCallback(
    (habitId: string): Set<string> => {
      const dates = new Set<string>()
      logs.forEach((l) => {
        if (l.habit === habitId && l.value > 0) dates.add(l.date)
      })
      return dates
    },
    [logs]
  )

  const getTodayValue = useCallback(
    (habitId: string, dateKey?: string): number => {
      const targetDate = dateKey ?? today()
      const log = logs.find((l) => l.habit === habitId && l.date === targetDate)
      return log?.value ?? 0
    },
    [logs]
  )

  const isDoneToday = useCallback(
    (habitId: string, goal: number = 1, dateKey?: string): boolean => getTodayValue(habitId, dateKey) >= goal,
    [getTodayValue]
  )

  const getStreak = useCallback(
    (
      habitId: string,
      type: 'daily' | 'periodic' | 'counter' = 'daily',
      goal: number = 1,
      referenceDateKey?: string
    ): number => {
      const doneDates = getDoneDates(habitId)
      if (type === 'periodic') {
        if (referenceDateKey) return calcPeriodicStreakAtDate(doneDates, goal, referenceDateKey)
        return calcPeriodicStreak(doneDates, goal)
      }
      if (referenceDateKey) return calcDailyStreakAtDate(doneDates, referenceDateKey)
      return calcDailyStreak(doneDates)
    },
    [getDoneDates]
  )

  const getBestStreak = useCallback(
    (habitId: string, type: 'daily' | 'periodic' | 'counter' = 'daily', goal: number = 1): number => {
      const doneDates = getDoneDates(habitId)
      if (type === 'periodic') return calcPeriodicBestStreak(doneDates, goal)
      return calcBestStreak(doneDates)
    },
    [getDoneDates]
  )

  const getWeekDoneCount = useCallback(
    (habitId: string, referenceDateKey?: string): number => {
      const ref = referenceDateKey ? parseKey(referenceDateKey) : new Date()
      ref.setHours(0, 0, 0, 0)
      const dow = ref.getDay()
      const mondayOffset = (dow + 6) % 7
      let count = 0
      for (let i = 0; i < 7; i++) {
        const d = new Date(ref)
        d.setDate(ref.getDate() - mondayOffset + i)
        d.setHours(0, 0, 0, 0)
        if (d.getTime() > ref.getTime()) break
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (logs.some((l) => l.habit === habitId && l.date === key && l.value > 0)) count++
      }
      return count
    },
    [logs]
  )

  const todayCompletedCount = useMemo(() => {
    const dateKey = today()
    const todayHabitIds = new Set<string>()
    logs.forEach((l) => {
      if (l.date === dateKey && l.value > 0) todayHabitIds.add(l.habit)
    })
    return todayHabitIds.size
  }, [logs])

  return {
    logs,
    isLoading,
    hasSyncedCurrentHabits: syncedHabitIdsKey === habitIdsKey,
    logHabit,
    undoLog,
    getLogsForHabit,
    getDoneDates,
    getTodayValue,
    isDoneToday,
    getStreak,
    getBestStreak,
    getWeekDoneCount,
    todayCompletedCount,
    refetch: fetchLogs,
  }
}
