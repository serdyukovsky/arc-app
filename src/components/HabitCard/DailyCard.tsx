import type { Habit } from '@/types'
import { DAY_NAMES_SHORT, getWeekDays, isToday, parseKey } from '@/lib/date'
import styles from './HabitCard.module.css'

interface DailyCardProps {
  habit: Habit
  isDone: boolean
  doneDates: Set<string>
  streak: number
  bindLongPress: Record<string, any>
}

const RADIUS = 31
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function DailyCard({
  habit,
  isDone,
  doneDates,
  streak,
  bindLongPress,
}: DailyCardProps) {
  const weekDays = getWeekDays()
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const streakWindow = Math.max(0, Math.min(streak, 28))
  const offset = CIRCUMFERENCE * (1 - streakWindow / 28)

  return (
    <div className={`${styles.card} ${isDone ? styles.done : ''}`} {...bindLongPress}>
      <div className={styles.content}>
        <div className={styles.dailyTop}>
          <div className={styles.left}>
            <div className={styles.dim}>{habit.name}</div>
            <div className={styles.metric}>
              <span className={styles.big}>{streak}</span>
              <span className={styles.sub}>дней подряд</span>
            </div>
          </div>

          <div className={styles.arcRing}>
            <svg width="70" height="70" viewBox="0 0 70 70" className={styles.arcSvg}>
              <circle className={styles.arcTrack} cx="35" cy="35" r={RADIUS} />
              <circle
                className={styles.arcFill}
                cx="35"
                cy="35"
                r={RADIUS}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
              />
            </svg>
            <div className={styles.arcText}>{streakWindow}/28</div>
          </div>
        </div>

        <div className={styles.weekRow}>
          {weekDays.map((day, i) => (
            <div key={day} className={styles.dayCol}>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
