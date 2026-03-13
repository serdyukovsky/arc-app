import type { Habit } from '@/types'
import { CATEGORIES } from '@/types'
import { DAY_NAMES_SHORT, getWeekDays, isToday, parseKey } from '@/lib/date'
import { Icon } from '@/components/Icon/Icon'
import styles from './HabitCard.module.css'

interface PeriodicCardProps {
  habit: Habit
  isDone: boolean
  weekDoneCount: number
  doneDates: Set<string>
  streak: number
  bindLongPress: Record<string, any>
  onDayPress?: (day: string) => void
}

export function PeriodicCard({
  habit,
  isDone,
  weekDoneCount,
  doneDates,
  streak,
  bindLongPress,
  onDayPress,
}: PeriodicCardProps) {
  const category = CATEGORIES.find((c) => c.id === habit.category)
  const weekDays = getWeekDays()
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  return (
    <div className={`${styles.card} ${isDone ? styles.done : ''}`} {...bindLongPress}>
      <div className={styles.content}>
        <div className={styles.head}>
          <div className={styles.left}>
            <div className={styles.dim}>{habit.name}</div>
            <div className={styles.metric}>
              <span className={styles.big}>{weekDoneCount}</span>
              <span className={styles.sub}>/ {habit.goal} в неделю</span>
            </div>
          </div>
          <div className={styles.side}>
            <div className={styles.iconBox}>
              <Icon name={category?.icon ?? 'add_circle'} size={22} />
            </div>
            {streak > 0 && (
              <div className={styles.pill}>
                <span className={styles.fire}>🔥</span>
                <span>{streak}н</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.weekRow}>
          {weekDays.map((day, i) => (
            <button
              key={day}
              type="button"
              data-interactive="true"
              className={`${styles.dayCol} ${styles.dayButton}`}
              onClick={(event) => {
                event.stopPropagation()
                onDayPress?.(day)
              }}
            >
              <div
                className={[
                  styles.dayDot,
                  doneDates.has(day) ? styles.dayDotFilled : styles.dayDotEmpty,
                  isToday(day) ? styles.dayDotToday : '',
                ].join(' ')}
              />
              <span
                className={[
                  styles.dayLabel,
                  isToday(day) ? styles.dayLabelToday : '',
                  parseKey(day).getTime() > todayDate.getTime() ? styles.dayLabelFuture : '',
                ].join(' ')}
              >
                {DAY_NAMES_SHORT[i]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
