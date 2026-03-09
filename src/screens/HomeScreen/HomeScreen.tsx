import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Habit } from '@/types'
import { CATEGORIES } from '@/types'
import { triggerHaptic } from '@/lib/haptics'
import { Header } from '@/components/Header/Header'
import { HeroCard } from '@/components/HeroCard/HeroCard'
import { HabitCard } from '@/components/HabitCard/HabitCard'
import { Drawer } from '@/components/Drawer/Drawer'
import { ConfirmSheet } from '@/components/ConfirmSheet/ConfirmSheet'
import { Icon } from '@/components/Icon/Icon'
import styles from './HomeScreen.module.css'

interface HomeScreenProps {
  habits: Habit[]
  todayCompletedCount: number
  getTodayValue: (id: string) => number
  isDoneToday: (habit: Habit) => boolean
  getDoneDates: (id: string) => Set<string>
  getStreak: (habit: Habit) => number
  getBestStreak: (habit: Habit) => number
  getWeekDoneCount: (id: string) => number
  logHabit: (id: string, value?: number) => Promise<any>
  undoLog: (id: string) => Promise<boolean>
  deleteHabit: (id: string) => Promise<void>
  showToast: (message: string, onUndo?: () => void) => void
}

const counterUnit = (name: string): string => {
  const n = name.toLowerCase()
  if (n.includes('вод')) return 'стаканов'
  if (n.includes('страниц')) return 'страниц'
  if (n.includes('шаг')) return 'шагов'
  return 'единиц'
}

const formatStarted = (isoDate: string): string =>
  new Date(isoDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

export function HomeScreen({
  habits,
  todayCompletedCount,
  getTodayValue,
  isDoneToday,
  getDoneDates,
  getStreak,
  getBestStreak,
  getWeekDoneCount,
  logHabit,
  undoLog,
  deleteHabit,
  showToast,
}: HomeScreenProps) {
  const [drawerHabit, setDrawerHabit] = useState<Habit | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Habit | null>(null)
  const togglePendingRef = useRef<Set<string>>(new Set())

  const handleTap = async (habit: Habit) => {
    if (habit.type === 'counter') {
      const current = getTodayValue(habit.id)
      if (current >= habit.goal) return

      const next = Math.min(current + 1, habit.goal)
      const saved = await logHabit(habit.id, 1)
      if (!saved) {
        showToast('Не удалось сохранить отметку')
        return
      }

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

      triggerHaptic('success')
      showToast(`${habit.name} отмечена ✓`, () => {
        void undoLog(habit.id)
      })
    } finally {
      togglePendingRef.current.delete(habit.id)
    }
  }

  return (
    <div className={styles.screen}>
      <Header />
      <HeroCard completed={todayCompletedCount} total={habits.length} />

      <div className={styles.list}>
        <AnimatePresence>
          {habits.map((habit, i) => (
            <motion.div
              key={habit.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
            >
              <HabitCard
                habit={habit}
                todayValue={getTodayValue(habit.id)}
                isDoneToday={isDoneToday(habit)}
                doneDates={getDoneDates(habit.id)}
                streak={getStreak(habit)}
                weekDoneCount={getWeekDoneCount(habit.id)}
                onTap={() => {
                  void handleTap(habit)
                }}
                onLongPress={() => setDrawerHabit(habit)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Drawer open={!!drawerHabit} onClose={() => setDrawerHabit(null)}>
        {drawerHabit && (
          <div>
            <div className={styles.drawerHead}>
              <div className={styles.drawerIconBox}>
                <Icon
                  name={CATEGORIES.find((c) => c.id === drawerHabit.category)?.icon ?? 'add_circle'}
                  size={28}
                />
              </div>
              <div className={styles.drawerTitle}>{drawerHabit.name}</div>
            </div>

            <div className={styles.drawerGrid}>
              <div className={styles.drawerStat}>
                <div className={styles.drawerStatLabel}>СТРИК</div>
                <div className={styles.drawerStatValue}>{getStreak(drawerHabit)} {drawerHabit.type === 'periodic' ? 'нед' : 'дн'}</div>
              </div>
              <div className={styles.drawerStat}>
                <div className={styles.drawerStatLabel}>РЕКОРД</div>
                <div className={styles.drawerStatValue}>{getBestStreak(drawerHabit)} {drawerHabit.type === 'periodic' ? 'нед' : 'дн'}</div>
              </div>
              <div className={styles.drawerStat}>
                <div className={styles.drawerStatLabel}>С</div>
                <div className={styles.drawerStatValue}>{formatStarted(drawerHabit.created)}</div>
              </div>
              <div className={styles.drawerStat}>
                <div className={styles.drawerStatLabel}>ИНФО</div>
                <div className={styles.drawerStatValue}>
                  {drawerHabit.type === 'counter' && `Цель ${drawerHabit.goal}/день`}
                  {drawerHabit.type === 'periodic' && `${getWeekDoneCount(drawerHabit.id)}/${drawerHabit.goal} неделя`}
                  {drawerHabit.type === 'daily' && `${Math.min(getStreak(drawerHabit), 28)}/28`}
                </div>
              </div>
            </div>

            <div className={styles.drawerActions}>
              <button
                className={styles.drawerGhostBtn}
                onClick={() => {
                  setDrawerHabit(null)
                }}
              >
                Изменить
              </button>
              <button className={styles.drawerPrimaryBtn} onClick={() => setDrawerHabit(null)}>
                Готово
              </button>
            </div>

            <button
              className={styles.drawerDeleteBtn}
              onClick={() => {
                setDrawerHabit(null)
                setConfirmDelete(drawerHabit)
              }}
            >
              Удалить привычку
            </button>
          </div>
        )}
      </Drawer>

      <ConfirmSheet
        open={!!confirmDelete}
        habitName={confirmDelete?.name}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            void deleteHabit(confirmDelete.id)
            showToast('Привычка удалена')
          }
        }}
      />
    </div>
  )
}
