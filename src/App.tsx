import { useState, useMemo, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTelegram } from '@/hooks/useTelegram'
import { useAuth } from '@/hooks/useAuth'
import { useHabits } from '@/hooks/useHabits'
import { useHabitLogs } from '@/hooks/useHabitLogs'
import { useToast } from '@/hooks/useToast'
import type { Habit } from '@/types'
import { NavBar, type Screen } from '@/components/NavBar/NavBar'
import { Toast } from '@/components/Toast/Toast'
import { HomeScreen } from '@/screens/HomeScreen/HomeScreen'
import { AnalyticsScreen } from '@/screens/AnalyticsScreen/AnalyticsScreen'
import { ArchiveScreen } from '@/screens/ArchiveScreen/ArchiveScreen'
import { ProfileScreen } from '@/screens/ProfileScreen/ProfileScreen'
import { CreateHabit } from '@/screens/CreateHabit/CreateHabit'
import styles from './App.module.css'

const SCREEN_ORDER: Record<Screen, number> = {
  home: 0,
  analytics: 1,
  archive: 2,
  profile: 3,
}

const screenTransition = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 26 : -26,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -16 : 16,
  }),
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [createOpen, setCreateOpen] = useState(false)
  const [screenDirection, setScreenDirection] = useState(1)

  const telegram = useTelegram()
  const { token, userId, isLoading: authLoading } = useAuth(telegram.getInitData)
  const {
    activeHabits,
    archivedHabits,
    habits,
    isLoading: habitsLoading,
    createHabit,
    unarchiveHabit,
    deleteHabit,
  } = useHabits(token, userId)

  const habitIds = useMemo(() => habits.map((h) => h.id), [habits])
  const {
    logs,
    hasSyncedCurrentHabits,
    getTodayValue,
    isDoneToday,
    getDoneDates,
    getStreak,
    getBestStreak,
    getWeekDoneCount,
    logHabit,
    undoLog,
  } = useHabitLogs(token, habitIds, userId)

  const { toast, showToast, hideToast } = useToast()

  const tgUser = telegram.getUser()
  const isHomeHydrated = !habitsLoading && hasSyncedCurrentHabits

  useEffect(() => {
    const cleanup = telegram.bindSafeAreaCssVars()
    return cleanup
  }, [])

  const navigateTo = (next: Screen) => {
    if (next === screen) return
    setScreenDirection(SCREEN_ORDER[next] > SCREEN_ORDER[screen] ? 1 : -1)
    setScreen(next)
  }

  const isHabitDoneToday = (habit: Habit): boolean => {
    if (habit.type === 'counter') return isDoneToday(habit.id, habit.goal)
    return isDoneToday(habit.id, 1)
  }

  const getHabitStreak = (habit: Habit): number => getStreak(habit.id, habit.type, habit.goal)
  const getHabitBestStreak = (habit: Habit): number => getBestStreak(habit.id, habit.type, habit.goal)

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
  }, [habits, logs])

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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            className={styles.panel}
            custom={screenDirection}
            variants={screenTransition}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
                logHabit={logHabit}
                undoLog={undoLog}
                deleteHabit={deleteHabit}
                showToast={showToast}
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
        onFabClick={() => setCreateOpen(true)}
      />

      <CreateHabit
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createHabit}
        showToast={showToast}
      />

      <Toast toast={toast} onHide={hideToast} />
    </div>
  )
}
