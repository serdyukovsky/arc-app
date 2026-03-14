import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTelegram } from '@/hooks/useTelegram'
import { useAuth } from '@/hooks/useAuth'
import { useHabits } from '@/hooks/useHabits'
import { useHabitLogs } from '@/hooks/useHabitLogs'
import { useToast } from '@/hooks/useToast'
import type { Habit } from '@/types'
import { parseKey } from '@/lib/date'
import { buildMilestones, getCurrentMilestoneIndex, getMilestoneValueByIndex } from '@/lib/milestones'
import {
  POPUP_PRIORITY,
  clearPopupQueue,
  closeActivePopup as closeActivePopupState,
  createInitialPopupState,
  enqueuePopupEvent,
  getDateString,
  getRemainingDaysInWeek,
  getTimeOfDay,
  getYesterdayString,
  isDeadWeek,
  setAllDoneShownToday,
  type PopupEventInput,
  type PopupState,
} from '@/lib/popups'
import { NavBar, type Screen } from '@/components/NavBar/NavBar'
import { Toast } from '@/components/Toast/Toast'
import { HomeScreen } from '@/screens/HomeScreen/HomeScreen'
import { AnalyticsScreen } from '@/screens/AnalyticsScreen/AnalyticsScreen'
import { ArchiveScreen } from '@/screens/ArchiveScreen/ArchiveScreen'
import { ProfileScreen } from '@/screens/ProfileScreen/ProfileScreen'
import { CreateHabit, type CreateHabitData } from '@/screens/CreateHabit/CreateHabit'
import { PopupLayer } from '@/components/PopupLayer/PopupLayer'
import styles from './App.module.css'

const screenTransition = {
  initial: { opacity: 0, y: 14, scale: 0.996 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.998 },
}

const areMilestonesEqual = (a: number[] | null, b: number[] | null): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [createOpen, setCreateOpen] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [editFromDrawer, setEditFromDrawer] = useState(false)
  const [restoreDrawerHabitId, setRestoreDrawerHabitId] = useState<string | null>(null)
  const [popupState, setPopupState] = useState<PopupState>(createInitialPopupState())

  const telegram = useTelegram()
  const { token, userId, isLoading: authLoading } = useAuth(telegram.getInitData)
  const {
    activeHabits,
    archivedHabits,
    habits,
    isLoading: habitsLoading,
    createHabit,
    updateHabit,
    updateHabitLocal,
    archiveHabit,
    unarchiveHabit,
  } = useHabits(token, userId)

  const habitIds = useMemo(() => habits.map((h) => h.id), [habits])
  const {
    logs,
    hasSyncedCurrentHabits,
    getTodayValue,
    isDoneToday,
    getDoneDates,
    getStreak,
    getLogsForHabit,
    getWeekDoneCount,
    logHabit,
    undoLog,
  } = useHabitLogs(token, habitIds, userId)

  const { toast, showToast, hideToast } = useToast()

  const tgUser = telegram.getUser()
  const isHomeHydrated = !habitsLoading && hasSyncedCurrentHabits
  const habitsRef = useRef(habits)
  const popupStateRef = useRef(popupState)
  const initPopupChecksRef = useRef(false)
  const isDoneTodayRef = useRef(isDoneToday)
  const getDoneDatesRef = useRef(getDoneDates)
  const getStreakRef = useRef(getStreak)
  const getWeekDoneCountRef = useRef(getWeekDoneCount)

  useEffect(() => {
    const cleanup = telegram.bindSafeAreaCssVars()
    return cleanup
  }, [])

  useEffect(() => {
    habitsRef.current = habits
  }, [habits])

  useEffect(() => {
    popupStateRef.current = popupState
  }, [popupState])

  useEffect(() => {
    isDoneTodayRef.current = isDoneToday
    getDoneDatesRef.current = getDoneDates
    getStreakRef.current = getStreak
    getWeekDoneCountRef.current = getWeekDoneCount
  }, [isDoneToday, getDoneDates, getStreak, getWeekDoneCount])


  const navigateTo = (next: Screen) => {
    if (next === screen) return
    setScreen(next)
  }

  const isHabitDoneToday = useCallback((habit: Habit, dateKey?: string): boolean => {
    if (habit.type === 'counter') return isDoneTodayRef.current(habit.id, habit.goal, dateKey)
    return isDoneTodayRef.current(habit.id, 1, dateKey)
  }, [])

  const getHabitStreak = useCallback(
    (habit: Habit, dateKey?: string): number =>
      getStreakRef.current(habit.id, habit.type, habit.goal, dateKey),
    []
  )
  const getHabitBestStreak = (habit: Habit): number => habit.bestStreak ?? 0

  const enqueuePopup = useCallback((event: PopupEventInput) => {
    setPopupState((prev) => enqueuePopupEvent(prev, event))
  }, [])

  const closeActivePopup = useCallback(() => {
    setPopupState((prev) => closeActivePopupState(prev))
  }, [])

  const clearPopups = useCallback(() => {
    setPopupState((prev) => clearPopupQueue(prev))
  }, [])

  const isHabitClosedForDate = useCallback(
    (habit: Habit, dateKey: string): boolean => {
      if (habit.type !== 'periodic') {
        return isHabitDoneToday(habit, dateKey)
      }

      if (isHabitDoneToday(habit, dateKey)) {
        return true
      }

      const weekDone = getWeekDoneCountRef.current(habit.id, dateKey)
      const remainingDays = getRemainingDaysInWeek(parseKey(dateKey))
      return weekDone >= habit.goal || isDeadWeek(weekDone, habit.goal, remainingDays)
    },
    [isHabitDoneToday]
  )

  const checkAllDone = useCallback(() => {
    const todayKey = getDateString()
    if (popupStateRef.current.allDoneShownToday === todayKey) return false

    const currentHabits = habitsRef.current.filter((habit) => !habit.isArchived)
    if (currentHabits.length === 0) return false

    const completedHabits = currentHabits.filter((habit) => isHabitClosedForDate(habit, todayKey))
    if (completedHabits.length !== currentHabits.length) return false

    let seriesDays = 0
    for (let offset = 0; offset < 365; offset += 1) {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - offset)
      const key = getDateString(date)
      const allClosedForDay = currentHabits.every((habit) => isHabitClosedForDate(habit, key))
      if (!allClosedForDay) break
      seriesDays += 1
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const mondayOffset = (now.getDay() + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - mondayOffset)
    let completedSlots = 0
    let totalSlots = 0

    for (let i = 0; i <= mondayOffset; i += 1) {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      const key = getDateString(day)
      currentHabits.forEach((habit) => {
        totalSlots += 1
        if (isHabitClosedForDate(habit, key)) completedSlots += 1
      })
    }

    const weekCompletion = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0
    const streaks = currentHabits
      .map((habit) => ({
        name: habit.name,
        streak: getHabitStreak(habit),
        unit: habit.type === 'periodic' ? 'нед' : 'д',
      }))
      .sort((a, b) => b.streak - a.streak)

    if (currentHabits.length > 1) {
      enqueuePopup({
        type: 'all_done',
        habitId: null,
        priority: POPUP_PRIORITY.all_done,
        data: {
          completedCount: completedHabits.length,
          seriesDays,
          weekCompletion,
          streaks,
          timeOfDay: getTimeOfDay(),
        },
      })
    } else {
      const onlyHabit = currentHabits[0]
      const streak = getHabitStreak(onlyHabit)
      enqueuePopup({
        type: 'milestone_reached',
        habitId: onlyHabit.id,
        priority: POPUP_PRIORITY.milestone_reached,
        data: {
          habitName: onlyHabit.name,
          habitType: onlyHabit.type,
          streak,
          milestone: streak,
          completedCount: 1,
          singleHabitAllDone: true,
          timeOfDay: getTimeOfDay(),
        },
      })
    }

    setPopupState((prev) => setAllDoneShownToday(prev, todayKey))
    return true
  }, [enqueuePopup, getHabitStreak, isHabitClosedForDate])

  const checkStreakLost = useCallback(() => {
    const todayKey = getDateString()
    const yesterdayKey = getYesterdayString()

    habitsRef.current.forEach((habit) => {
      if (habit.isArchived) return
      if ((habit.lastStreakLostShown ?? null) === todayKey) return

      const currentStreak = getHabitStreak(habit)
      const yesterdayStreak = getHabitStreak(habit, yesterdayKey)
      if (yesterdayStreak <= 0) return
      if (currentStreak > 0) return

      const doneDates = getDoneDatesRef.current(habit.id)
      let lastCompletedDate: string | null = null
      doneDates.forEach((dateKey) => {
        if (!lastCompletedDate || dateKey > lastCompletedDate) lastCompletedDate = dateKey
      })

      if (lastCompletedDate === yesterdayKey) return

      enqueuePopup({
        type: 'streak_lost',
        habitId: habit.id,
        priority: POPUP_PRIORITY.streak_lost,
        data: {
          habitName: habit.name,
          habitType: habit.type,
          streak: yesterdayStreak,
          timeOfDay: getTimeOfDay(),
        },
      })

      updateHabitLocal(habit.id, { lastStreakLostShown: todayKey })
    })
  }, [enqueuePopup, getHabitStreak, updateHabitLocal])


  const updateMilestoneState = (
    habitId: string,
    prev?: Pick<Habit, 'streak' | 'goalCompleted' | 'currentMilestoneIndex'>
  ) => {
    const habit = habitsRef.current.find((h) => h.id === habitId)
    if (!habit) return null

    const prevState = prev ?? habit
    const prevStreak = prevState.streak ?? habit.streak ?? 0
    const goalDays = habit.goalDays ?? habit.daysGoal ?? null
    const milestones = habit.milestones ?? buildMilestones(goalDays, habit.type)
    const streak = getStreakRef.current(habit.id, habit.type, habit.goal)
    const bestStreak = Math.max(habit.bestStreak ?? 0, streak)
    const streakDelta = Math.max(0, streak - prevStreak)
    const lifetimeDays = (habit.lifetimeDays ?? 0) + streakDelta

    const currentIndex = prevState.currentMilestoneIndex ?? habit.currentMilestoneIndex ?? 0
    const expectedMilestone = getMilestoneValueByIndex(currentIndex, habit.type, milestones)
    const justHitMilestone =
      expectedMilestone !== null && streak === expectedMilestone && streak > prevStreak
    const milestoneValue = justHitMilestone ? expectedMilestone : null

    let currentMilestoneIndex = getCurrentMilestoneIndex(streak, habit.type, milestones)
    if (justHitMilestone) {
      currentMilestoneIndex = currentIndex + 1
    }

    const prevGoalCompleted = prevState.goalCompleted ?? habit.goalCompleted
    const justCompletedGoal = goalDays !== null && streak === goalDays && !prevGoalCompleted
    const goalCompleted = prevGoalCompleted || (goalDays !== null && streak >= goalDays)

    updateHabitLocal(habitId, {
      goalDays,
      daysGoal: goalDays,
      streak,
      bestStreak,
      lifetimeDays,
      goalCompleted,
      milestones,
      currentMilestoneIndex,
    })

    if (streak > prevStreak) {
      if (prevStreak === 0 && streak === 1 && lifetimeDays <= 1) {
        enqueuePopup({
          type: 'first_complete',
          habitId: habit.id,
          priority: POPUP_PRIORITY.first_complete,
          data: {
            habitName: habit.name,
            habitType: habit.type,
            streak,
            lifetimeDays,
            timeOfDay: getTimeOfDay(),
          },
        })
      }

      if (justHitMilestone && milestoneValue !== null) {
        enqueuePopup({
          type: 'milestone_reached',
          habitId: habit.id,
          priority: POPUP_PRIORITY.milestone_reached,
          data: {
            streak,
            milestone: milestoneValue,
            habitName: habit.name,
            habitType: habit.type,
            lifetimeDays,
            timeOfDay: getTimeOfDay(),
          },
        })
      }

      if (justCompletedGoal && goalDays !== null) {
        enqueuePopup({
          type: 'goal_reached',
          habitId: habit.id,
          priority: POPUP_PRIORITY.goal_reached,
          data: {
            streak,
            goalDays,
            habitName: habit.name,
            habitType: habit.type,
            lifetimeDays,
            timeOfDay: getTimeOfDay(),
          },
        })
      }
    }

    checkAllDone()

    return {
      justHitMilestone,
      milestoneValue,
      justCompletedGoal,
    }
  }

  const continueHabitWithoutGoal = (habitId: string) => {
    const habit = habitsRef.current.find((h) => h.id === habitId)
    if (!habit) return
    const streak = getHabitStreak(habit)
    const milestones = buildMilestones(null, habit.type)
    const currentMilestoneIndex = getCurrentMilestoneIndex(streak, habit.type, milestones)

    updateHabitLocal(habitId, {
      goalDays: null,
      daysGoal: null,
      goalCompleted: false,
      milestones,
      currentMilestoneIndex,
    })
  }

  const handlePopupPrimaryAction = useCallback(
    (event: { type: string; habitId: string | null }) => {
      if (event.type === 'goal_reached' && event.habitId) {
        continueHabitWithoutGoal(event.habitId)
      }
    },
    [continueHabitWithoutGoal]
  )

  const handlePopupSecondaryAction = useCallback(
    (event: { type: string; habitId: string | null }) => {
      if (event.type === 'goal_reached' && event.habitId) {
        archiveHabit(event.habitId)
      }
    },
    [archiveHabit]
  )

  const updateHabitFromDraft = async (habitId: string, data: CreateHabitData) => {
    const existing = habitsRef.current.find((habit) => habit.id === habitId)
    if (!existing) return false

    const goalDays = data.goalDays ?? null
    const milestones = buildMilestones(goalDays, data.type)
    const streak = getStreakRef.current(habitId, data.type, data.goal)
    const bestStreak = existing.type === data.type
      ? Math.max(existing.bestStreak ?? 0, streak)
      : streak
    const goalCompleted = goalDays !== null && streak >= goalDays
    const currentMilestoneIndex = getCurrentMilestoneIndex(streak, data.type, milestones)

    await updateHabit(habitId, {
      name: data.name,
      category: data.category,
      type: data.type,
      goal: data.type === 'daily' ? 1 : data.goal,
      goalDays,
      daysGoal: goalDays,
      reminder: data.reminder,
      streak,
      bestStreak,
      goalCompleted,
      currentMilestoneIndex,
      milestones,
    })

    return true
  }

  useEffect(() => {
    if (!isHomeHydrated || initPopupChecksRef.current) return
    initPopupChecksRef.current = true
    checkStreakLost()
    checkAllDone()
  }, [isHomeHydrated, checkAllDone, checkStreakLost])

  // checkAllDone is called explicitly:
  // 1. On initial hydration (initPopupChecks effect above)
  // 2. After each habit log (via updateMilestoneState)
  // No need for a reactive effect on logs/habits — it caused duplicate popups.

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = globalThis as any
    const resolveHabit = (habitId: string): Habit | null => {
      const allHabits = habitsRef.current
      if (allHabits.length === 0) return null

      const exact = allHabits.find((habit) => habit.id === habitId)
      if (exact) return exact

      const normalized = habitId.toLowerCase()
      const bySuffix = allHabits.find((habit) => habit.id.toLowerCase().endsWith(normalized))
      if (bySuffix) return bySuffix

      const byName = allHabits.find((habit) => habit.name.toLowerCase().includes(normalized))
      if (byName) return byName

      return allHabits[0]
    }

    const getStateMap = () => {
      const map: Record<string, Habit> = {}
      habitsRef.current.forEach((habit, index) => {
        map[habit.id] = habit
        const shortId = habit.id.split('-').pop()
        if (shortId) map[shortId] = habit
        const compactNameKey = habit.name.toLowerCase().replace(/\s+/g, '')
        if (compactNameKey) map[compactNameKey] = habit
        map[`habit${index + 1}`] = habit
      })
      return map
    }

    const resolveDebugHabit = (
      habitId: string,
      fallbackType: Habit['type'] = 'daily'
    ): { id: string; name: string; type: Habit['type']; goal: number } => {
      const id = (habitId ?? '').trim()
      const habit = id ? resolveHabit(id) : habitsRef.current[0] ?? null
      if (habit) {
        return {
          id: habit.id,
          name: habit.name,
          type: habit.type,
          goal: habit.goal,
        }
      }

      const fallbackId = id || 'debug-habit'
      return {
        id: fallbackId,
        name: fallbackId,
        type: fallbackType,
        goal: 1,
      }
    }

    const enqueueDebug = (event: PopupEventInput) => {
      enqueuePopup(event)
      return event
    }

    const debug = {
      streakLost: (habitId: string = 'water') => {
        const habit = resolveDebugHabit(habitId, 'daily')
        return enqueueDebug({
          type: 'streak_lost',
          habitId: habit.id,
          priority: 2,
          data: {
            habitName: habit.name,
            streak: 12,
            habitType: habit.type,
          },
        })
      },
      milestone: (habitId: string = 'water', streak: number = 7) => {
        const habit = resolveDebugHabit(habitId, 'daily')
        return enqueueDebug({
          type: 'milestone_reached',
          habitId: habit.id,
          priority: 3,
          data: {
            habitName: habit.name,
            streak,
            milestone: streak,
            habitType: habit.type,
          },
        })
      },
      allDone: (seriesDays: number = 18) =>
        enqueueDebug({
          type: 'all_done',
          habitId: null,
          priority: 1,
          data: {
            completedCount: 3,
            seriesDays,
            weekCompletion: 74,
            timeOfDay: 'evening',
            streaks: [
              { name: 'Вода', streak: 12, unit: 'д' },
              { name: 'Чтение', streak: 7, unit: 'д' },
            ],
          },
        }),
      allDoneLate: (seriesDays: number = 18) =>
        enqueueDebug({
          type: 'all_done',
          habitId: null,
          priority: 1,
          data: {
            completedCount: 3,
            seriesDays,
            weekCompletion: 74,
            timeOfDay: 'late',
            streaks: [
              { name: 'Вода', streak: 12, unit: 'д' },
              { name: 'Чтение', streak: 7, unit: 'д' },
            ],
          },
        }),
      firstComplete: (habitId: string = 'read') => {
        const habit = resolveDebugHabit(habitId, 'daily')
        return enqueueDebug({
          type: 'first_complete',
          habitId: habit.id,
          priority: 2,
          data: {
            habitName: habit.name,
            habitType: habit.type,
          },
        })
      },
      goalDone: (habitId: string = 'water', goalDays: number = 66) => {
        const habit = resolveDebugHabit(habitId, 'daily')
        return enqueueDebug({
          type: 'goal_reached',
          habitId: habit.id,
          priority: 1,
          data: {
            habitName: habit.name,
            goalDays,
            streak: goalDays,
            lifetimeDays: 47,
            habitType: habit.type,
          },
        })
      },
      clearQueue: () => {
        clearPopups()
      },
      showQueue: () => {
        const rows = popupStateRef.current.queue.map((item) => ({
          order: item.order,
          type: item.type,
          habitId: item.habitId,
          priority: item.priority,
        }))
        const active = popupStateRef.current.active
        if (active) {
          rows.unshift({
            order: active.order,
            type: `${active.type} (active)` as any,
            habitId: active.habitId,
            priority: active.priority,
          })
        }
        console.table(rows)
        return rows
      },
      help: () => {
        const lines = [
          'DEBUG helpers:',
          'DEBUG.streakLost()',
          "DEBUG.streakLost('water')",
          'DEBUG.milestone()',
          "DEBUG.milestone('water', 7)",
          'DEBUG.allDone(18)',
          'DEBUG.allDoneLate(18)',
          "DEBUG.firstComplete('read')",
          "DEBUG.goalDone('water', 66)",
          'DEBUG.showQueue()',
          'DEBUG.checkAllDone()',
          'DEBUG.clearQueue()',
          'DEBUG.resetFlags()',
        ]
        console.info(lines.join('\n'))
        return lines
      },
      resetFlags: () => {
        habitsRef.current.forEach((habit) => {
          updateHabitLocal(habit.id, {
            lastStreakLostShown: null,
          })
        })
        setPopupState((prev) => setAllDoneShownToday(prev, null))
      },
      checkAllDone: () => checkAllDone(),
      getState: () => popupStateRef.current,
    }

    const stateProxy = new Proxy(getStateMap(), {
      get(target, prop: string | symbol) {
        if (prop === 'popupState') return popupStateRef.current
        if (typeof prop !== 'string') return undefined
        if (prop in target) return target[prop]
        return resolveHabit(prop) ?? undefined
      },
    })

    const popupApi = {
      getState: () => popupStateRef.current,
      priorities: POPUP_PRIORITY,
      enqueuePopup,
      closeActivePopup,
      processQueue: closeActivePopup,
      clearPopups,
      checkAllDone,
      checkStreakLost,
      helpers: {
        getDateString,
        getTimeOfDay,
        getRemainingDaysInWeek,
        getYesterdayString,
      },
    }

    Object.defineProperty(root, 'popupState', {
      configurable: true,
      get: () => popupStateRef.current,
    })

    root.state = stateProxy
    root.popupApi = popupApi
    root.DEBUG = debug
    root.debug = debug
    root.enqueuePopup = enqueuePopup
    root.processQueue = closeActivePopup
  }, [
    popupState,
    enqueuePopup,
    closeActivePopup,
    clearPopups,
    checkAllDone,
    checkStreakLost,
    updateHabitLocal,
  ])

  const todayDoneCount = useMemo(
    () => activeHabits.filter((habit) => isHabitDoneToday(habit)).length,
    [activeHabits, logs]
  )

  // Best streak across all habits
  const bestStreak = useMemo(() => {
    let best = 0
    habits.forEach((h) => {
      const s = getHabitBestStreak(h)
      if (s > best) best = s
    })
    return best
  }, [habits])

  useEffect(() => {
    if (!hasSyncedCurrentHabits || habits.length === 0) return

    habits.forEach((habit) => {
      const goalDays = habit.goalDays ?? habit.daysGoal ?? null
      const milestones = habit.milestones ?? buildMilestones(goalDays, habit.type)
      const streak = getStreak(habit.id, habit.type, habit.goal)
      const bestStreakValue = Math.max(habit.bestStreak ?? 0, streak)
      const currentMilestoneIndex = getCurrentMilestoneIndex(streak, habit.type, milestones)
      const goalCompleted = habit.goalCompleted || (goalDays !== null && streak >= goalDays)
      const updates: Partial<Habit> = {}

      if (habit.goalDays !== goalDays) updates.goalDays = goalDays
      if ((habit.daysGoal ?? null) !== goalDays) updates.daysGoal = goalDays
      if (habit.streak !== streak) updates.streak = streak
      if (habit.bestStreak !== bestStreakValue) updates.bestStreak = bestStreakValue
      if (habit.goalCompleted !== goalCompleted) updates.goalCompleted = goalCompleted
      if (habit.currentMilestoneIndex !== currentMilestoneIndex) {
        updates.currentMilestoneIndex = currentMilestoneIndex
      }
      if (!areMilestonesEqual(habit.milestones, milestones)) {
        updates.milestones = milestones
      }

      if (Object.keys(updates).length > 0) {
        updateHabitLocal(habit.id, updates)
      }
    })
  }, [habits, hasSyncedCurrentHabits, getStreak, updateHabitLocal])

  if (authLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <div className={styles.content}>
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={screen}
            className={styles.panel}
            variants={screenTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              opacity: { duration: 0.18, ease: 'linear' },
              y: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
            }}
          >
            {screen === 'home' && (
              <HomeScreen
                isHydrated={isHomeHydrated}
                habits={activeHabits}
                todayCompletedCount={todayDoneCount}
                getTodayValue={getTodayValue}
                isDoneToday={isHabitDoneToday}
                getDoneDates={getDoneDates}
                getStreak={getHabitStreak}
                getBestStreak={getHabitBestStreak}
                getWeekDoneCount={getWeekDoneCount}
                getLogsForHabit={getLogsForHabit}
                logHabit={logHabit}
                undoLog={undoLog}
                showToast={showToast}
                updateMilestoneState={updateMilestoneState}
                onEditHabit={(habit, fromDrawer = false) => {
                  setRestoreDrawerHabitId(null)
                  setEditFromDrawer(fromDrawer)
                  setEditHabit(habit)
                }}
                restoreDrawerHabitId={restoreDrawerHabitId}
                onRestoreDrawerHandled={() => setRestoreDrawerHabitId(null)}
              />
            )}
            {screen === 'analytics' && (
              <AnalyticsScreen
                habits={activeHabits}
                logs={logs}
                getStreak={getHabitStreak}
                getBestStreak={getHabitBestStreak}
                onClose={() => navigateTo('home')}
              />
            )}
            {screen === 'archive' && (
              <ArchiveScreen
                habits={archivedHabits}
                onUnarchive={unarchiveHabit}
                showToast={showToast}
              />
            )}
            {screen === 'profile' && (
              <ProfileScreen
                user={tgUser}
                totalHabits={habits.length}
                bestStreak={bestStreak}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <NavBar
        active={screen}
        onNavigate={navigateTo}
        onFabClick={() => {
          setRestoreDrawerHabitId(null)
          setEditFromDrawer(false)
          setEditHabit(null)
          setCreateOpen(true)
        }}
      />

      <CreateHabit
        open={createOpen || !!editHabit}
        onClose={(options) => {
          const shouldRestoreDrawer =
            Boolean(options?.reopenDrawer) && editFromDrawer && !!editHabit
          const targetHabitId = shouldRestoreDrawer ? editHabit?.id ?? null : null
          setCreateOpen(false)
          setEditHabit(null)
          setEditFromDrawer(false)
          if (targetHabitId) {
            setRestoreDrawerHabitId(targetHabitId)
          }
        }}
        onCreate={createHabit}
        onUpdate={updateHabitFromDraft}
        editingHabit={editHabit}
        fullScreen={!!editHabit}
        disableEnterAnimation={editFromDrawer}
        showToast={showToast}
      />

      <PopupLayer
        event={popupState.active}
        onClose={closeActivePopup}
        onPrimaryAction={handlePopupPrimaryAction}
        onSecondaryAction={handlePopupSecondaryAction}
      />

      <Toast toast={toast} onHide={hideToast} />
    </div>
  )
}
