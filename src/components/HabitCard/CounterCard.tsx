import type { Habit } from '@/types'
import { CATEGORIES } from '@/types'
import { Icon } from '@/components/Icon/Icon'
import styles from './HabitCard.module.css'

interface CounterCardProps {
  habit: Habit
  value: number
  streak: number
  bindLongPress: Record<string, any>
}

export function CounterCard({ habit, value, streak, bindLongPress }: CounterCardProps) {
  const isDone = value >= habit.goal
  const category = CATEGORIES.find((c) => c.id === habit.category)
  const visibleGoal = Math.min(12, Math.max(1, habit.goal))
  const filled = habit.goal > 0 ? Math.min(visibleGoal, Math.round((Math.min(value, habit.goal) / habit.goal) * visibleGoal)) : 0

  return (
    <div
      className={`${styles.card} ${isDone ? styles.done : ''}`}
      {...bindLongPress}
    >
      <div className={styles.content}>
        <div className={styles.head}>
          <div className={styles.left}>
            <div className={styles.dim}>{habit.name}</div>
            <div className={styles.metric}>
              <span className={styles.big}>{Math.min(value, habit.goal)}</span>
              <span className={styles.sub}>/ {habit.goal} единиц</span>
            </div>
          </div>
          <div className={styles.side}>
            <div className={styles.iconBox}>
              <Icon name={category?.icon ?? 'add_circle'} size={22} />
            </div>
            {streak > 0 && (
              <div className={styles.pill}>
                <span className={styles.fire}>🔥</span>
                <span>{streak}д</span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.counterDots}>
          {Array.from({ length: visibleGoal }, (_, i) => (
            <div
              key={i}
              className={[
                styles.counterDot,
                i < filled ? styles.counterDotFilled : styles.counterDotEmpty,
                i === filled - 1 ? styles.pop : '',
              ].join(' ')}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
