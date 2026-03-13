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
  emitMilestoneToast,
  enqueuePopupEvent,
  getDateString,
  getRemainingDaysInWeek,
  getTimeOfDay,
  getYesterdayString,
  isDeadWeek,
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
  const lastHandledPopupKeyRef = useRef<string | null>(null)
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

  useEffect(() => {
    const active = popupState.active
    if (!active) return

    const popupKey = `${active.order}:${active.type}:${active.habitId ?? 'null'}`
    if (lastHandledPopupKeyRef.current === popupKey) return
    lastHandledPopupKeyRef.current = popupKey

    if (active.type !== 'milestone_reached' || !active.habitId || active.data.singleHabitAllDone) {
      return
    }

    const habit = habitsRef.current.find((item) => item.id === active.habitId)
    if (!habit) return
    const count = habit.milestonePopupCount ?? 0
    updateHabitLocal(habit.id, { milestonePopupCount: count + 1 })
  }, [popupState.active, updateHabitLocal])

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

    setPopupState((prev) => ({ ...prev, allDoneShownToday: todayKey }))
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

  const checkFreezeOffer = useCallback(() => {
    const now = new Date()
    const todayKey = getDateString(now)
    const hour = now.getHours()
    const remainingDaysInWeek = getRemainingDaysInWeek(now)

    habitsRef.current.forEach((habit) => {
      if (habit.isArchived) return
      if ((habit.lastFreezeOfferShown ?? null) === todayKey) return
      const freezesAvailable = habit.freezesAvailable ?? 0
      if (freezesAvailable <= 0) return

      if (habit.type === 'daily') {
        if ((habit.streak ?? 0) <= 0) return
        if (isHabitDoneToday(habit, todayKey)) return
        if (hour < 20) return
        const hoursLeft = Math.max(0, 24 - hour)

        enqueuePopup({
          type: 'freeze_offer',
          habitId: habit.id,
          priority: POPUP_PRIORITY.freeze_offer,
          data: {
            habitName: habit.name,
            habitType: habit.type,
            streak: habit.streak,
            hoursLeft,
            timeOfDay: getTimeOfDay(now),
          },
        })
        updateHabitLocal(habit.id, { lastFreezeOfferShown: todayKey })
        return
      }

      if (habit.type !== 'periodic') return
      const weekDone = getWeekDoneCountRef.current(habit.id, todayKey)
      if (weekDone >= habit.goal) return
      if (remainingDaysInWeek > 1) return
      const canSaveWithFreeze = weekDone + freezesAvailable >= habit.goal
      if (!canSaveWithFreeze) return

      enqueuePopup({
        type: 'freeze_offer',
        habitId: habit.id,
        priority: POPUP_PRIORITY.freeze_offer,
        data: {
          habitName: habit.name,
          habitType: habit.type,
          streak: habit.streak,
          daysLeft: remainingDaysInWeek,
          weekDone,
          weekGoal: habit.goal,
          timeOfDay: getTimeOfDay(now),
        },
      })
      updateHabitLocal(habit.id, { lastFreezeOfferShown: todayKey })
    })
  }, [enqueuePopup, isHabitDoneToday, updateHabitLocal])

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
      if ((habit.type === 'daily' || habit.type === 'counter') && !habit.firstCompleted) {
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
        updateHabitLocal(habit.id, { firstCompleted: true })
      }

      if (justHitMilestone && milestoneValue !== null) {
        const popupCount = habit.milestonePopupCount ?? 0
        if (popupCount < 3) {
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
        } else {
          emitMilestoneToast(habit.name, milestoneValue)
        }
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
    checkFreezeOffer()
    checkAllDone()
  }, [isHomeHydrated, checkAllDone, checkFreezeOffer, checkStreakLost])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const popupApi = {
      getState: () => popupStateRef.current,
      priorities: POPUP_PRIORITY,
      enqueuePopup,
      closeActivePopup,
      processQueue: closeActivePopup,
      clearPopups,
      checkAllDone,
      checkStreakLost,
      checkFreezeOffer,
      helpers: {
        getDateString,
        getTimeOfDay,
        getRemainingDaysInWeek,
        getYesterdayString,
      },
    }
    ;(window as any).popupState = popupStateRef.current
    ;(window as any).popupApi = popupApi
  }, [
    popupState,
    enqueuePopup,
    closeActivePopup,
    clearPopups,
    checkAllDone,
    checkStreakLost,
    checkFreezeOffer,
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
                onGoalComplete={archiveHabit}
                onGoalContinue={continueHabitWithoutGoal}
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
