import { useState, useMemo, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTelegram } from '@/hooks/useTelegram'
import { useAuth } from '@/hooks/useAuth'
import { useHabits } from '@/hooks/useHabits'
import { useHabitLogs } from '@/hooks/useHabitLogs'
import { useToast } from '@/hooks/useToast'
import type { Habit } from '@/types'
import { buildMilestones, getCurrentMilestoneIndex, getMilestoneValueByIndex } from '@/lib/milestones'
import { NavBar, type Screen } from '@/components/NavBar/NavBar'
import { Toast } from '@/components/Toast/Toast'
import { HomeScreen } from '@/screens/HomeScreen/HomeScreen'
import { AnalyticsScreen } from '@/screens/AnalyticsScreen/AnalyticsScreen'
import { ArchiveScreen } from '@/screens/ArchiveScreen/ArchiveScreen'
import { ProfileScreen } from '@/screens/ProfileScreen/ProfileScreen'
import { CreateHabit, type CreateHabitData } from '@/screens/CreateHabit/CreateHabit'
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

  useEffect(() => {
    const cleanup = telegram.bindSafeAreaCssVars()
    return cleanup
  }, [])

  useEffect(() => {
    habitsRef.current = habits
  }, [habits])

  const navigateTo = (next: Screen) => {
    if (next === screen) return
    setScreen(next)
  }

  const isHabitDoneToday = (habit: Habit, dateKey?: string): boolean => {
    if (habit.type === 'counter') return isDoneToday(habit.id, habit.goal, dateKey)
    return isDoneToday(habit.id, 1, dateKey)
  }

  const getHabitStreak = (habit: Habit, dateKey?: string): number =>
    getStreak(habit.id, habit.type, habit.goal, dateKey)
  const getHabitBestStreak = (habit: Habit): number => habit.bestStreak ?? 0

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
    const streak = getStreak(habit.id, habit.type, habit.goal)
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

  const updateHabitFromDraft = async (habitId: string, data: CreateHabitData) => {
    const existing = habitsRef.current.find((habit) => habit.id === habitId)
    if (!existing) return false

    const goalDays = data.goalDays ?? null
    const milestones = buildMilestones(goalDays, data.type)
    const streak = getStreak(habitId, data.type, data.goal)
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
                  setEditFromDrawer(fromDrawer)
                  setEditHabit(habit)
                }}
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
          setEditFromDrawer(false)
          setEditHabit(null)
          setCreateOpen(true)
        }}
      />

      <CreateHabit
        open={createOpen || !!editHabit}
        onClose={() => {
          setCreateOpen(false)
          setEditHabit(null)
          setEditFromDrawer(false)
        }}
        onCreate={createHabit}
        onUpdate={updateHabitFromDraft}
        editingHabit={editHabit}
        fullScreen={!!editHabit}
        disableEnterAnimation={editFromDrawer}
        showToast={showToast}
      />

      <Toast toast={toast} onHide={hideToast} />
    </div>
  )
}
