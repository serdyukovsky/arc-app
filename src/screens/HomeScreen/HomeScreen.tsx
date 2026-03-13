import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Habit, HabitLog } from '@/types'
import { CATEGORIES } from '@/types'
import { parseKey, today } from '@/lib/date'
import { triggerHaptic } from '@/lib/haptics'
import { getMilestoneProgress } from '@/lib/milestones'
import { Header } from '@/components/Header/Header'
import { HeroCard } from '@/components/HeroCard/HeroCard'
import { HabitCard } from '@/components/HabitCard/HabitCard'
import { Drawer } from '@/components/Drawer/Drawer'
import { GoalCompleteSheet } from '@/components/GoalCompleteSheet/GoalCompleteSheet'
import { Icon } from '@/components/Icon/Icon'
import styles from './HomeScreen.module.css'

interface HomeScreenProps {
  isHydrated: boolean
  habits: Habit[]
  todayCompletedCount: number
  getTodayValue: (id: string, dateKey?: string) => number
  isDoneToday: (habit: Habit, dateKey?: string) => boolean
  getDoneDates: (id: string) => Set<string>
  getStreak: (habit: Habit, dateKey?: string) => number
  getBestStreak: (habit: Habit) => number
  getWeekDoneCount: (id: string, dateKey?: string) => number
  getLogsForHabit: (id: string) => HabitLog[]
  logHabit: (id: string, value?: number) => Promise<any>
  undoLog: (id: string) => Promise<boolean>
  showToast: (message: string, onUndo?: () => void) => void
  updateMilestoneState: (
    habitId: string,
    prev?: Pick<Habit, 'streak' | 'goalCompleted' | 'currentMilestoneIndex'>
  ) => {
    justHitMilestone: boolean
    milestoneValue: number | null
    justCompletedGoal: boolean
  } | null
  onGoalComplete: (habitId: string) => void
  onGoalContinue: (habitId: string) => void
  onEditHabit: (habit: Habit, fromDrawer?: boolean) => void
  restoreDrawerHabitId?: string | null
  onRestoreDrawerHandled?: () => void
}

const counterUnit = (name: string): string => {
  const n = name.toLowerCase()
  if (n.includes('вод')) return 'стаканов'
  if (n.includes('страниц')) return 'страниц'
  if (n.includes('шаг')) return 'шагов'
  return 'единиц'
}

const pluralRu = (value: number, one: string, few: string, many: string): string => {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const toValidDate = (value?: string | null): Date => {
  const parsed = value ? new Date(value) : new Date()
  if (Number.isNaN(parsed.getTime())) return new Date()
  return parsed
}

export function HomeScreen({
  isHydrated,
  habits,
  todayCompletedCount,
  getTodayValue,
  isDoneToday,
  getDoneDates,
  getStreak,
  getBestStreak,
  getWeekDoneCount,
  getLogsForHabit,
  logHabit,
  undoLog,
  showToast,
  updateMilestoneState,
  onGoalComplete,
  onGoalContinue,
  onEditHabit,
  restoreDrawerHabitId = null,
  onRestoreDrawerHandled,
}: HomeScreenProps) {
  const [drawerHabit, setDrawerHabit] = useState<Habit | null>(null)
  const [pulseHabitId, setPulseHabitId] = useState<string | null>(null)
  const [goalCompleteHabitId, setGoalCompleteHabitId] = useState<string | null>(null)
  const [selectedHeaderDay, setSelectedHeaderDay] = useState<string | null>(null)
  const [drawerExpandingToEdit, setDrawerExpandingToEdit] = useState(false)
  const togglePendingRef = useRef<Set<string>>(new Set())
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const todayKey = today()
  const activeDay = selectedHeaderDay ?? todayKey

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current)
      if (editTransitionTimeoutRef.current) clearTimeout(editTransitionTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!restoreDrawerHabitId) return
    const habit = habits.find((item) => item.id === restoreDrawerHabitId) ?? null
    if (habit) {
      setDrawerExpandingToEdit(false)
      setDrawerHabit(habit)
    }
    onRestoreDrawerHandled?.()
  }, [restoreDrawerHabitId, habits, onRestoreDrawerHandled])

  const goalCompleteHabit = goalCompleteHabitId
    ? habits.find((habit) => habit.id === goalCompleteHabitId) ?? null
    : null

  const formatMilestoneToast = (value: number, habit: Habit): string => {
    const unit = habit.type === 'periodic' ? 'нед' : 'д'
    return `Новый milestone: ${value}${unit}`
  }

  const triggerPulse = (habitId: string) => {
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current)
    setPulseHabitId(habitId)
    pulseTimeoutRef.current = setTimeout(() => {
      setPulseHabitId(null)
    }, 520)
  }

  const scheduleMilestoneUpdate = (habit: Habit) => {
    window.requestAnimationFrame(() => {
      const result = updateMilestoneState(habit.id, habit)
      if (!result) return
      if (result.justHitMilestone && result.milestoneValue !== null) {
        showToast(formatMilestoneToast(result.milestoneValue, habit))
        triggerPulse(habit.id)
      }
      if (result.justCompletedGoal) {
        setGoalCompleteHabitId(habit.id)
      }
    })
  }

  const handleHeaderDayPress = (day: string) => {
    const selected = parseKey(day)
    selected.setHours(0, 0, 0, 0)

    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    const dayLabel = selected.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })

    if (selected.getTime() > currentDate.getTime()) {
      showToast(`${dayLabel}: день ещё не наступил`)
      return
    }

    setSelectedHeaderDay(day)
    const completedCount = habits.reduce((count, habit) => {
      return count + (isDoneToday(habit, day) ? 1 : 0)
    }, 0)
    showToast(`${dayLabel}: ${completedCount}/${habits.length} привычек`)
  }

  const handleDayPress = (habit: Habit, day: string) => {
    const selected = parseKey(day)
    selected.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dayLabel = selected.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })

    if (selected.getTime() > today.getTime()) {
      showToast(`${dayLabel}: день ещё не наступил`)
      return
    }

    const done = isDoneToday(habit, day)
    showToast(`${dayLabel}: ${done ? 'выполнено ✓' : 'пропуск'}`)
  }

  const handleTap = async (habit: Habit) => {
    if (activeDay !== todayKey) {
      showToast('Это прошлый день. Вернись на сегодня, чтобы отмечать')
      return
    }

    if (habit.type === 'counter') {
      const current = getTodayValue(habit.id)
      if (current >= habit.goal) return

      const next = Math.min(current + 1, habit.goal)
      const saved = await logHabit(habit.id, 1)
      if (!saved) {
        showToast('Не удалось сохранить отметку')
        return
      }

      scheduleMilestoneUpdate(habit)

      if (next >= habit.goal) {
        triggerHaptic('success')
        showToast(`${habit.name} выполнена ✓`)
      } else {
        showToast(`${next} / ${habit.goal} ${counterUnit(habit.name)}`)
      }
      return
    }

    if (togglePendingRef.current.has(habit.id)) return
    togglePendingRef.current.add(habit.id)

    try {
      if (isDoneToday(habit)) {
        const removed = await undoLog(habit.id)
        if (!removed) {
          showToast('Не удалось сохранить отметку')
          return
        }
        scheduleMilestoneUpdate(habit)
        showToast('Отметка снята', () => {
          void logHabit(habit.id)
        })
        return
      }

      const created = await logHabit(habit.id)
      if (!created) {
        showToast('Не удалось сохранить отметку')
        return
      }

      scheduleMilestoneUpdate(habit)
      triggerHaptic('success')
      showToast(`${habit.name} отмечена ✓`, () => {
        void undoLog(habit.id)
      })
    } finally {
      togglePendingRef.current.delete(habit.id)
    }
  }

  const handleDrawerClose = () => {
    if (editTransitionTimeoutRef.current) {
      clearTimeout(editTransitionTimeoutRef.current)
      editTransitionTimeoutRef.current = null
    }
    setDrawerExpandingToEdit(false)
    setDrawerHabit(null)
  }

  const handleDrawerEdit = () => {
    if (!drawerHabit || drawerExpandingToEdit) return
    const habitToEdit = drawerHabit
    setDrawerExpandingToEdit(true)
    editTransitionTimeoutRef.current = setTimeout(() => {
      onEditHabit(habitToEdit, true)
      setDrawerHabit(null)
      setDrawerExpandingToEdit(false)
      editTransitionTimeoutRef.current = null
    }, 220)
  }

  if (!isHydrated) {
    return (
      <div className={styles.screen}>
        <Header />
        <div className={styles.skeletonHero} />
        <div className={styles.list}>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={styles.skeletonCard}
              style={{ animationDelay: `${index * 0.08}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  const completedForActiveDay = habits.filter((habit) => isDoneToday(habit, activeDay)).length
  const drawerStreak = drawerHabit ? getStreak(drawerHabit, activeDay) : 0
  const drawerBestStreak = drawerHabit ? getBestStreak(drawerHabit) : 0
  const drawerGoalDays = drawerHabit?.goalDays ?? null
  const drawerGoalCompleted = drawerHabit ? drawerGoalDays !== null && drawerStreak >= drawerGoalDays : false
  const drawerMilestone = drawerHabit
    ? getMilestoneProgress({ ...drawerHabit, streak: drawerStreak })
    : null
  const drawerMilestoneRemaining = drawerMilestone
    ? Math.max(0, drawerMilestone.nextMilestone - drawerStreak)
    : 0
  const drawerMilestoneUnits = drawerHabit?.type === 'periodic'
    ? { one: 'неделя', few: 'недели', many: 'недель' }
    : { one: 'день', few: 'дня', many: 'дней' }
  const showMilestoneRow = !!drawerHabit && !(drawerGoalDays === null && drawerStreak === 0)

  const refDate = parseKey(activeDay)
  refDate.setHours(0, 0, 0, 0)
  const createdDate = toValidDate(drawerHabit?.created)
  createdDate.setHours(0, 0, 0, 0)
  const diffMs = refDate.getTime() - createdDate.getTime()
  const safeDaysDiff = Number.isFinite(diffMs) ? Math.floor(diffMs / 86400000) : 0
  const daysSinceCreation = Math.max(1, safeDaysDiff + 1)
  const weeksSinceCreation = Math.max(1, Math.ceil(daysSinceCreation / 7))
  const startedLabel = drawerHabit
    ? createdDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : ''

  const lifetimeDaysRaw = Number(drawerHabit?.lifetimeDays ?? 0)
  const lifetimeDays = Number.isFinite(lifetimeDaysRaw) ? lifetimeDaysRaw : 0
  const completionBase = drawerHabit?.type === 'periodic' ? weeksSinceCreation : daysSinceCreation
  const completionRatio = completionBase > 0 ? lifetimeDays / completionBase : 0
  const completionPercent = Number.isFinite(completionRatio)
    ? Math.min(100, Math.round(completionRatio * 100))
    : 0

  const drawerLogs = drawerHabit ? getLogsForHabit(drawerHabit.id) : []
  const counterTotal = drawerLogs.reduce((sum, log) => sum + log.value, 0)
  const counterBestDay = drawerLogs.reduce((max, log) => Math.max(max, log.value), 0)

  const goalInfo = (() => {
    if (!drawerHabit || drawerGoalDays === null) return null
    if (drawerHabit.type === 'daily') {
      return `Цель — ${drawerGoalDays} ${pluralRu(drawerGoalDays, 'день', 'дня', 'дней')}`
    }
    if (drawerHabit.type === 'counter') {
      return `Цель — ${drawerHabit.goal} в день`
    }
    return `Цель — ${drawerHabit.goal} ${pluralRu(drawerHabit.goal, 'раз', 'раза', 'раз')} в неделю`
  })()

  return (
    <div className={styles.screen}>
      <Header selectedDay={selectedHeaderDay} onDayPress={handleHeaderDayPress} />
      <HeroCard completed={activeDay === todayKey ? todayCompletedCount : completedForActiveDay} total={habits.length} />

      <div className={styles.list}>
        <AnimatePresence initial={false}>
          {habits.map((habit) => (
            <motion.div
              key={habit.id}
              layout="position"
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.12, ease: 'linear' },
                layout: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
              }}
            >
              <HabitCard
                habit={habit}
                todayValue={getTodayValue(habit.id, activeDay)}
                isDoneToday={isDoneToday(habit, activeDay)}
                doneDates={getDoneDates(habit.id)}
                streak={getStreak(habit, activeDay)}
                weekDoneCount={getWeekDoneCount(habit.id, activeDay)}
                pulse={pulseHabitId === habit.id}
                onDayPress={(day) => handleDayPress(habit, day)}
                onTap={() => {
                  void handleTap(habit)
                }}
                onLongPress={() => {
                  setDrawerExpandingToEdit(false)
                  setDrawerHabit(habit)
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Drawer
        open={!!drawerHabit}
        onClose={handleDrawerClose}
        fullScreen={drawerExpandingToEdit}
        disableExitAnimation={drawerExpandingToEdit}
      >
        {drawerHabit && (
          <div className={`${styles.drawerBody} ${drawerExpandingToEdit ? styles.drawerBodyToEdit : ''}`}>
            <div className={styles.drawerHead}>
              <div className={styles.drawerHeadMain}>
                <div className={styles.drawerIconBox}>
                  <Icon
                    name={CATEGORIES.find((c) => c.id === drawerHabit.category)?.icon ?? 'add_circle'}
                    size={28}
                  />
                </div>
                <div className={styles.drawerTitle}>{drawerHabit.name}</div>
              </div>
              <button
                type="button"
                className={styles.drawerIconAction}
                aria-label="Изменить привычку"
                disabled={drawerExpandingToEdit}
                onClick={handleDrawerEdit}
              >
                <Icon name="edit" size={20} />
              </button>
            </div>

            <div className={styles.drawerPairRow}>
              <div className={styles.drawerMetricBlock}>
                <div className={styles.drawerMetricValue}>{drawerStreak}</div>
                <div className={styles.drawerMetricLabel}>
                  {drawerHabit.type === 'periodic' ? 'недель стрика' : 'дней стрика'}
                </div>
              </div>
              <div className={styles.drawerMetricBlock}>
                <div className={styles.drawerMetricValue}>{drawerBestStreak}</div>
                <div className={styles.drawerMetricLabel}>лучший рекорд</div>
              </div>
            </div>

            {showMilestoneRow && (
              <>
                <div className={styles.drawerDivider} />
                <div className={styles.drawerFullRow}>
                  {drawerGoalCompleted
                    ? '🏆 цель достигнута'
                    : `ещё ${drawerMilestoneRemaining} ${pluralRu(
                        drawerMilestoneRemaining,
                        drawerMilestoneUnits.one,
                        drawerMilestoneUnits.few,
                        drawerMilestoneUnits.many
                      )} → milestone ${drawerMilestone?.nextMilestone ?? 0}`}
                </div>
              </>
            )}

            <div className={styles.drawerDivider} />
            <div className={styles.drawerPairRow}>
              <div className={styles.drawerMetricBlock}>
                <div className={styles.drawerMetricValue}>
                  {drawerHabit.type === 'counter' ? counterTotal : lifetimeDays}
                </div>
                <div className={styles.drawerMetricLabel}>
                  {drawerHabit.type === 'counter' ? 'всего единиц' : 'раз всего'}
                </div>
              </div>
              <div className={styles.drawerMetricBlock}>
                <div className={styles.drawerMetricValue}>{completionPercent}%</div>
                <div className={styles.drawerMetricLabel}>
                  {drawerHabit.type === 'periodic' ? 'недель выполнено' : 'дней выполнено'}
                </div>
              </div>
            </div>

            <div className={styles.drawerDivider} />
            <div className={styles.drawerFullRow}>
              {drawerHabit.type === 'periodic'
                ? `${weeksSinceCreation} ${pluralRu(weeksSinceCreation, 'неделя', 'недели', 'недель')} — с ${startedLabel}`
                : `${daysSinceCreation} ${pluralRu(daysSinceCreation, 'день', 'дня', 'дней')} — с ${startedLabel}`}
            </div>

            {goalInfo && (
              <>
                <div className={styles.drawerDivider} />
                <div className={styles.drawerFullRow}>{goalInfo}</div>
              </>
            )}

            {drawerHabit.type === 'counter' && (
              <>
                <div className={styles.drawerDivider} />
                <div className={styles.drawerFullRow}>рекорд за день: {counterBestDay}</div>
              </>
            )}

          </div>
        )}
      </Drawer>

      <GoalCompleteSheet
        open={!!goalCompleteHabit}
        habitName={goalCompleteHabit?.name}
        onComplete={() => {
          if (goalCompleteHabit) {
            onGoalComplete(goalCompleteHabit.id)
            setGoalCompleteHabitId(null)
          }
        }}
        onContinue={() => {
          if (goalCompleteHabit) {
            onGoalContinue(goalCompleteHabit.id)
            setGoalCompleteHabitId(null)
          }
        }}
      />
    </div>
  )
}
